// v0.2 stretch IPC — Worktree / Cherry-pick / AI subprocess.

use crate::ai;
use crate::error::{AppError, AppResult};
use crate::git::{cherry_pick as git_cp, file_history as git_fh, worktree as git_wt};
use crate::AppState;
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::Arc;

async fn repo_path(state: &Arc<AppState>, repo_id: i64) -> AppResult<PathBuf> {
    use crate::storage::DbExt;
    Ok(PathBuf::from(state.db.get_repo(repo_id).await?.local_path))
}

// ====== Worktree ======

#[tauri::command]
pub async fn list_worktrees(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_wt::WorktreeEntry>> {
    let path = repo_path(&state, repo_id).await?;
    git_wt::list_worktrees(&path).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddWorktreeArgs {
    pub repo_id: i64,
    pub path: String,
    pub create_branch: Option<String>,
    pub branch: Option<String>,
    pub start_point: Option<String>,
}

#[tauri::command]
pub async fn add_worktree(
    args: AddWorktreeArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_wt::add_worktree(
        &path,
        &git_wt::AddWorktreeOpts {
            path: args.path,
            create_branch: args.create_branch,
            branch: args.branch,
            start_point: args.start_point,
        },
    )
    .await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveWorktreeArgs {
    pub repo_id: i64,
    pub path: String,
    #[serde(default)]
    pub force: bool,
}

#[tauri::command]
pub async fn remove_worktree(
    args: RemoveWorktreeArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_wt::remove_worktree(&path, &args.path, args.force).await
}

#[tauri::command]
pub async fn prune_worktrees(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, repo_id).await?;
    git_wt::prune_worktrees(&path).await
}

// ====== Cherry-pick (단일 + 멀티 레포) ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkCherryPickArgs {
    pub repo_ids: Vec<i64>,
    pub sha: String,
    pub strategy: git_cp::CherryPickStrategy,
    #[serde(default)]
    pub no_commit: bool,
}

#[tauri::command]
pub async fn bulk_cherry_pick(
    args: BulkCherryPickArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_cp::CherryPickResult>> {
    git_cp::bulk_cherry_pick(
        &state.db,
        &args.repo_ids,
        &args.sha,
        args.strategy,
        args.no_commit,
    )
    .await
}

// ====== File history / Blame ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileHistoryArgs {
    pub repo_id: i64,
    pub path: String,
    pub limit: Option<usize>,
}

#[tauri::command]
pub async fn get_file_history(
    args: FileHistoryArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<crate::git::repository::CommitSummary>> {
    let path = repo_path(&state, args.repo_id).await?;
    let limit = args.limit.unwrap_or(200).min(1000);
    git_fh::file_history(&path, &args.path, limit).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileBlameArgs {
    pub repo_id: i64,
    pub path: String,
}

#[tauri::command]
pub async fn get_file_blame(
    args: FileBlameArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_fh::BlameLine>> {
    let path = repo_path(&state, args.repo_id).await?;
    git_fh::file_blame(&path, &args.path).await
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
        return Err(AppError::validation(
            "AI 호출 전 송출 승인이 필요합니다.",
        ));
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
        return Err(AppError::validation(
            "AI 호출 전 송출 승인이 필요합니다.",
        ));
    }
    let path = repo_path(&state, args.repo_id).await?;

    // base..head 커밋 subject 목록
    let log_arg = format!("{}..{}", args.base_branch, args.head_branch);
    let log = crate::git::runner::git_run(
        &path,
        &["log", &log_arg, "--pretty=%s", "--reverse"],
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
        &["diff", "--stat", &log_arg],
        &crate::git::runner::GitRunOpts::default(),
    )
    .await
    .ok()
    .and_then(|o| o.into_ok().ok())
    .unwrap_or_default();

    let prompt = ai::pr_body_prompt(&commits, &stat, &args.head_branch, &args.base_branch);
    ai::ai_run(args.cli, &prompt).await
}
