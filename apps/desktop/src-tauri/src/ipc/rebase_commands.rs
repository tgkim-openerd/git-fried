// Interactive rebase IPC commands — 6 커맨드 (`docs/plan/09 옵션 A`).
// 2026-05-04 /analyze 후속 — v02_commands.rs 에서 분리.

use super::repo_path;
use crate::error::AppResult;
use crate::git::rebase as git_rebase;
use crate::AppState;
use serde::Deserialize;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RebasePrepareArgs {
    pub repo_id: i64,
    pub count: usize,
}

#[tauri::command]
pub async fn rebase_prepare_todo(
    args: RebasePrepareArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_rebase::RebaseTodoEntry>> {
    let path = repo_path(&state, args.repo_id).await?;
    git_rebase::prepare_todo(&path, args.count).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RebaseRunArgs {
    pub repo_id: i64,
    pub base: String,
    pub todo: Vec<git_rebase::RebaseTodoEntry>,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RebaseRunResult {
    pub success: bool,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub status: git_rebase::RebaseStatus,
}

#[tauri::command]
pub async fn rebase_run(
    args: RebaseRunArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<RebaseRunResult> {
    let path = repo_path(&state, args.repo_id).await?;
    let out = git_rebase::run_interactive(&path, &args.base, &args.todo).await?;
    let status = git_rebase::status(&path)?;
    Ok(RebaseRunResult {
        success: out.exit_code == Some(0) && !status.in_progress,
        exit_code: out.exit_code,
        stdout: out.stdout,
        stderr: out.stderr,
        status,
    })
}

#[tauri::command]
pub async fn rebase_status(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_rebase::RebaseStatus> {
    let path = repo_path(&state, repo_id).await?;
    git_rebase::status(&path)
}

#[tauri::command]
pub async fn rebase_continue(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<RebaseRunResult> {
    let path = repo_path(&state, repo_id).await?;
    let out = git_rebase::rebase_continue(&path).await?;
    let status = git_rebase::status(&path)?;
    Ok(RebaseRunResult {
        success: out.exit_code == Some(0) && !status.in_progress,
        exit_code: out.exit_code,
        stdout: out.stdout,
        stderr: out.stderr,
        status,
    })
}

#[tauri::command]
pub async fn rebase_abort(repo_id: i64, state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
    let path = repo_path(&state, repo_id).await?;
    git_rebase::rebase_abort(&path).await
}

#[tauri::command]
pub async fn rebase_skip(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<RebaseRunResult> {
    let path = repo_path(&state, repo_id).await?;
    let out = git_rebase::rebase_skip(&path).await?;
    let status = git_rebase::status(&path)?;
    Ok(RebaseRunResult {
        success: out.exit_code == Some(0) && !status.in_progress,
        exit_code: out.exit_code,
        stdout: out.stdout,
        stderr: out.stderr,
        status,
    })
}
