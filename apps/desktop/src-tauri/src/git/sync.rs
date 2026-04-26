// Push / Pull / Fetch (네트워크 작업).
//
// 모두 git CLI shell-out — libgit2 는 인증 핸들링이 까다롭고 (SSH agent /
// credential manager 우회), 사용자 시스템 git 의 credential helper 를
// 그대로 활용하는 게 안전 + 일관.

use crate::error::AppResult;
use crate::git::runner::{git_run, GitOutput, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

impl From<GitOutput> for SyncResult {
    fn from(o: GitOutput) -> Self {
        Self {
            success: o.exit_code == Some(0),
            stdout: o.stdout,
            stderr: o.stderr,
            exit_code: o.exit_code,
        }
    }
}

/// 모든 remote 에서 fetch.
pub async fn fetch_all(repo: &Path) -> AppResult<SyncResult> {
    let out = git_run(
        repo,
        &["fetch", "--all", "--prune", "--tags"],
        &GitRunOpts::default(),
    )
    .await?;
    Ok(out.into())
}

/// 특정 remote 에서 fetch.
pub async fn fetch(repo: &Path, remote: &str) -> AppResult<SyncResult> {
    let out = git_run(
        repo,
        &["fetch", "--prune", "--tags", remote],
        &GitRunOpts::default(),
    )
    .await?;
    Ok(out.into())
}

/// pull (== fetch + merge | rebase). 디폴트는 사용자 `pull.rebase` 설정 따름.
pub async fn pull(repo: &Path, remote: Option<&str>, branch: Option<&str>) -> AppResult<SyncResult> {
    let mut args: Vec<&str> = vec!["pull"];
    if let Some(r) = remote {
        args.push(r);
        if let Some(b) = branch {
            args.push(b);
        }
    }
    let out = git_run(repo, &args, &GitRunOpts::default()).await?;
    Ok(out.into())
}

/// push 옵션.
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PushOpts {
    /// `--force-with-lease` 사용 여부. 디폴트는 false (안전).
    pub force_with_lease: bool,
    /// `-u` 으로 upstream 설정.
    pub set_upstream: bool,
    /// `--tags` 도 같이.
    pub tags: bool,
}

pub async fn push(
    repo: &Path,
    remote: Option<&str>,
    branch: Option<&str>,
    opts: PushOpts,
) -> AppResult<SyncResult> {
    let mut args: Vec<&str> = vec!["push"];
    if opts.set_upstream {
        args.push("-u");
    }
    if opts.tags {
        args.push("--tags");
    }
    if opts.force_with_lease {
        args.push("--force-with-lease");
    }
    if let Some(r) = remote {
        args.push(r);
        if let Some(b) = branch {
            args.push(b);
        }
    }
    let out = git_run(repo, &args, &GitRunOpts::default()).await?;
    Ok(out.into())
}
