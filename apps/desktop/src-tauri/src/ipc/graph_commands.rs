// Tauri commands — Graph (log + graph + search by message).
//
// /analyze HIGH 1 후속 — commands.rs 의 graph / log 영역 3 commands 분리.

use super::repo_path;
use crate::error::{AppError, AppResult};
use crate::git::{graph as git_graph, repository as repo};
use crate::AppState;
use serde::Deserialize;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetLogArgs {
    pub repo_id: i64,
    pub limit: Option<usize>,
    pub skip: Option<usize>,
    pub branch: Option<String>,
}

#[tauri::command]
pub async fn get_log(
    args: GetLogArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<repo::CommitSummary>> {
    let path = repo_path(&state, args.repo_id).await?;
    let limit = args.limit.unwrap_or(200).min(2000);
    let skip = args.skip.unwrap_or(0);

    tokio::task::spawn_blocking(move || -> AppResult<Vec<repo::CommitSummary>> {
        let r = repo::open(&path)?;
        repo::log(&r, limit, skip)
    })
    .await
    .map_err(|e| AppError::internal(format!("spawn_blocking: {e}")))?
}

// ====== Commit graph ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetGraphArgs {
    pub repo_id: i64,
    pub limit: Option<usize>,
}

#[tauri::command]
pub async fn get_graph(
    args: GetGraphArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_graph::GraphResult> {
    let path = repo_path(&state, args.repo_id).await?;
    let limit = args.limit.unwrap_or(500).min(5000);
    tokio::task::spawn_blocking(move || git_graph::compute_graph(&path, limit))
        .await
        .map_err(|e| AppError::internal(format!("spawn_blocking: {e}")))?
}

// Sprint F-P5 — commit message 검색 (`git log --grep` 동등, git2 revwalk 기반).
// CommandPalette 의 'msg:' prefix mode 가 호출. 한글 안전 (UTF-8).

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchCommitsByMessageArgs {
    pub repo_id: i64,
    pub pattern: String,
    pub limit: Option<usize>,
    #[serde(default = "default_case_insensitive")]
    pub case_insensitive: bool,
}

fn default_case_insensitive() -> bool {
    true
}

#[tauri::command]
pub async fn search_commits_by_message(
    args: SearchCommitsByMessageArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<repo::CommitSummary>> {
    let path = repo_path(&state, args.repo_id).await?;
    let limit = args.limit.unwrap_or(50).min(500);
    let pattern = args.pattern;
    let ci = args.case_insensitive;
    tokio::task::spawn_blocking(move || {
        let r = repo::open(&path)?;
        repo::search_commits_by_message(&r, &pattern, limit, ci)
    })
    .await
    .map_err(|e| AppError::internal(format!("spawn_blocking: {e}")))?
}
