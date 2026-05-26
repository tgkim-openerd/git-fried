// AI subprocess IPC commands — c40 후속에서 v02_commands.rs 에서 분리 (~410 LOC).
//
// lib.rs 는 `ipc::v02_commands::ai_*` path 로 호출하므로 v02_commands.rs 가
// `pub use crate::ipc::ai_commands::*;` 으로 re-export. (c39 lfs/bisect/rebase 분리 동일 패턴.)

use super::repo_path;
use crate::ai;
use crate::error::{AppError, AppResult};
use crate::git::merge as git_merge;
use crate::git::path::reject_dash_prefix;
use crate::AppState;
use serde::Deserialize;
use std::sync::Arc;

/// Sprint 2026-05-26 — Codex Wave 1 HIGH (ai_commands rev validation).
/// base..head 또는 sha 가 IPC 입력 직접 → `git log` / `git diff` 의 argv 인젝션 차단.
///
/// `reject_dash_prefix` 로 1단계, 추가로 `..` 가 양 끝 또는 내부 중복으로 들어가
/// 의도 외 rev spec 만드는 케이스 차단.
fn validate_rev(rev: &str, label: &str) -> AppResult<()> {
    let trimmed = reject_dash_prefix(rev, label)?;
    if trimmed.is_empty() {
        return Err(AppError::validation(format!("{label} 가 비었습니다.")));
    }
    // `..` 가 ref 안에 포함된 형태는 git rev 문법 충돌 — `git log base..head` 같이
    // caller 가 format! 으로 명시 결합한다는 가정. ref 자체에 `..` 있으면 인젝션 의심.
    if trimmed.contains("..") {
        return Err(AppError::validation(format!(
            "{label} 에 '..' 가 포함될 수 없습니다: {trimmed}"
        )));
    }
    Ok(())
}

// ====== AI subprocess ======

#[tauri::command]
pub async fn ai_detect_clis() -> Vec<ai::AiProbe> {
    ai::detect_clis().await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCommitMessageArgs {
    pub repo_id: i64,
    pub cli: ai::AiCli,
    /// 사용자 승인 여부 (회사 워크스페이스에서 강제, 개인은 디폴트 true).
    #[serde(default)]
    pub user_approved: bool,
}

#[tauri::command]
pub async fn ai_commit_message(
    args: AiCommitMessageArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<ai::AiOutput> {
    if !args.user_approved {
        return Err(AppError::validation("AI 호출 전 송출 승인이 필요합니다."));
    }
    let path = repo_path(&state, args.repo_id).await?;

    // staged diff 추출
    let diff = crate::git::diff::diff(
        &path,
        &crate::git::diff::DiffArgs {
            staged: true,
            path: None,
            rev: None,
            context: Some(3),
        },
    )
    .await?;
    if diff.trim().is_empty() {
        return Err(AppError::validation("staged 변경이 없습니다."));
    }

    // 최근 5개 commit subject
    let recent = crate::git::runner::git_run(
        &path,
        &["log", "-5", "--pretty=%s"],
        &crate::git::runner::GitRunOpts::default(),
    )
    .await
    .ok()
    .and_then(|o| o.into_ok().ok())
    .unwrap_or_default();
    let recent_subjects: Vec<String> = recent
        .lines()
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.to_string())
        .collect();

    let prompt = ai::commit_message_prompt(&diff, &recent_subjects);
    ai::ai_run(args.cli, &prompt).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiResolveConflictArgs {
    pub repo_id: i64,
    pub cli: ai::AiCli,
    pub path: String,
    #[serde(default)]
    pub user_approved: bool,
}

#[tauri::command]
pub async fn ai_resolve_conflict(
    args: AiResolveConflictArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<ai::AiOutput> {
    if !args.user_approved {
        return Err(AppError::validation("AI 호출 전 송출 승인이 필요합니다."));
    }
    let path = repo_path(&state, args.repo_id).await?;

    // 충돌 파일 read (sync — git2)
    let cf = {
        let p = path.clone();
        let f = args.path.clone();
        tokio::task::spawn_blocking(move || git_merge::read_conflicted(&p, &f))
            .await
            .map_err(|e| AppError::internal(format!("spawn_blocking: {e}")))??
    };

    let prompt = ai::merge_resolution_prompt(
        &args.path,
        cf.working.as_deref().unwrap_or(""),
        cf.ours.as_deref().unwrap_or(""),
        cf.theirs.as_deref().unwrap_or(""),
        cf.base.as_deref(),
    );
    ai::ai_run(args.cli, &prompt).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCodeReviewArgs {
    pub repo_id: i64,
    pub cli: ai::AiCli,
    pub head_branch: String,
    pub base_branch: String,
    pub pr_title: String,
    pub pr_body: String,
    #[serde(default)]
    pub user_approved: bool,
}

#[tauri::command]
pub async fn ai_code_review(
    args: AiCodeReviewArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<ai::AiOutput> {
    if !args.user_approved {
        return Err(AppError::validation("AI 호출 전 송출 승인이 필요합니다."));
    }
    // Sprint 2026-05-26 HIGH (Codex Wave 1) — rev validation.
    validate_rev(&args.base_branch, "baseBranch")?;
    validate_rev(&args.head_branch, "headBranch")?;
    let path = repo_path(&state, args.repo_id).await?;

    // base..head commits + diff
    let log_arg = format!("{}..{}", args.base_branch, args.head_branch);
    let log = crate::git::runner::git_run(
        &path,
        &[
            "log",
            "--pretty=%s",
            "--reverse",
            "--end-of-options",
            &log_arg,
        ],
        &crate::git::runner::GitRunOpts::default(),
    )
    .await
    .ok()
    .and_then(|o| o.into_ok().ok())
    .unwrap_or_default();
    let commits: Vec<String> = log
        .lines()
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.to_string())
        .collect();

    let diff = crate::git::runner::git_run(
        &path,
        &["diff", "--no-color", "--end-of-options", &log_arg],
        &crate::git::runner::GitRunOpts::default(),
    )
    .await
    .ok()
    .and_then(|o| o.into_ok().ok())
    .unwrap_or_default();

    if diff.trim().is_empty() {
        return Err(AppError::validation(
            "diff 가 비었습니다. branch 범위를 확인.",
        ));
    }

    let prompt = ai::code_review_prompt(&args.pr_title, &args.pr_body, &commits, &diff);
    ai::ai_run(args.cli, &prompt).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiPrBodyArgs {
    pub repo_id: i64,
    pub cli: ai::AiCli,
    pub head_branch: String,
    pub base_branch: String,
    #[serde(default)]
    pub user_approved: bool,
}

#[tauri::command]
pub async fn ai_pr_body(
    args: AiPrBodyArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<ai::AiOutput> {
    if !args.user_approved {
        return Err(AppError::validation("AI 호출 전 송출 승인이 필요합니다."));
    }
    validate_rev(&args.base_branch, "baseBranch")?;
    validate_rev(&args.head_branch, "headBranch")?;
    let path = repo_path(&state, args.repo_id).await?;

    // base..head 커밋 subject 목록
    let log_arg = format!("{}..{}", args.base_branch, args.head_branch);
    let log = crate::git::runner::git_run(
        &path,
        &[
            "log",
            "--pretty=%s",
            "--reverse",
            "--end-of-options",
            &log_arg,
        ],
        &crate::git::runner::GitRunOpts::default(),
    )
    .await
    .ok()
    .and_then(|o| o.into_ok().ok())
    .unwrap_or_default();
    let commits: Vec<String> = log
        .lines()
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.to_string())
        .collect();

    // diff stat
    let stat = crate::git::runner::git_run(
        &path,
        &["diff", "--stat", "--end-of-options", &log_arg],
        &crate::git::runner::GitRunOpts::default(),
    )
    .await
    .ok()
    .and_then(|o| o.into_ok().ok())
    .unwrap_or_default();

    let prompt = ai::pr_body_prompt(&commits, &stat, &args.head_branch, &args.base_branch);
    ai::ai_run(args.cli, &prompt).await
}

// ====== AI explain / stash (Sprint B7 / `docs/plan/11 §18`) ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiExplainCommitArgs {
    pub repo_id: i64,
    pub cli: ai::AiCli,
    pub sha: String,
    #[serde(default)]
    pub user_approved: bool,
}

#[tauri::command]
pub async fn ai_explain_commit(
    args: AiExplainCommitArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<ai::AiOutput> {
    if !args.user_approved {
        return Err(AppError::validation("AI 호출 전 송출 승인이 필요합니다."));
    }
    validate_rev(&args.sha, "sha")?;
    let path = repo_path(&state, args.repo_id).await?;

    // commit subject + diff 추출.
    let subject = crate::git::runner::git_run(
        &path,
        &["log", "-1", "--pretty=%s", "--end-of-options", &args.sha],
        &crate::git::runner::GitRunOpts::default(),
    )
    .await?
    .into_ok()?
    .trim()
    .to_string();

    let diff = crate::git::runner::git_run(
        &path,
        &[
            "show",
            "--no-color",
            "--format=",
            "--end-of-options",
            &args.sha,
        ],
        &crate::git::runner::GitRunOpts::default(),
    )
    .await?
    .into_ok()?;

    if diff.trim().is_empty() {
        return Err(AppError::validation("commit diff 가 비었습니다."));
    }

    let prompt = ai::explain_commit_prompt(&subject, &diff);
    ai::ai_run(args.cli, &prompt).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiExplainBranchArgs {
    pub repo_id: i64,
    pub cli: ai::AiCli,
    pub head_branch: String,
    pub base_branch: String,
    #[serde(default)]
    pub user_approved: bool,
}

#[tauri::command]
pub async fn ai_explain_branch(
    args: AiExplainBranchArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<ai::AiOutput> {
    if !args.user_approved {
        return Err(AppError::validation("AI 호출 전 송출 승인이 필요합니다."));
    }
    validate_rev(&args.base_branch, "baseBranch")?;
    validate_rev(&args.head_branch, "headBranch")?;
    let path = repo_path(&state, args.repo_id).await?;

    let log_arg = format!("{}..{}", args.base_branch, args.head_branch);
    let log = crate::git::runner::git_run(
        &path,
        &[
            "log",
            "--pretty=%s",
            "--reverse",
            "--end-of-options",
            &log_arg,
        ],
        &crate::git::runner::GitRunOpts::default(),
    )
    .await
    .ok()
    .and_then(|o| o.into_ok().ok())
    .unwrap_or_default();
    let commits: Vec<String> = log
        .lines()
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.to_string())
        .collect();

    let stat = crate::git::runner::git_run(
        &path,
        &["diff", "--stat", "--end-of-options", &log_arg],
        &crate::git::runner::GitRunOpts::default(),
    )
    .await
    .ok()
    .and_then(|o| o.into_ok().ok())
    .unwrap_or_default();

    if commits.is_empty() && stat.trim().is_empty() {
        return Err(AppError::validation(
            "브랜치에 변경이 없습니다. base/head 확인.",
        ));
    }

    let prompt = ai::explain_branch_prompt(&args.head_branch, &args.base_branch, &commits, &stat);
    ai::ai_run(args.cli, &prompt).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiStashMessageArgs {
    pub repo_id: i64,
    pub cli: ai::AiCli,
    /// `true` 이면 untracked 포함; `false` 면 tracked 변경만.
    #[serde(default)]
    pub include_untracked: bool,
    #[serde(default)]
    pub user_approved: bool,
}

#[tauri::command]
pub async fn ai_stash_message(
    args: AiStashMessageArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<ai::AiOutput> {
    if !args.user_approved {
        return Err(AppError::validation("AI 호출 전 송출 승인이 필요합니다."));
    }
    let path = repo_path(&state, args.repo_id).await?;

    // working tree 의 모든 변경 (staged + unstaged) — `git diff HEAD`.
    let diff_args: Vec<&str> = if args.include_untracked {
        vec!["diff", "HEAD", "--no-color"]
    } else {
        vec!["diff", "--no-color"]
    };
    let diff = crate::git::runner::git_run(
        &path,
        &diff_args,
        &crate::git::runner::GitRunOpts::default(),
    )
    .await?
    .into_ok()?;

    if diff.trim().is_empty() {
        return Err(AppError::validation("stash 할 변경이 없습니다."));
    }

    let prompt = ai::stash_message_prompt(&diff);
    ai::ai_run(args.cli, &prompt).await
}

// ====== Commit Composer AI (Sprint B3 / `docs/plan/11 §18`) ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiComposerArgs {
    pub repo_id: i64,
    pub cli: ai::AiCli,
    /// 마지막 N 개 commit 을 대상으로 (oldest → newest 순서로 prompt).
    pub count: usize,
    #[serde(default)]
    pub user_approved: bool,
}

#[tauri::command]
pub async fn ai_composer_plan(
    args: AiComposerArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<ai::AiOutput> {
    if !args.user_approved {
        return Err(AppError::validation("AI 호출 전 송출 승인이 필요합니다."));
    }
    if args.count == 0 || args.count > 30 {
        return Err(AppError::validation("count 는 1~30."));
    }
    let path = repo_path(&state, args.repo_id).await?;

    // 마지막 N commit 의 (sha, subject) 추출 (oldest → newest).
    let n = format!("-n{}", args.count);
    let log = crate::git::runner::git_run(
        &path,
        &["log", &n, "--pretty=%H%x1f%s", "--reverse"],
        &crate::git::runner::GitRunOpts::default(),
    )
    .await?
    .into_ok()?;

    let mut entries: Vec<(String, String, String)> = Vec::new();
    for line in log.lines() {
        let mut parts = line.splitn(2, '\x1f');
        let sha = parts.next().unwrap_or("").trim().to_string();
        let subject = parts.next().unwrap_or("").to_string();
        if sha.is_empty() {
            continue;
        }
        // 각 commit 의 diff 추출 (parent vs commit). truncate 는 prompt 가 처리.
        // sha 자체는 git log -1 의 출력이라 신뢰 가능, 단 일관성 위해 --end-of-options 추가.
        let diff = crate::git::runner::git_run(
            &path,
            &["show", "--no-color", "--format=", "--end-of-options", &sha],
            &crate::git::runner::GitRunOpts::default(),
        )
        .await
        .ok()
        .and_then(|o| o.into_ok().ok())
        .unwrap_or_default();
        entries.push((sha, subject, diff));
    }

    if entries.is_empty() {
        return Err(AppError::validation("commit 이 없습니다."));
    }

    let prompt = ai::composer_plan_prompt(&entries);
    ai::ai_run(args.cli, &prompt).await
}
