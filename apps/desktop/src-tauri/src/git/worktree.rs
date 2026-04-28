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
}

/// `git worktree list --porcelain` 파싱.
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
    };
    let mut first = true;

    for line in out.lines() {
        if let Some(p) = line.strip_prefix("worktree ") {
            if !current.path.is_empty() {
                current.is_main = first;
                first = false;
                current.size_bytes = measure_dir(Path::new(&current.path));
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
            };
        } else if let Some(s) = line.strip_prefix("HEAD ") {
            current.head_sha = Some(s.to_string());
        } else if let Some(b) = line.strip_prefix("branch refs/heads/") {
            current.branch = Some(b.to_string());
        } else if line == "locked" || line.starts_with("locked ") {
            // `locked` 단독 또는 `locked <reason>` (Sprint C1 lock_worktree 가 reason
            // 지정 시 후자) — 둘 다 locked 상태.
            current.is_locked = true;
        } else if line == "prunable" || line.starts_with("prunable ") {
            current.is_prunable = true;
        }
    }
    if !current.path.is_empty() {
        current.is_main = first;
        current.size_bytes = measure_dir(Path::new(&current.path));
        entries.push(current);
    }
    Ok(entries)
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
