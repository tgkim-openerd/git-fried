// Repo Maintenance — `docs/plan/14 §2 A2` (Sprint B14-2).
//
// gc (housekeeping) + fsck (무결성 검증). git CLI shell-out — runner::git_run
// 통과로 한글 안전 + LANG=C.UTF-8 스트림 디코딩.
//
// 거대 레포 (10MB pack 이상) 에서 gc 가 수 분 걸릴 수 있으므로 진행 상황은
// stdout/stderr 결과로만 표시 (incremental progress 는 v1.x).

use crate::error::AppResult;
use crate::git::runner::{git_run, GitOutput, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaintenanceResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

impl From<GitOutput> for MaintenanceResult {
    fn from(o: GitOutput) -> Self {
        Self {
            success: o.exit_code == Some(0),
            stdout: o.stdout,
            stderr: o.stderr,
            exit_code: o.exit_code,
        }
    }
}

/// `git gc`. aggressive=true 면 `--aggressive --prune=now`.
pub async fn gc(repo: &Path, aggressive: bool) -> AppResult<MaintenanceResult> {
    let mut args: Vec<&str> = vec!["gc"];
    if aggressive {
        args.push("--aggressive");
        args.push("--prune=now");
    }
    let out = git_run(repo, &args, &GitRunOpts::default()).await?;
    Ok(out.into())
}

/// `git fsck --full`. dangling object / corrupt pack 보고.
pub async fn fsck(repo: &Path) -> AppResult<MaintenanceResult> {
    let out = git_run(repo, &["fsck", "--full"], &GitRunOpts::default()).await?;
    Ok(out.into())
}
