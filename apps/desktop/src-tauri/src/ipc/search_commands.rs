// v0.5 #11 (UltraPlan plan/31) → plan #44 E1 — 통합 검색 구현.
//
// 기존 search_commits_by_message (graph_commands.rs) 는 `git log --grep` 동등
// — subject + body 만. E1 의 목적: SHA / branch / commit message / file content 통합
// (Sublime Merge "class-leading 검색" parity).
//
// 우선순위 (Unified): SHA > branch > commit message > file content.
// 보안: file content 는 `git grep -F -e <pattern>` (fixed-string + -e 분리)로 flag/정규식
// injection 차단. 모든 git 호출은 runner::git_run (UTF-8 안전) 경유.

use super::repo_path;
use crate::error::{AppError, AppResult};
use crate::git::repository as repo;
use crate::git::runner::{git_run, GitRunOpts};
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

const SEARCH_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedSearchArgs {
    pub repo_id: i64,
    pub pattern: String,
    pub scope: SearchScope,
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SearchScope {
    /// commit subject + body (`git log --grep`, 기존 search_commits_by_message)
    CommitMessage,
    /// 워킹트리 file content (git grep)
    FileContent,
    /// branch name (refs/heads/* + refs/remotes/*)
    Branch,
    /// SHA prefix
    Sha,
    /// 모두 (priority: SHA > branch > commit message > file content)
    Unified,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedSearchHit {
    pub kind: SearchScope,
    pub label: String,
    pub detail: String,
    pub sha: Option<String>,
    pub path: Option<String>,
    pub line: Option<u32>,
}

/// plan #44 E1 — 통합 검색 entry.
#[tauri::command]
pub async fn unified_search(
    args: UnifiedSearchArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<UnifiedSearchHit>> {
    let path = repo_path(&state, args.repo_id).await?;
    let pattern = args.pattern.trim().to_string();
    if pattern.is_empty() {
        return Ok(Vec::new());
    }
    let limit = args.limit.unwrap_or(50).clamp(1, 500);
    let scope = args.scope;

    let do_sha = matches!(scope, SearchScope::Sha | SearchScope::Unified);
    let do_branch = matches!(scope, SearchScope::Branch | SearchScope::Unified);
    let do_msg = matches!(scope, SearchScope::CommitMessage | SearchScope::Unified);
    let do_file = matches!(scope, SearchScope::FileContent | SearchScope::Unified);

    let mut hits: Vec<UnifiedSearchHit> = Vec::new();

    // 1. SHA prefix (priority 최고) — hex 4~40 자만 시도.
    if do_sha && hits.len() < limit && looks_like_sha(&pattern) {
        if let Some(hit) = resolve_sha(&path, &pattern).await {
            hits.push(hit);
        }
    }

    // 2. Branch name substring.
    if do_branch && hits.len() < limit {
        let remaining = limit - hits.len();
        hits.extend(search_branches(&path, &pattern, remaining).await);
    }

    // 3. Commit message (git2 revwalk — 기존 함수 재사용, case-insensitive).
    if do_msg && hits.len() < limit {
        let remaining = limit - hits.len();
        let p = path.clone();
        let pat = pattern.clone();
        let commits = tokio::task::spawn_blocking(move || {
            let r = repo::open(&p)?;
            repo::search_commits_by_message(&r, &pat, remaining, true)
        })
        .await
        .map_err(|e| AppError::internal(format!("spawn_blocking: {e}")))??;
        for c in commits {
            hits.push(UnifiedSearchHit {
                kind: SearchScope::CommitMessage,
                label: c.subject,
                detail: format!("{} · {}", c.short_sha, c.author_name),
                sha: Some(c.sha),
                path: None,
                line: None,
            });
        }
    }

    // 4. File content (git grep — fixed-string, case-insensitive).
    if do_file && hits.len() < limit {
        let remaining = limit - hits.len();
        hits.extend(search_file_content(&path, &pattern, remaining).await);
    }

    hits.truncate(limit);
    Ok(hits)
}

/// hex prefix 후보 판정 (SHA scope 진입 게이트).
fn looks_like_sha(p: &str) -> bool {
    p.len() >= 4 && p.len() <= 40 && p.chars().all(|c| c.is_ascii_hexdigit())
}

/// SHA prefix → commit 해석 (`git rev-parse --verify <p>^{commit}`). 실패 시 None.
async fn resolve_sha(path: &Path, pattern: &str) -> Option<UnifiedSearchHit> {
    let spec = format!("{pattern}^{{commit}}");
    let out = git_run(path, &["rev-parse", "--verify", "--quiet", &spec], &opts())
        .await
        .ok()?;
    if out.exit_code != Some(0) {
        return None;
    }
    let full = out.stdout.trim().to_string();
    if full.is_empty() {
        return None;
    }
    let subject = git_run(path, &["log", "-1", "--format=%s", &full], &opts())
        .await
        .ok()
        .filter(|o| o.exit_code == Some(0))
        .map(|o| o.stdout.trim().to_string())
        .unwrap_or_default();
    Some(UnifiedSearchHit {
        kind: SearchScope::Sha,
        label: full.chars().take(8).collect(),
        detail: subject,
        sha: Some(full),
        path: None,
        line: None,
    })
}

/// branch / remote ref 이름 substring 매칭.
async fn search_branches(path: &Path, pattern: &str, limit: usize) -> Vec<UnifiedSearchHit> {
    let out = match git_run(
        path,
        &[
            "for-each-ref",
            "--format=%(refname:short)",
            "refs/heads",
            "refs/remotes",
        ],
        &opts(),
    )
    .await
    {
        Ok(o) if o.exit_code == Some(0) => o.stdout,
        _ => return Vec::new(),
    };
    filter_branches(&out, pattern, limit)
}

/// (pure) for-each-ref stdout → branch hit. 단위 테스트 대상.
fn filter_branches(stdout: &str, pattern: &str, limit: usize) -> Vec<UnifiedSearchHit> {
    let needle = pattern.to_lowercase();
    let mut hits = Vec::new();
    for line in stdout.lines() {
        let name = line.trim();
        if name.is_empty() {
            continue;
        }
        if name.to_lowercase().contains(&needle) {
            hits.push(UnifiedSearchHit {
                kind: SearchScope::Branch,
                label: name.to_string(),
                detail: "branch".to_string(),
                sha: None,
                path: None,
                line: None,
            });
            if hits.len() >= limit {
                break;
            }
        }
    }
    hits
}

/// 워킹트리 file content 검색 (`git grep -n -I -F -i -e <pattern>`).
async fn search_file_content(path: &Path, pattern: &str, limit: usize) -> Vec<UnifiedSearchHit> {
    let out = match git_run(
        path,
        &["grep", "-n", "-I", "-F", "-i", "--no-color", "-e", pattern],
        &opts(),
    )
    .await
    {
        // git grep: 0=매칭, 1=매칭 없음, >1=에러. 매칭 없음/에러는 빈 결과.
        Ok(o) if o.exit_code == Some(0) => o.stdout,
        _ => return Vec::new(),
    };
    parse_grep_output(&out, limit)
}

/// (pure) `git grep -n` stdout (path:line:content) → file content hit. 단위 테스트 대상.
fn parse_grep_output(stdout: &str, limit: usize) -> Vec<UnifiedSearchHit> {
    let mut hits = Vec::new();
    for line in stdout.lines() {
        // path 에 ':' 가 없다는 git 가정 (repo-relative). splitn(3) 로 content 안의 ':' 보존.
        let mut parts = line.splitn(3, ':');
        let p = match parts.next() {
            Some(x) if !x.is_empty() => x,
            _ => continue,
        };
        let ln = parts.next().and_then(|x| x.parse::<u32>().ok());
        if ln.is_none() {
            continue; // line number 파싱 실패 = 비정상 라인 skip
        }
        let content = parts.next().unwrap_or("").trim();
        hits.push(UnifiedSearchHit {
            kind: SearchScope::FileContent,
            label: p.to_string(),
            detail: content.chars().take(160).collect(),
            sha: None,
            path: Some(p.to_string()),
            line: ln,
        });
        if hits.len() >= limit {
            break;
        }
    }
    hits
}

fn opts() -> GitRunOpts {
    GitRunOpts {
        timeout: Some(SEARCH_TIMEOUT),
        ..Default::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn looks_like_sha_hex_lengths() {
        assert!(looks_like_sha("abcd")); // 4 hex
        assert!(looks_like_sha("0123456789abcdef"));
        assert!(!looks_like_sha("abc")); // <4
        assert!(!looks_like_sha("xyz1")); // non-hex
        assert!(!looks_like_sha("feature/login")); // branch-like
        assert!(!looks_like_sha(&"a".repeat(41))); // >40
    }

    #[test]
    fn filter_branches_substring_case_insensitive() {
        let stdout = "main\nfeature/Login\norigin/main\nrelease-1.2\n";
        let hits = filter_branches(stdout, "login", 50);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].label, "feature/Login");
        assert_eq!(hits[0].kind, SearchScope::Branch);
        // 'main' 은 둘 (main + origin/main)
        assert_eq!(filter_branches(stdout, "main", 50).len(), 2);
    }

    #[test]
    fn filter_branches_respects_limit() {
        let stdout = "ma1\nma2\nma3\nma4\n";
        assert_eq!(filter_branches(stdout, "ma", 2).len(), 2);
    }

    #[test]
    fn parse_grep_output_basic() {
        let stdout = "src/a.ts:12:const x = 1\nsrc/b.rs:3:fn main() {}\n";
        let hits = parse_grep_output(stdout, 50);
        assert_eq!(hits.len(), 2);
        assert_eq!(hits[0].label, "src/a.ts");
        assert_eq!(hits[0].line, Some(12));
        assert_eq!(hits[0].detail, "const x = 1");
        assert_eq!(hits[0].path.as_deref(), Some("src/a.ts"));
        assert_eq!(hits[0].kind, SearchScope::FileContent);
    }

    #[test]
    fn parse_grep_output_preserves_colons_in_content() {
        // content 안의 ':' 가 잘리지 않아야 (splitn(3)).
        let stdout = "src/url.ts:5:const u = 'http://x:8080'\n";
        let hits = parse_grep_output(stdout, 50);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].detail, "const u = 'http://x:8080'");
        assert_eq!(hits[0].line, Some(5));
    }

    #[test]
    fn parse_grep_output_skips_malformed_and_truncates() {
        // line number 없는 라인 skip + limit 적용.
        let stdout = "no-colon-line\nsrc/a.ts:1:x\nsrc/b.ts:2:y\nsrc/c.ts:3:z\n";
        let hits = parse_grep_output(stdout, 2);
        assert_eq!(hits.len(), 2);
        assert_eq!(hits[0].label, "src/a.ts");
        assert_eq!(hits[1].label, "src/b.ts");
    }

    #[test]
    fn parse_grep_output_truncates_long_content() {
        let long = "x".repeat(300);
        let stdout = format!("a.ts:1:{long}\n");
        let hits = parse_grep_output(&stdout, 50);
        assert_eq!(hits[0].detail.chars().count(), 160);
    }
}
