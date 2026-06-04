// Tauri commands — Submodule (list / init / update / sync).
//
// /analyze HIGH 1 후속 — commands.rs 의 submodule 영역 4 commands 분리.

use super::repo_path;
use crate::error::AppResult;
use crate::git::submodule as git_sub;
use crate::AppState;
use serde::Deserialize;
use std::sync::Arc;

#[tauri::command]
pub async fn list_submodules(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_sub::SubmoduleEntry>> {
    let path = repo_path(&state, repo_id).await?;
    git_sub::list_submodules(&path).await
}

#[tauri::command]
pub async fn init_submodules(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(repo_id).await;
    let path = repo_path(&state, repo_id).await?;
    git_sub::init_submodules(&path).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSubmodulesArgs {
    pub repo_id: i64,
    #[serde(default)]
    pub remote: bool,
}

#[tauri::command]
pub async fn update_submodules(
    args: UpdateSubmodulesArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let path = repo_path(&state, args.repo_id).await?;
    git_sub::update_submodules(&path, args.remote).await
}

#[tauri::command]
pub async fn sync_submodules(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(repo_id).await;
    let path = repo_path(&state, repo_id).await?;
    git_sub::sync_submodules(&path).await
}
