// Worktree 관리 — list / add / remove / prune.
//
// 사용자 워크플로우 실측 (`docs/plan/02 §3 W2`):
//   - 8개 worktree 동시 사용 (gist-broadcenter, ptcorp-eosikahair)
//   - `worktree-agent-<hex>` prefix → AI 에이전트 자동 생성
//   - 디스크 사용량 시각화 + 점유 상태 표시 필요

use crate::error::AppResult;
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeEntry {
    pub path: String,
    pub branch: Option<String>,
    pub head_sha: Option<String>,
    pub is_main: bool,
    pub is_locked: bool,
    pub is_prunable: bool,
    /// 디스크 사용량 (바이트). 측정 실패 시 None.
    pub size_bytes: Option<u64>,
    /// Sprint c38 / plan/29 E5 — `git status --porcelain` 비어있지 않으면 dirty.
    /// 측정 실패 (경로 없음 / lock 등) 시 None — UI 는 "?" 처리.
    pub is_dirty: Option<bool>,
}

/// `git worktree list --porcelain` 파싱.
///
/// Sprint c45 PERF-4 — dirty check / measure_dir 병렬화 (8 wt 200ms→50ms 추정).
///   1차 phase: 동기 파싱 (entries Vec)
///   2차 phase: futures::future::join_all 로 모든 dirty/size 동시 측정
pub async fn list_worktrees(repo: &Path) -> AppResult<Vec<WorktreeEntry>> {
    let out = git_run(
        repo,
        &["worktree", "list", "--porcelain"],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;

    let mut entries = Vec::new();
    let mut current = WorktreeEntry {
        path: String::new(),
        branch: None,
        head_sha: None,
        is_main: false,
        is_locked: false,
        is_prunable: false,
        size_bytes: None,
        is_dirty: None,
    };
    let mut first = true;

    for line in out.lines() {
        if let Some(p) = line.strip_prefix("worktree ") {
            if !current.path.is_empty() {
                current.is_main = first;
                first = false;
                entries.push(current.clone());
            }
            current = WorktreeEntry {
                path: p.to_string(),
                branch: None,
                head_sha: None,
                is_main: false,
                is_locked: false,
                is_prunable: false,
                size_bytes: None,
                is_dirty: None,
            };
        } else if let Some(s) = line.strip_prefix("HEAD ") {
            current.head_sha = Some(s.to_string());
        } else if let Some(b) = line.strip_prefix("branch refs/heads/") {
            current.branch = Some(b.to_string());
        } else if line == "locked" || line.starts_with("locked ") {
            current.is_locked = true;
        } else if line == "prunable" || line.starts_with("prunable ") {
            current.is_prunable = true;
        }
    }
    if !current.path.is_empty() {
        current.is_main = first;
        entries.push(current);
    }

    // Sprint c45 PERF-4 — 모든 worktree dirty/size 병렬 측정.
    let dirty_futs = entries
        .iter()
        .map(|e| {
            let p = e.path.clone();
            async move { check_dirty(Path::new(&p)).await }
        })
        .collect::<Vec<_>>();
    let size_results: Vec<Option<u64>> = entries
        .iter()
        .map(|e| measure_dir(Path::new(&e.path)))
        .collect();
    let dirty_results: Vec<Option<bool>> = futures::future::join_all(dirty_futs).await;

    for (i, e) in entries.iter_mut().enumerate() {
        e.size_bytes = size_results[i];
        e.is_dirty = dirty_results[i];
    }

    Ok(entries)
}

/// Sprint c38 / plan/29 E5 — `git -C <wt> status --porcelain` 결과로 dirty 판정.
///
/// 반환:
///   - Some(false): 깨끗 (porcelain output 빈 줄).
///   - Some(true): 변경 있음.
///   - None: 측정 실패 (경로 없음 / 분리된 disk / status 명령 자체 실패).
///
/// 비용: worktree 당 1 spawn. 8 worktree 환경에서 약 80~200ms 추정.
/// 캐시는 frontend vue-query 가 처리 (queryKey 'worktrees').
async fn check_dirty(wt_path: &Path) -> Option<bool> {
    if !wt_path.exists() {
        return None;
    }
    // Codex R5 D-GIT-001 — background optional lock race 방지 (다른 git 프로세스 동시 access 시
    // index refresh write lock 충돌). `--no-optional-locks` 는 Git 공식 docs 의 BACKGROUND
    // REFRESH 권장: https://git-scm.com/docs/git-status.html
    let out = git_run(
        wt_path,
        &["--no-optional-locks", "status", "--porcelain"],
        &GitRunOpts::default(),
    )
    .await
    .ok()?;
    if out.exit_code != Some(0) {
        return None;
    }
    Some(!out.stdout.trim().is_empty())
}

/// 디렉토리 디스크 사용량 (바이트) — 얕은 walk (top-level dir/file 만).
/// 정확한 계산은 OS du 사용 권장. 여기서는 표시용 추정치.
fn measure_dir(p: &Path) -> Option<u64> {
    if !p.exists() {
        return None;
    }
    let mut total: u64 = 0;
    let walker = walkdir_lite(p, 5)?;
    for entry in walker {
        if let Ok(meta) = entry.metadata() {
            total += meta.len();
        }
    }
    Some(total)
}

/// std::fs 만으로 만든 가벼운 walker (depth 제한).
fn walkdir_lite(start: &Path, max_depth: usize) -> Option<Vec<std::fs::DirEntry>> {
    let mut out: Vec<std::fs::DirEntry> = Vec::new();
    let mut stack: Vec<(std::path::PathBuf, usize)> = vec![(start.to_path_buf(), 0)];
    while let Some((dir, d)) = stack.pop() {
        let read = match std::fs::read_dir(&dir) {
            Ok(r) => r,
            Err(_) => continue,
        };
        for entry in read.flatten() {
            let path = entry.path();
            if path.is_dir() && d < max_depth {
                // .git 디렉토리는 skip (worktree 의 .git 은 file 형태).
                if path.file_name().and_then(|s| s.to_str()) == Some(".git") {
                    continue;
                }
                stack.push((path, d + 1));
            } else {
                out.push(entry);
            }
        }
    }
    Some(out)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddWorktreeOpts {
    /// 새 worktree 디렉토리 경로 (절대 또는 상대).
    pub path: String,
    /// 새 브랜치 생성 + 체크아웃 시 브랜치 이름.
    pub create_branch: Option<String>,
    /// 기존 브랜치 체크아웃.
    pub branch: Option<String>,
    /// start_point (sha / ref).
    pub start_point: Option<String>,
}

pub async fn add_worktree(repo: &Path, opts: &AddWorktreeOpts) -> AppResult<()> {
    let mut args: Vec<String> = vec!["worktree".into(), "add".into()];
    if let Some(b) = &opts.create_branch {
        args.push("-b".into());
        args.push(b.clone());
    }
    args.push(opts.path.clone());
    if let Some(b) = &opts.branch {
        args.push(b.clone());
    } else if let Some(sp) = &opts.start_point {
        args.push(sp.clone());
    }
    let r: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    git_run(repo, &r, &GitRunOpts::default()).await?.into_ok()?;
    Ok(())
}

pub async fn remove_worktree(repo: &Path, path: &str, force: bool) -> AppResult<()> {
    let mut args: Vec<&str> = vec!["worktree", "remove"];
    if force {
        args.push("--force");
    }
    args.push(path);
    git_run(repo, &args, &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

pub async fn prune_worktrees(repo: &Path) -> AppResult<()> {
    git_run(repo, &["worktree", "prune"], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

/// Worktree lock — `git worktree lock <path> --reason "<reason>"` (Sprint C1).
///
/// Lock 된 worktree 는 prune / remove 가 거부됨. 외장 디스크의 worktree 가
/// disconnect 됐을 때 의도치 않게 정리되는 것 방지.
pub async fn lock_worktree(repo: &Path, path: &str, reason: Option<&str>) -> AppResult<()> {
    let mut args: Vec<&str> = vec!["worktree", "lock", path];
    if let Some(r) = reason.filter(|s| !s.trim().is_empty()) {
        args.push("--reason");
        args.push(r);
    }
    git_run(repo, &args, &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

pub async fn unlock_worktree(repo: &Path, path: &str) -> AppResult<()> {
    git_run(repo, &["worktree", "unlock", path], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}
