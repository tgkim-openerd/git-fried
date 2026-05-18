// Tauri commands — Tag panel (`docs/plan/14 §8 G1` Sprint C14).
//
// /analyze HIGH 1 후속 — commands.rs 의 tag 영역 5 commands 분리.
// /code-review ARCH-002 후속 — `state.db.get_repo + Path::new` 2-step 패턴
// 5 사이트를 `super::repo_path()` helper 로 통일.

use super::repo_path;
use crate::error::AppResult;
use crate::git::tag as git_tag;
use crate::AppState;
use serde::Deserialize;
use std::sync::Arc;

#[tauri::command]
pub async fn list_tags(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_tag::TagInfo>> {
    let path = repo_path(&state, repo_id).await?;
    git_tag::list_tags(&path).await
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
    let path = repo_path(&state, args.repo_id).await?;
    git_tag::create_tag(
        &path,
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnnotateTagArgs {
    pub repo_id: i64,
    pub name: String,
    pub commit_sha: String,
    pub message: String,
}

/// SB-033 (Sprint c95, 2026-05-18) — 기존 tag annotate (GitKraken parity).
#[tauri::command]
pub async fn annotate_existing_tag(
    args: AnnotateTagArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_tag::annotate_existing_tag(&path, &args.name, &args.commit_sha, &args.message).await
}

#[tauri::command]
pub async fn delete_tag(
    args: TagNameArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_tag::delete_tag(&path, &args.name).await
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
    let path = repo_path(&state, args.repo_id).await?;
    git_tag::push_tag(&path, &args.remote, &args.name).await
}

#[tauri::command]
pub async fn delete_remote_tag(
    args: PushTagArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_tag::delete_remote_tag(&path, &args.remote, &args.name).await
}
