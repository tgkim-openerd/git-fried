// Git LFS — list / status / fetch / pull / track / untrack.
//
// 사용자 회사 sub-repo 6/6 모두 LFS 사용 (`docs/plan/02 §3 W4`).
// git CLI 가 git-lfs 를 호출 (smudge/clean filter 자동).

use crate::error::AppResult;
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LfsFile {
    pub path: String,
    pub oid: String,
    /// LFS 객체가 로컬에 다운로드 됐는지.
    pub downloaded: bool,
    pub size: Option<u64>,
}

/// `git lfs ls-files --long` 파싱.
///
/// 형식 예: `<oid> <state> <path>`
///   - state: `*` = downloaded, `-` = pointer only.
pub async fn list_files(repo: &Path) -> AppResult<Vec<LfsFile>> {
    let out = git_run(
        repo,
        &["lfs", "ls-files", "--long"],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;

    let mut files = Vec::new();
    for line in out.lines() {
        // "1234567890abc... * path/to/file.png"
        let mut parts = line.splitn(3, ' ');
        let oid = match parts.next() {
            Some(s) => s.to_string(),
            None => continue,
        };
        let state = parts.next().unwrap_or("");
        let path = parts.next().unwrap_or("").to_string();
        if path.is_empty() {
            continue;
        }
        files.push(LfsFile {
            path,
            oid,
            downloaded: state == "*",
            size: None,
        });
    }
    Ok(files)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LfsStatus {
    pub installed: bool,
    pub version: Option<String>,
    pub tracked_patterns: Vec<String>,
}

pub async fn status(repo: &Path) -> AppResult<LfsStatus> {
    // version
    let v = git_run(repo, &["lfs", "version"], &GitRunOpts::default()).await;
    let installed = v.as_ref().map(|o| o.exit_code == Some(0)).unwrap_or(false);
    let version = v.ok().and_then(|o| o.into_ok().ok()).map(|s| s.trim().to_string());

    // tracked: `git lfs track` (인자 없음) 가 현재 패턴 출력
    let tracked = git_run(repo, &["lfs", "track"], &GitRunOpts::default()).await;
    let mut patterns: Vec<String> = Vec::new();
    if let Ok(o) = tracked {
        if let Ok(out) = o.into_ok() {
            for line in out.lines().skip(1) {
                // 형식: "    *.psd (.gitattributes)"
                let trimmed = line.trim();
                if let Some(idx) = trimmed.find(" (") {
                    patterns.push(trimmed[..idx].to_string());
                } else if !trimmed.is_empty() && !trimmed.starts_with("Listing") {
                    patterns.push(trimmed.to_string());
                }
            }
        }
    }

    Ok(LfsStatus {
        installed,
        version,
        tracked_patterns: patterns,
    })
}

pub async fn track(repo: &Path, pattern: &str) -> AppResult<()> {
    git_run(repo, &["lfs", "track", pattern], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

pub async fn untrack(repo: &Path, pattern: &str) -> AppResult<()> {
    git_run(repo, &["lfs", "untrack", pattern], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

pub async fn fetch(repo: &Path) -> AppResult<()> {
    git_run(repo, &["lfs", "fetch"], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

pub async fn pull(repo: &Path) -> AppResult<()> {
    git_run(repo, &["lfs", "pull"], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

pub async fn prune(repo: &Path) -> AppResult<()> {
    git_run(repo, &["lfs", "prune"], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}
