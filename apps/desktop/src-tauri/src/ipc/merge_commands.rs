// Sprint c48 Wave D-4 — v02_commands.rs 의 4개 3-way merge IPC 분리.
//
// read_conflicted / write_resolved / take_side / launch_mergetool.
// lib.rs path 보존을 위해 v02_commands.rs 는 `pub use crate::ipc::merge_commands::*` 재내보냄.
use super::repo_path;
use crate::error::{AppError, AppResult};
use crate::git::merge as git_merge;
use crate::AppState;
use serde::Deserialize;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictedFileArgs {
    pub repo_id: i64,
    pub path: String,
}

#[tauri::command]
pub async fn read_conflicted(
    args: ConflictedFileArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_merge::ConflictedFile> {
    let path = repo_path(&state, args.repo_id).await?;
    let p = args.path;
    tokio::task::spawn_blocking(move || git_merge::read_conflicted(&path, &p))
        .await
        .map_err(|e| AppError::internal(format!("spawn_blocking: {e}")))?
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteResolvedArgs {
    pub repo_id: i64,
    pub path: String,
    pub content: String,
}

#[tauri::command]
pub async fn write_resolved(
    args: WriteResolvedArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_merge::write_resolved(&path, &args.path, &args.content).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TakeSideArgs {
    pub repo_id: i64,
    pub path: String,
    pub side: git_merge::SideTake,
}

#[tauri::command]
pub async fn take_side(
    args: TakeSideArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_merge::take_side(&path, &args.path, args.side).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchMergetoolArgs {
    pub repo_id: i64,
    /// merge tool 이름 (선택, git config merge.tool 사용 시 None).
    pub tool: Option<String>,
    /// 특정 파일만 (선택, 전체 conflicted 파일 처리 시 None).
    pub file: Option<String>,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MergetoolResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

#[tauri::command]
pub async fn launch_mergetool(
    args: LaunchMergetoolArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<MergetoolResult> {
    let path = repo_path(&state, args.repo_id).await?;
    let out =
        git_merge::launch_mergetool(&path, args.tool.as_deref(), args.file.as_deref()).await?;
    Ok(MergetoolResult {
        success: out.exit_code == Some(0),
        stdout: out.stdout,
        stderr: out.stderr,
        exit_code: out.exit_code,
    })
}
