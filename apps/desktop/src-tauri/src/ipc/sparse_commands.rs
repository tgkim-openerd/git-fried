// Plan #42 M-2 (Sprint c100+) — Sparse Checkout IPC commands

use super::repo_path;
use crate::error::AppResult;
use crate::git::sparse as git_sparse;
use crate::AppState;
use serde::Deserialize;
use std::sync::Arc;

#[tauri::command]
pub async fn sparse_status(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_sparse::SparseStatus> {
    let path = repo_path(&state, repo_id).await?;
    git_sparse::sparse_status(&path).await
}

#[tauri::command]
pub async fn sparse_init_cone(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(repo_id).await;
    let path = repo_path(&state, repo_id).await?;
    git_sparse::sparse_init_cone(&path).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SparseSetArgs {
    pub repo_id: i64,
    pub paths: Vec<String>,
}

#[tauri::command]
pub async fn sparse_set(
    args: SparseSetArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let path = repo_path(&state, args.repo_id).await?;
    git_sparse::sparse_set(&path, &args.paths).await
}

#[tauri::command]
pub async fn sparse_disable(repo_id: i64, state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(repo_id).await;
    let path = repo_path(&state, repo_id).await?;
    git_sparse::sparse_disable(&path).await
}

#[tauri::command]
pub async fn sparse_reapply(repo_id: i64, state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(repo_id).await;
    let path = repo_path(&state, repo_id).await?;
    git_sparse::sparse_reapply(&path).await
}
