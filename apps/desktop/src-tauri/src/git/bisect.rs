// Bisect — binary search 로 잘못된 commit 식별.
//
// `git bisect start / good / bad / skip / reset` 의 얇은 wrapper.
// state 는 Git 가 자체 관리 (`.git/BISECT_*` 파일).

use crate::error::AppResult;
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BisectStatus {
    /// bisect 진행 중 여부.
    pub in_progress: bool,
    /// 현재 HEAD (검증 중인 commit) — 진행 중일 때만.
    pub current_sha: Option<String>,
    /// good 표시된 SHA 목록.
    pub good: Vec<String>,
    /// bad 표시된 SHA 목록.
    pub bad: Vec<String>,
    /// 마지막 git bisect 출력 (사용자에게 진행 상황 안내).
    pub last_output: String,
}

pub async fn status(repo: &Path) -> AppResult<BisectStatus> {
    let in_progress = repo.join(".git").join("BISECT_LOG").exists();
    if !in_progress {
        return Ok(BisectStatus {
            in_progress: false,
            current_sha: None,
            good: vec![],
            bad: vec![],
            last_output: String::new(),
        });
    }

    let log = git_run(repo, &["bisect", "log"], &GitRunOpts::default())
        .await
        .ok()
        .and_then(|o| o.into_ok().ok())
        .unwrap_or_default();

    let mut good = Vec::new();
    let mut bad = Vec::new();
    for line in log.lines() {
        // 형식: "git bisect good <sha>" / "git bisect bad <sha>"
        if let Some(rest) = line.strip_prefix("git bisect good ") {
            if let Some(sha) = rest.split_whitespace().next() {
                good.push(sha.to_string());
            }
        } else if let Some(rest) = line.strip_prefix("git bisect bad ") {
            if let Some(sha) = rest.split_whitespace().next() {
                bad.push(sha.to_string());
            }
        }
    }

    let head = git_run(
        repo,
        &["rev-parse", "HEAD"],
        &GitRunOpts::default(),
    )
    .await
    .ok()
    .and_then(|o| o.into_ok().ok())
    .map(|s| s.trim().to_string());

    Ok(BisectStatus {
        in_progress: true,
        current_sha: head,
        good,
        bad,
        last_output: log,
    })
}

pub async fn start(repo: &Path) -> AppResult<String> {
    let out = git_run(repo, &["bisect", "start"], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(out)
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BisectMark {
    Good,
    Bad,
    Skip,
}

pub async fn mark(repo: &Path, m: BisectMark, sha: Option<&str>) -> AppResult<String> {
    let action = match m {
        BisectMark::Good => "good",
        BisectMark::Bad => "bad",
        BisectMark::Skip => "skip",
    };
    let mut args: Vec<&str> = vec!["bisect", action];
    if let Some(s) = sha {
        args.push(s);
    }
    let out = git_run(repo, &args, &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(out)
}

pub async fn reset(repo: &Path) -> AppResult<()> {
    git_run(repo, &["bisect", "reset"], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}
