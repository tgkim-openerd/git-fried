// Bisect — binary search 로 잘못된 commit 식별.
//
// `git bisect start / good / bad / skip / reset` 의 얇은 wrapper.
// state 는 Git 가 자체 관리 (`.git/BISECT_*` 파일).

use crate::error::{AppError, AppResult};
use crate::git::path::reject_dash_prefix;
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

    let head = git_run(repo, &["rev-parse", "HEAD"], &GitRunOpts::default())
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

/// bisect 시작. A-17 — 알려진 bad / good rev 를 함께 전달하면 탐색 범위가
/// 즉시 좁아진다 (`git bisect start [<bad> [<good>]]`). good 은 bad 가 있을 때만
/// 유효 (git 제약).
///
/// **보안 (SEC-001)**: bad/good rev 는 `reject_dash_prefix` 로 argument injection 방어.
/// (`git bisect` 는 `--end-of-options` 미지원 — CDX-001 실측 확인. dash-prefix 거부가
/// 단독으로 injection 을 완전 차단하므로 `--end-of-options` 불필요.)
pub async fn start(repo: &Path, bad: Option<&str>, good: Option<&str>) -> AppResult<String> {
    let safe_bad = bad
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|b| reject_dash_prefix(b, "bad rev"))
        .transpose()?;
    let safe_good = good
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|g| reject_dash_prefix(g, "good rev"))
        .transpose()?;
    // CDX-001 — good 만 있고 bad 가 없으면 git 이 범위를 잡지 못함. 명시 거부.
    if safe_good.is_some() && safe_bad.is_none() {
        return Err(AppError::validation(
            "good rev 를 지정하려면 bad rev 도 함께 입력해야 합니다",
        ));
    }
    let mut args: Vec<&str> = vec!["bisect", "start"];
    if let Some(b) = safe_bad {
        args.push(b);
        if let Some(g) = safe_good {
            args.push(g);
        }
    }
    let out = git_run(repo, &args, &GitRunOpts::default())
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
    // SEC-002 — sha argument injection 방어 (reject_dash_prefix 단독.
    // `git bisect good/bad/skip` 는 --end-of-options 미지원 — CDX-002 실측 확인).
    if let Some(s) = sha {
        let safe = reject_dash_prefix(s, "sha")?;
        args.push(safe);
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
