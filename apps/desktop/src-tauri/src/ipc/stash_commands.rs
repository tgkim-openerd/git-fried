// Tauri commands — Stash CRUD + Smart Stash (`docs/plan/14 §5` + `plan/29 E3`).
//
// /analyze HIGH 1 후속 — commands.rs 의 stash 영역 10 commands 분리.

use super::repo_path;
use crate::error::AppResult;
use crate::git::stash as git_stash;
use crate::AppState;
use serde::Deserialize;
use std::sync::Arc;

#[tauri::command]
pub async fn list_stash(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_stash::StashEntry>> {
    let path = repo_path(&state, repo_id).await?;
    git_stash::list_stash(&path).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PushStashArgs {
    pub repo_id: i64,
    pub message: Option<String>,
    #[serde(default)]
    pub include_untracked: bool,
}

#[tauri::command]
pub async fn push_stash(
    args: PushStashArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_stash::push_stash(&path, args.message.as_deref(), args.include_untracked).await
}

// ====== Smart Stash (Sprint c38 / plan/29 E3) ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PushStashStagedArgs {
    pub repo_id: i64,
    #[serde(default)]
    pub message: Option<String>,
}

/// `git stash push -S` — 인덱스(staged)만 stash. Git 2.35+ 필요.
#[tauri::command]
pub async fn push_stash_staged(
    args: PushStashStagedArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_stash::push_stash_staged(&path, args.message.as_deref()).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StashToBranchArgs {
    pub repo_id: i64,
    pub index: usize,
    pub branch: String,
}

/// `git stash branch <name> stash@{n}` — stash 시점 base 의 새 브랜치로 pop.
#[tauri::command]
pub async fn stash_to_branch(
    args: StashToBranchArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_stash::stash_to_branch(&path, args.index, &args.branch).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StashIndexArgs {
    pub repo_id: i64,
    pub index: usize,
}

#[tauri::command]
pub async fn apply_stash(
    args: StashIndexArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_stash::apply_stash(&path, args.index).await
}

#[tauri::command]
pub async fn pop_stash(
    args: StashIndexArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_stash::pop_stash(&path, args.index).await
}

#[tauri::command]
pub async fn drop_stash(
    args: StashIndexArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_stash::drop_stash(&path, args.index).await
}

#[tauri::command]
pub async fn show_stash(
    args: StashIndexArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<String> {
    let path = repo_path(&state, args.repo_id).await?;
    git_stash::show_stash(&path, args.index).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StashFileArgs {
    pub repo_id: i64,
    pub index: usize,
    pub path: String,
}

/// stash@{n} 의 단일 파일만 working tree 에 apply (`docs/plan/14 §5 D1`).
#[tauri::command]
pub async fn apply_stash_file(
    args: StashFileArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_stash::apply_stash_file(&path, args.index, &args.path).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditStashMessageArgs {
    pub repo_id: i64,
    pub index: usize,
    pub message: String,
}

/// stash@{n} 의 메시지 수정 (`docs/plan/14 §5 D2`).
#[tauri::command]
pub async fn edit_stash_message(
    args: EditStashMessageArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_stash::edit_stash_message(&path, args.index, &args.message).await
}
