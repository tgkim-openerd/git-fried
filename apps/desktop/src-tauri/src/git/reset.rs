// git reset (soft / mixed / hard) — 위험 액션, UI 에서 type-to-confirm.

use crate::error::{AppError, AppResult};
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ResetMode {
    Soft,
    Mixed,
    Hard,
    Keep,
}

pub async fn reset(path: &Path, mode: ResetMode, target: &str) -> AppResult<()> {
    let mode_arg = match mode {
        ResetMode::Soft => "--soft",
        ResetMode::Mixed => "--mixed",
        ResetMode::Hard => "--hard",
        ResetMode::Keep => "--keep",
    };
    if target.trim().is_empty() {
        return Err(AppError::validation("reset 대상이 비었습니다."));
    }
    git_run(path, &["reset", mode_arg, target], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

/// 단일 커밋 revert.
pub async fn revert(path: &Path, sha: &str, no_commit: bool) -> AppResult<()> {
    let mut args: Vec<&str> = vec!["revert"];
    if no_commit {
        args.push("--no-commit");
    }
    args.push(sha);
    git_run(path, &args, &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}
