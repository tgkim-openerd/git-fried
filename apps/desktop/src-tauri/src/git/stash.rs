// Stash 관리 — list / push / apply / pop / drop / show.
//
// 모두 git CLI shell-out. libgit2 stash API 도 있지만 metadata
// (untracked 포함 여부 등) 가 git CLI 와 미묘히 달라 일관성 위해 통일.

use crate::error::AppResult;
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StashEntry {
    /// stash@{0} 의 인덱스 0
    pub index: usize,
    /// stash 의 SHA
    pub sha: String,
    /// "WIP on main: ..." 같은 메시지
    pub message: String,
    /// stash 가 만들어진 브랜치 (메시지에서 파싱)
    pub branch: Option<String>,
    /// unix timestamp
    pub created_at: i64,
}

/// `git stash list --format=...` 파싱.
pub async fn list_stash(repo: &Path) -> AppResult<Vec<StashEntry>> {
    // %gd: stash@{0}, %H: SHA, %ct: committer unix, %s: subject
    let out = git_run(
        repo,
        &[
            "stash",
            "list",
            "--format=%gd\x1f%H\x1f%ct\x1f%s",
        ],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;

    let mut entries = Vec::new();
    for line in out.lines() {
        let parts: Vec<&str> = line.split('\x1f').collect();
        if parts.len() < 4 {
            continue;
        }
        let gd = parts[0]; // stash@{0}
        let index = gd
            .strip_prefix("stash@{")
            .and_then(|s| s.strip_suffix('}'))
            .and_then(|s| s.parse::<usize>().ok())
            .unwrap_or(0);
        let sha = parts[1].to_string();
        let created_at = parts[2].parse::<i64>().unwrap_or(0);
        let message = parts[3].to_string();
        let branch = message
            .strip_prefix("WIP on ")
            .or_else(|| message.strip_prefix("On "))
            .and_then(|s| s.split(':').next())
            .map(|s| s.trim().to_string());
        entries.push(StashEntry {
            index,
            sha,
            message,
            branch,
            created_at,
        });
    }
    Ok(entries)
}

/// 새 stash 생성. include_untracked=true 면 -u, message=Some 이면 push -m.
pub async fn push_stash(
    repo: &Path,
    message: Option<&str>,
    include_untracked: bool,
) -> AppResult<()> {
    let mut args: Vec<&str> = vec!["stash", "push"];
    if include_untracked {
        args.push("-u");
    }
    if let Some(m) = message {
        args.push("-m");
        args.push(m);
    }
    git_run(repo, &args, &GitRunOpts::default()).await?.into_ok()?;
    Ok(())
}

/// stash@{n} apply (디폴트 0).
pub async fn apply_stash(repo: &Path, index: usize) -> AppResult<()> {
    let r = format!("stash@{{{index}}}");
    git_run(repo, &["stash", "apply", &r], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

/// stash@{n} pop (apply + drop).
pub async fn pop_stash(repo: &Path, index: usize) -> AppResult<()> {
    let r = format!("stash@{{{index}}}");
    git_run(repo, &["stash", "pop", &r], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

/// stash@{n} drop.
pub async fn drop_stash(repo: &Path, index: usize) -> AppResult<()> {
    let r = format!("stash@{{{index}}}");
    git_run(repo, &["stash", "drop", &r], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

/// stash@{n} 의 diff text.
pub async fn show_stash(repo: &Path, index: usize) -> AppResult<String> {
    let r = format!("stash@{{{index}}}");
    git_run(
        repo,
        &["stash", "show", "-p", "--no-color", &r],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()
}
