// Tauri commands — Tag panel (`docs/plan/14 §8 G1` Sprint C14).
//
// /analyze HIGH 1 후속 — commands.rs 의 tag 영역 5 commands 분리.

use crate::error::AppResult;
use crate::git::tag as git_tag;
use crate::storage::DbExt;
use crate::AppState;
use serde::Deserialize;
use std::path::Path;
use std::sync::Arc;

#[tauri::command]
pub async fn list_tags(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_tag::TagInfo>> {
    let r = state.db.get_repo(repo_id).await?;
    git_tag::list_tags(Path::new(&r.local_path)).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTagArgs {
    pub repo_id: i64,
    pub name: String,
    /// HEAD 외 다른 ref/SHA. None → HEAD
    #[serde(default)]
    pub target: Option<String>,
    /// Some 이면 annotated, None 이면 lightweight
    #[serde(default)]
    pub message: Option<String>,
}

#[tauri::command]
pub async fn create_tag(
    args: CreateTagArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let r = state.db.get_repo(args.repo_id).await?;
    git_tag::create_tag(
        Path::new(&r.local_path),
        &args.name,
        args.target.as_deref(),
        args.message.as_deref(),
    )
    .await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagNameArgs {
    pub repo_id: i64,
    pub name: String,
}

#[tauri::command]
pub async fn delete_tag(
    args: TagNameArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let r = state.db.get_repo(args.repo_id).await?;
    git_tag::delete_tag(Path::new(&r.local_path), &args.name).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PushTagArgs {
    pub repo_id: i64,
    pub remote: String,
    pub name: String,
}

#[tauri::command]
pub async fn push_tag(args: PushTagArgs, state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
    let r = state.db.get_repo(args.repo_id).await?;
    git_tag::push_tag(Path::new(&r.local_path), &args.remote, &args.name).await
}

#[tauri::command]
pub async fn delete_remote_tag(
    args: PushTagArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let r = state.db.get_repo(args.repo_id).await?;
    git_tag::delete_remote_tag(Path::new(&r.local_path), &args.remote, &args.name).await
}
