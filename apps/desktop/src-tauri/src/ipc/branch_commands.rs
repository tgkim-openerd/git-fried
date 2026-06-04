// Tauri commands — Branch CRUD + drag-drop ops (merge / rebase / cherry-pick).
//
// /analyze HIGH 1 후속 — commands.rs 의 branch 영역 8 commands 분리.

use super::repo_path;
use crate::error::{AppError, AppResult};
use crate::git::branch as git_branch;
use crate::AppState;
use serde::Deserialize;
use std::sync::Arc;

// ====== Sprint B8 — Branch / Commit drag-drop ops ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeBranchArgs {
    pub repo_id: i64,
    /// 머지 source (현재 HEAD 에 합쳐질 ref).
    pub source: String,
    #[serde(default)]
    pub no_ff: bool,
    #[serde(default)]
    pub no_commit: bool,
    /// Plan #42 M-1.2 squashByDefault wire (Sprint c98) — `git merge --squash`.
    /// true 시 no-ff / no-commit 자동 포함 (git 동작), 호출자가 별도 commit 호출.
    #[serde(default)]
    pub squash: bool,
}

#[tauri::command]
pub async fn merge_branch(
    args: MergeBranchArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_branch::MergeResult> {
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let path = repo_path(&state, args.repo_id).await?;
    git_branch::merge_into_head(&path, &args.source, args.no_ff, args.no_commit, args.squash).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RebaseBranchArgs {
    pub repo_id: i64,
    pub upstream: String,
}

#[tauri::command]
pub async fn rebase_branch(
    args: RebaseBranchArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_branch::MergeResult> {
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let path = repo_path(&state, args.repo_id).await?;
    git_branch::rebase_onto(&path, &args.upstream).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CherryPickShaArgs {
    pub repo_id: i64,
    pub sha: String,
    /// 지정 시 그 브랜치로 switch 후 cherry-pick → 복귀. 없으면 현재 HEAD 에.
    pub target_branch: Option<String>,
}

#[tauri::command]
pub async fn cherry_pick_sha(
    args: CherryPickShaArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_branch::MergeResult> {
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let path = repo_path(&state, args.repo_id).await?;
    git_branch::cherry_pick_sha(&path, &args.sha, args.target_branch.as_deref()).await
}

// ====== Branches ======

#[tauri::command]
pub async fn list_branches(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_branch::BranchInfo>> {
    let path = repo_path(&state, repo_id).await?;
    tokio::task::spawn_blocking(move || git_branch::list_branches(&path))
        .await
        .map_err(|e| AppError::internal(format!("spawn_blocking: {e}")))?
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwitchBranchArgs {
    pub repo_id: i64,
    pub name: String,
    #[serde(default)]
    pub create: bool,
}

#[tauri::command]
pub async fn switch_branch(
    args: SwitchBranchArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let path = repo_path(&state, args.repo_id).await?;
    git_branch::switch_branch(&path, &args.name, args.create).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBranchArgs {
    pub repo_id: i64,
    pub name: String,
    pub start: Option<String>,
}

#[tauri::command]
pub async fn create_branch(
    args: CreateBranchArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let path = repo_path(&state, args.repo_id).await?;
    git_branch::create_branch(&path, &args.name, args.start.as_deref()).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteBranchArgs {
    pub repo_id: i64,
    pub name: String,
    #[serde(default)]
    pub force: bool,
}

#[tauri::command]
pub async fn delete_branch(
    args: DeleteBranchArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let path = repo_path(&state, args.repo_id).await?;
    git_branch::delete_branch(&path, &args.name, args.force).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameBranchArgs {
    pub repo_id: i64,
    pub old_name: String,
    pub new_name: String,
}

#[tauri::command]
pub async fn rename_branch(
    args: RenameBranchArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let path = repo_path(&state, args.repo_id).await?;
    git_branch::rename_branch(&path, &args.old_name, &args.new_name).await
}
