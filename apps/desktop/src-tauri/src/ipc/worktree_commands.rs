// Sprint c48 Wave D-4 — v02_commands.rs 의 6개 worktree IPC 분리.
//
// list / add / remove / prune / lock / unlock_worktree.
// lib.rs 의 generate_handler! 에 등록된 path `ipc::v02_commands::list_worktrees` 등
// 보존을 위해 v02_commands.rs 는 `pub use crate::ipc::worktree_commands::*` 재내보냄.
use super::repo_path;
use crate::error::AppResult;
use crate::git::worktree as git_wt;
use crate::AppState;
use serde::Deserialize;
use std::sync::Arc;

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
    let _guard = state.repo_mutation_guard(args.repo_id).await;
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
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let path = repo_path(&state, args.repo_id).await?;
    git_wt::remove_worktree(&path, &args.path, args.force).await
}

#[tauri::command]
pub async fn prune_worktrees(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(repo_id).await;
    let path = repo_path(&state, repo_id).await?;
    git_wt::prune_worktrees(&path).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LockWorktreeArgs {
    pub repo_id: i64,
    pub path: String,
    pub reason: Option<String>,
}

#[tauri::command]
pub async fn lock_worktree(
    args: LockWorktreeArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let path = repo_path(&state, args.repo_id).await?;
    git_wt::lock_worktree(&path, &args.path, args.reason.as_deref()).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnlockWorktreeArgs {
    pub repo_id: i64,
    pub path: String,
}

#[tauri::command]
pub async fn unlock_worktree(
    args: UnlockWorktreeArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let path = repo_path(&state, args.repo_id).await?;
    git_wt::unlock_worktree(&path, &args.path).await
}
