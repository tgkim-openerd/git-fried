// Tauri commands — Commit + last_commit_message + count_hangul + history
// (compare_refs / reset / revert / undo / redo).
//
// /analyze HIGH 1 후속 — commands.rs 의 commit + identity stats + history
// 영역 8 commands 분리.

use super::repo_path;
use crate::error::AppResult;
use crate::git::{
    commit as git_commit, identity_stats as git_identity, reflog as git_reflog, reset as git_reset,
};
use crate::AppState;
use serde::Deserialize;
use std::sync::Arc;

// ====== Commit ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitArgs {
    pub repo_id: i64,
    pub message: String,
    #[serde(default)]
    pub amend: bool,
    #[serde(default)]
    pub allow_empty: bool,
    #[serde(default)]
    pub no_verify: bool,
    #[serde(default)]
    pub signoff: bool,
    pub author: Option<String>,
}

#[tauri::command]
pub async fn commit(
    args: CommitArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_commit::CommitResult> {
    let path = repo_path(&state, args.repo_id).await?;
    git_commit::commit(
        &path,
        &args.message,
        git_commit::CommitOpts {
            amend: args.amend,
            allow_empty: args.allow_empty,
            no_verify: args.no_verify,
            signoff: args.signoff,
            author: args.author,
        },
    )
    .await
}

#[tauri::command]
pub async fn last_commit_message(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<String> {
    let path = repo_path(&state, repo_id).await?;
    git_commit::last_commit_message(&path).await
}

// ====== Compare (`docs/plan/14 §2 A1`) ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareRefsArgs {
    pub repo_id: i64,
    pub ref1: String,
    pub ref2: String,
}

/// 두 ref 비교 — commits + diff + ahead/behind.
#[tauri::command]
pub async fn compare_refs(
    args: CompareRefsArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<crate::git::compare::CompareResult> {
    let path = repo_path(&state, args.repo_id).await?;
    crate::git::compare::compare_refs(&path, &args.ref1, &args.ref2).await
}

// ====== Reset / Revert ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResetArgs {
    pub repo_id: i64,
    pub mode: git_reset::ResetMode,
    pub target: String,
}

#[tauri::command]
pub async fn reset(args: ResetArgs, state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_reset::reset(&path, args.mode, &args.target).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RevertArgs {
    pub repo_id: i64,
    pub sha: String,
    #[serde(default)]
    pub no_commit: bool,
}

#[tauri::command]
pub async fn revert(args: RevertArgs, state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_reset::revert(&path, &args.sha, args.no_commit).await
}

// ====== Sprint c25-1.5 — Undo / Redo last action (reflog 기반) ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UndoLastActionArgs {
    pub repo_id: i64,
}

#[tauri::command]
pub async fn undo_last_action(
    args: UndoLastActionArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_reflog::UndoResult> {
    let path = repo_path(&state, args.repo_id).await?;
    git_reflog::undo_last_action(&path).await
}

#[tauri::command]
pub async fn redo_last_action(
    args: UndoLastActionArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_reflog::UndoResult> {
    let path = repo_path(&state, args.repo_id).await?;
    git_reflog::redo_last_action(&path).await
}

// ====== Identity stats (Sprint c36) ======

#[derive(Debug, Deserialize)]
pub struct CountHangulCommitsArgs {
    pub repo_id: i64,
}

/// IdentityCard 의 dogfood 통계 — 한글 commit 비율 (plan/26 Phase 2).
#[tauri::command]
pub async fn count_hangul_commits(
    args: CountHangulCommitsArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_identity::HangulCommitStats> {
    let path = repo_path(&state, args.repo_id).await?;
    git_identity::count_hangul_commits(&path).await
}
