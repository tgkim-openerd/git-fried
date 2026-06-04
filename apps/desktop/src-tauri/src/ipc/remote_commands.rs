// Tauri commands — Remote 관리 + Maintenance + Repository-Specific Preferences.
//
// /analyze HIGH 1 후속 — commands.rs 의 remote (5) + maintenance (2) +
// repo_config (2) 영역 9 commands 분리.
//
// /code-review ARCH-002 후속 — `state.db.get_repo + Path::new(&r.local_path)`
// 2-step 패턴 9 사이트를 `super::repo_path()` helper 로 통일 (mod.rs 의 의도).

use super::repo_path;
use crate::error::AppResult;
use crate::git::{config_local as git_cfg_local, maintenance as git_maint, remote as git_remote};
use crate::AppState;
use serde::Deserialize;
use std::sync::Arc;

// ====== Remote 관리 (`docs/plan/14 §4` Sprint B14-1) ======

#[tauri::command]
pub async fn list_remotes(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_remote::RemoteInfo>> {
    let path = repo_path(&state, repo_id).await?;
    git_remote::list_remotes(&path).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddRemoteArgs {
    pub repo_id: i64,
    pub name: String,
    pub url: String,
}

#[tauri::command]
pub async fn add_remote(
    args: AddRemoteArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let path = repo_path(&state, args.repo_id).await?;
    git_remote::add_remote(&path, &args.name, &args.url).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteNameArgs {
    pub repo_id: i64,
    pub name: String,
}

#[tauri::command]
pub async fn remove_remote(
    args: RemoteNameArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let path = repo_path(&state, args.repo_id).await?;
    git_remote::remove_remote(&path, &args.name).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameRemoteArgs {
    pub repo_id: i64,
    pub old_name: String,
    pub new_name: String,
}

#[tauri::command]
pub async fn rename_remote(
    args: RenameRemoteArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let path = repo_path(&state, args.repo_id).await?;
    git_remote::rename_remote(&path, &args.old_name, &args.new_name).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetRemoteUrlArgs {
    pub repo_id: i64,
    pub name: String,
    pub url: String,
}

#[tauri::command]
pub async fn set_remote_url(
    args: SetRemoteUrlArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let path = repo_path(&state, args.repo_id).await?;
    git_remote::set_remote_url(&path, &args.name, &args.url).await
}

// ====== Repo Maintenance (`docs/plan/14 §2 A2` Sprint B14-2) ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaintenanceArgs {
    pub repo_id: i64,
    #[serde(default)]
    pub aggressive: bool,
}

#[tauri::command]
pub async fn maintenance_gc(
    args: MaintenanceArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_maint::MaintenanceResult> {
    let path = repo_path(&state, args.repo_id).await?;
    git_maint::gc(&path, args.aggressive).await
}

#[tauri::command]
pub async fn maintenance_fsck(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_maint::MaintenanceResult> {
    let path = repo_path(&state, repo_id).await?;
    git_maint::fsck(&path).await
}

// ====== Repository-Specific Preferences (`docs/plan/14 §3` Sprint B14-3) ======

#[tauri::command]
pub async fn read_repo_config(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_cfg_local::RepoConfigSnapshot> {
    let path = repo_path(&state, repo_id).await?;
    git_cfg_local::read_snapshot(&path).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyRepoConfigArgs {
    pub repo_id: i64,
    pub snapshot: git_cfg_local::RepoConfigSnapshot,
}

#[tauri::command]
pub async fn apply_repo_config(
    args: ApplyRepoConfigArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let path = repo_path(&state, args.repo_id).await?;
    git_cfg_local::apply_snapshot(&path, &args.snapshot).await
}
