// Commit graph 계산 — pvigier "Straight branches" 알고리즘.
//
// 참조: https://pvigier.github.io/2019/05/06/commit-graph-drawing-algorithms.html
//
// 핵심 아이디어:
//   - 각 브랜치를 "lane (column)" 에 할당
//   - 한 lane 에서 commit 진행 시 lane 유지 (직선)
//   - 머지 시 두 번째 부모는 새 lane 에 할당 (오른쪽으로 분기)
//   - lane 종료 (자식 없음) 시 다른 lane shift 안 시킴 (gap 그대로)
//
// 본 구현은 newest → oldest 순회. 각 row 의 `crossing_lanes` 는
// "이 row 를 통과하는 모든 활성 lane 의 인덱스 집합" 이고,
// `parent_lanes[i]` 는 부모 i 가 어느 lane 으로 이어지는지.
//
// Frontend 는 row 단위로 그리기:
//   - 각 lane 의 vertical line (crossing_lanes)
//   - 이 row 의 lane 에 circle
//   - circle 에서 parent_lanes[*] 로 edge

use crate::error::{AppError, AppResult};
use crate::git::repository::CommitSummary;
use git2::{Repository, Sort};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphRow {
    pub commit: CommitSummary,
    /// 이 commit 의 lane index (0 = 가장 왼쪽).
    pub lane: usize,
    /// 부모마다 어떤 lane 으로 이어지는지 (edge 그릴 때 사용).
    pub parent_lanes: Vec<usize>,
    /// 이 row 를 통과 중인 lane 들 (vertical line 그릴 때).
    /// 이 commit 자신의 lane 도 포함.
    pub crossing_lanes: Vec<usize>,
    /// 머지 commit 인지 (parent 2개 이상).
    pub is_merge: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphResult {
    pub rows: Vec<GraphRow>,
    /// 그린 동안 사용된 최대 lane 수 (Canvas 폭 결정).
    pub max_lane: usize,
}

pub fn compute_graph(path: &Path, limit: usize) -> AppResult<GraphResult> {
    let repo = Repository::open(path).map_err(AppError::Git)?;
    let mut walker = repo.revwalk().map_err(AppError::Git)?;
    // TIME 만 쓰면 동시 timestamp commits 의 순서가 비결정적 (테스트 fixture 처럼
    // 빠르게 생성된 commits 는 같은 초). TOPOLOGICAL 도 결합해서 children-before-
    // parents 순서를 강제 → lane 알고리즘 invariant 보장.
    walker
        .set_sorting(Sort::TIME | Sort::TOPOLOGICAL)
        .map_err(AppError::Git)?;
    if walker.push_head().is_err() {
        return Ok(GraphResult {
            rows: vec![],
            max_lane: 0,
        });
    }

    // refs map (ref labels)
    let refs_map = collect_refs(&repo);

    // active[sha] = lane: 다음에 sha 가 나오면 그 lane 으로 들어감.
    // 각 lane 은 한 번에 하나의 sha 만 기다린다는 invariant.
    let mut active: HashMap<String, usize> = HashMap::new();
    // 사용 가능 여부 (true = 빈 lane).
    let mut lane_pool: Vec<bool> = Vec::new();
    let mut max_lane_used: usize = 0;

    let mut rows: Vec<GraphRow> = Vec::with_capacity(limit);

    for oid_res in walker.take(limit) {
        let oid = match oid_res {
            Ok(o) => o,
            Err(_) => continue,
        };
        let commit = match repo.find_commit(oid) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let sha = oid.to_string();

        // 1. 이 commit 의 lane 찾기.
        //    active 에서 sha 를 기다리는 lane 들이 있으면 그 중 가장 작은 lane 선택,
        //    나머지는 free (consumed by merge).
        let mut my_lane: Option<usize> = None;
        let mut consumed: Vec<usize> = Vec::new();
        // active 의 entries 를 lane 오름차순으로 처리하기 위해 잠시 vec 로
        let mut entries: Vec<(String, usize)> =
            active.iter().map(|(k, v)| (k.clone(), *v)).collect();
        entries.sort_by_key(|(_, l)| *l);
        for (s, lane) in &entries {
            if *s == sha {
                if my_lane.is_none() {
                    my_lane = Some(*lane);
                } else {
                    consumed.push(*lane);
                }
            }
        }
        // 자식이 없는 (= active 에 없는) 새 가지 → 새 lane 할당 (오른쪽 끝).
        let lane = match my_lane {
            Some(l) => l,
            None => alloc_lane(&mut lane_pool),
        };
        // active 에서 my_lane 키 (sha) 제거 + consumed lane 들 free
        active.retain(|s, l| !(*s == sha && (*l == lane || consumed.contains(l))));
        for c in &consumed {
            free_lane(&mut lane_pool, *c);
        }

        // 2. 부모 처리 — 첫 부모는 같은 lane, 나머지는 새 lane.
        let mut parent_lanes: Vec<usize> = Vec::new();
        let parent_count = commit.parent_count();
        for i in 0..parent_count {
            let p_oid = match commit.parent_id(i) {
                Ok(o) => o,
                Err(_) => continue,
            };
            let p_sha = p_oid.to_string();

            // 이미 active 에 같은 부모를 기다리는 lane 이 있으면 그걸 재사용
            let existing = active.iter().find_map(|(s, l)| (s == &p_sha).then_some(*l));

            if let Some(l) = existing {
                parent_lanes.push(l);
                continue;
            }

            let p_lane = if i == 0 {
                // 첫 부모: 현재 lane 유지
                lane
            } else {
                // merge — 새 lane (또는 free lane 재사용)
                alloc_lane(&mut lane_pool)
            };
            active.insert(p_sha, p_lane);
            parent_lanes.push(p_lane);
        }

        // 3. crossing_lanes 스냅샷 (이 row 시점의 모든 활성 lane).
        //    my lane 은 commit.lane 자리만, 나머지 active 의 lane 들은 vertical line.
        let mut crossing: std::collections::BTreeSet<usize> = active.values().copied().collect();
        crossing.insert(lane);
        max_lane_used = max_lane_used.max(crossing.iter().copied().max().unwrap_or(0));

        // 4. CommitSummary 빌드
        let author = commit.author();
        let committer = commit.committer();
        let message = commit.message().unwrap_or("");
        let (subject, body) = split_subj_body(message);
        let parent_shas: Vec<String> = (0..parent_count)
            .filter_map(|i| commit.parent_id(i).ok().map(|o| o.to_string()))
            .collect();
        let signed = commit
            .header_field_bytes("gpgsig")
            .map(|b| !b.is_empty())
            .unwrap_or(false);
        let refs = refs_map.get(&sha).cloned().unwrap_or_default();

        let summary = CommitSummary {
            short_sha: sha.chars().take(7).collect(),
            sha: sha.clone(),
            parent_shas,
            author_name: author.name().unwrap_or("").to_string(),
            author_email: author.email().unwrap_or("").to_string(),
            author_at: author.when().seconds(),
            committer_at: committer.when().seconds(),
            subject,
            body,
            signed,
            refs,
        };

        rows.push(GraphRow {
            commit: summary,
            lane,
            parent_lanes,
            crossing_lanes: crossing.into_iter().collect(),
            is_merge: parent_count > 1,
        });
    }

    Ok(GraphResult {
        rows,
        max_lane: max_lane_used + 1,
    })
}

fn alloc_lane(pool: &mut Vec<bool>) -> usize {
    for (i, avail) in pool.iter_mut().enumerate() {
        if *avail {
            *avail = false;
            return i;
        }
    }
    pool.push(false);
    pool.len() - 1
}

fn free_lane(pool: &mut [bool], lane: usize) {
    if let Some(slot) = pool.get_mut(lane) {
        *slot = true;
    }
}

fn split_subj_body(msg: &str) -> (String, String) {
    let trimmed = msg.trim_end();
    if let Some(idx) = trimmed.find('\n') {
        let s = trimmed[..idx].trim().to_string();
        let b = trimmed[idx..].trim_start_matches('\n').trim().to_string();
        (s, b)
    } else {
        (trimmed.to_string(), String::new())
    }
}

fn collect_refs(repo: &Repository) -> HashMap<String, Vec<String>> {
    let mut map: HashMap<String, Vec<String>> = HashMap::new();
    if let Ok(refs) = repo.references() {
        for r in refs {
            let r = match r {
                Ok(r) => r,
                Err(_) => continue,
            };
            let name = match r.shorthand() {
                Some(s) => s.to_string(),
                None => continue,
            };
            if let Some(oid) = r.target() {
                map.entry(oid.to_string()).or_default().push(name);
            }
        }
    }
    map
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_linear_history() {
        let tmp = tempfile::TempDir::new().unwrap();
        let path = tmp.path().to_path_buf();
        crate::git::runner::git_run(&path, &["init", "-q", "-b", "main"], &Default::default())
            .await
            .unwrap()
            .into_ok()
            .unwrap();
        crate::git::runner::git_run(&path, &["config", "user.name", "x"], &Default::default())
            .await
            .unwrap()
            .into_ok()
            .unwrap();
        crate::git::runner::git_run(&path, &["config", "user.email", "x@x"], &Default::default())
            .await
            .unwrap()
            .into_ok()
            .unwrap();
        crate::git::runner::git_run(
            &path,
            &["config", "commit.gpgsign", "false"],
            &Default::default(),
        )
        .await
        .unwrap()
        .into_ok()
        .unwrap();
        for i in 0..3 {
            crate::git::runner::git_run(
                &path,
                &["commit", "--allow-empty", "-m", &format!("c{i}")],
                &Default::default(),
            )
            .await
            .unwrap()
            .into_ok()
            .unwrap();
        }

        let g = compute_graph(&path, 100).unwrap();
        assert_eq!(g.rows.len(), 3);
        // 모두 lane 0 에 있어야 함
        for r in &g.rows {
            assert_eq!(r.lane, 0);
            assert_eq!(r.crossing_lanes, vec![0]);
            assert!(!r.is_merge);
        }
        assert_eq!(g.max_lane, 1);
    }

    #[tokio::test]
    async fn test_merge_creates_new_lane() {
        let tmp = tempfile::TempDir::new().unwrap();
        let path = tmp.path().to_path_buf();
        let run = |args: &[&str]| {
            let path = path.clone();
            let args: Vec<String> = args.iter().map(|s| s.to_string()).collect();
            async move {
                let argr: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
                crate::git::runner::git_run(&path, &argr, &Default::default())
                    .await
                    .unwrap()
                    .into_ok()
                    .unwrap()
            }
        };
        run(&["init", "-q", "-b", "main"]).await;
        run(&["config", "user.name", "x"]).await;
        run(&["config", "user.email", "x@x"]).await;
        run(&["config", "commit.gpgsign", "false"]).await;
        run(&["commit", "--allow-empty", "-m", "main:c1"]).await;
        run(&["switch", "-c", "feat"]).await;
        run(&["commit", "--allow-empty", "-m", "feat:c1"]).await;
        run(&["commit", "--allow-empty", "-m", "feat:c2"]).await;
        run(&["switch", "main"]).await;
        run(&["commit", "--allow-empty", "-m", "main:c2"]).await;
        run(&["merge", "--no-ff", "feat", "-m", "merge feat into main"]).await;

        let g = compute_graph(&path, 100).unwrap();
        // 머지 커밋이 첫 row, 그리고 max_lane 은 최소 2 (main + feat)
        let merge_row = g
            .rows
            .iter()
            .find(|r| r.is_merge)
            .expect("머지 커밋 있어야 함");
        assert_eq!(merge_row.parent_lanes.len(), 2);
        assert!(g.max_lane >= 2, "max_lane={}", g.max_lane);
    }
}
