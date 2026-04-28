// Repo alias IPC — Sprint B4 / `docs/plan/11 §15`.

use crate::alias::{self, RepoAlias};
use crate::error::AppResult;
use crate::AppState;
use serde::Deserialize;
use std::sync::Arc;

#[tauri::command]
pub async fn list_all_repo_aliases(
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<RepoAlias>> {
    alias::list_all(&state.db).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveAliasArgs {
    pub repo_id: i64,
    pub profile_id: Option<i64>,
}

#[tauri::command]
pub async fn resolve_repo_alias(
    args: ResolveAliasArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Option<String>> {
    alias::resolve(&state.db, args.repo_id, args.profile_id).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetAliasArgs {
    pub repo_id: i64,
    /// None = global default.
    pub profile_id: Option<i64>,
    pub alias: String,
}

#[tauri::command]
pub async fn set_repo_alias(
    args: SetAliasArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<RepoAlias> {
    alias::set(&state.db, args.repo_id, args.profile_id, &args.alias).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnsetAliasArgs {
    pub repo_id: i64,
    pub profile_id: Option<i64>,
}

#[tauri::command]
pub async fn unset_repo_alias(
    args: UnsetAliasArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    alias::unset(&state.db, args.repo_id, args.profile_id).await
}
