// Submodule 관리 — list / init / update / sync.
//
// 사용자 회사 레포 6/6 모두 submodule 사용 (proto/design assets).
// `docs/plan/02 §3 W4` 참조.

use crate::error::AppResult;
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmoduleEntry {
    pub path: String,
    pub sha: Option<String>,
    pub status: SubmoduleState,
    /// 추가 정보 (--, +, U 의 의미).
    pub flag: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SubmoduleState {
    Uninitialized, // -
    Initialized,   // (no flag)
    Modified,      // +
    Conflicted,    // U
    Unknown,
}

/// `git submodule status` 파싱.
///
/// 각 라인 형식:
///   ` <sha> <path> (<branch>)`     (initialized, clean)
///   `+<sha> <path> (<branch>)`     (modified locally)
///   `-<sha> <path>`                (uninitialized)
///   `U<sha> <path>`                (merge conflict)
pub async fn list_submodules(repo: &Path) -> AppResult<Vec<SubmoduleEntry>> {
    let out = git_run(
        repo,
        &["submodule", "status", "--recursive"],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;

    let mut entries = Vec::new();
    for raw_line in out.lines() {
        if raw_line.trim().is_empty() {
            continue;
        }
        // 첫 글자가 flag (' ', '+', '-', 'U')
        let mut chars = raw_line.chars();
        let first = chars.next().unwrap_or(' ');
        let rest = chars.as_str();

        let (state, flag) = match first {
            '-' => (SubmoduleState::Uninitialized, "-".to_string()),
            '+' => (SubmoduleState::Modified, "+".to_string()),
            'U' => (SubmoduleState::Conflicted, "U".to_string()),
            ' ' => (SubmoduleState::Initialized, String::new()),
            other => (SubmoduleState::Unknown, other.to_string()),
        };

        // "<sha> <path> [...]"
        let mut parts = rest.splitn(3, ' ');
        let sha = parts.next().map(|s| s.to_string());
        let path = parts.next().unwrap_or("").to_string();

        if path.is_empty() {
            continue;
        }
        entries.push(SubmoduleEntry {
            path,
            sha,
            status: state,
            flag,
        });
    }
    Ok(entries)
}

pub async fn init_submodules(repo: &Path) -> AppResult<()> {
    git_run(
        repo,
        &["submodule", "update", "--init", "--recursive"],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;
    Ok(())
}

pub async fn update_submodules(repo: &Path, remote: bool) -> AppResult<()> {
    let mut args: Vec<&str> = vec!["submodule", "update", "--init", "--recursive"];
    if remote {
        args.push("--remote");
    }
    git_run(repo, &args, &GitRunOpts::default()).await?.into_ok()?;
    Ok(())
}

pub async fn sync_submodules(repo: &Path) -> AppResult<()> {
    git_run(
        repo,
        &["submodule", "sync", "--recursive"],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;
    Ok(())
}
