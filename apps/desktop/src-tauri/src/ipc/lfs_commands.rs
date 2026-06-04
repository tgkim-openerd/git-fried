// LFS IPC commands — `git lfs status / list / track / untrack / install / fetch
// / pull / prune / push_size` 9 커맨드.
// 2026-05-04 /analyze 후속 — v02_commands.rs 에서 분리.

use super::repo_path;
use crate::error::AppResult;
use crate::git::lfs as git_lfs;
use crate::AppState;
use serde::Deserialize;
use std::sync::Arc;

#[tauri::command]
pub async fn lfs_status(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_lfs::LfsStatus> {
    let path = repo_path(&state, repo_id).await?;
    git_lfs::status(&path).await
}

#[tauri::command]
pub async fn lfs_list_files(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_lfs::LfsFile>> {
    let path = repo_path(&state, repo_id).await?;
    git_lfs::list_files(&path).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LfsPatternArgs {
    pub repo_id: i64,
    pub pattern: String,
}

#[tauri::command]
pub async fn lfs_track(
    args: LfsPatternArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let path = repo_path(&state, args.repo_id).await?;
    git_lfs::track(&path, &args.pattern).await
}

#[tauri::command]
pub async fn lfs_untrack(
    args: LfsPatternArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let path = repo_path(&state, args.repo_id).await?;
    git_lfs::untrack(&path, &args.pattern).await
}

#[tauri::command]
pub async fn lfs_install(repo_id: i64, state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(repo_id).await;
    let path = repo_path(&state, repo_id).await?;
    git_lfs::install(&path).await
}

#[tauri::command]
pub async fn lfs_fetch(repo_id: i64, state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
    let path = repo_path(&state, repo_id).await?;
    git_lfs::fetch(&path).await
}

#[tauri::command]
pub async fn lfs_pull(repo_id: i64, state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(repo_id).await;
    let path = repo_path(&state, repo_id).await?;
    git_lfs::pull(&path).await
}

#[tauri::command]
pub async fn lfs_prune(repo_id: i64, state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(repo_id).await;
    let path = repo_path(&state, repo_id).await?;
    git_lfs::prune(&path).await
}

#[tauri::command]
pub async fn lfs_push_size(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_lfs::LfsPushSize> {
    let path = repo_path(&state, repo_id).await?;
    git_lfs::push_size(&path).await
}
