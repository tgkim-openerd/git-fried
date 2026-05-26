// Tauri commands — Sync (fetch / pull / push) + Bulk (multi-repo).
//
// /analyze HIGH 1 후속 — commands.rs 의 sync + bulk 영역 7 commands 분리.

use super::repo_path;
use crate::error::AppResult;
use crate::git::{bulk as git_bulk, status as git_status, sync as git_sync};
use crate::storage::db::DbExt;
use crate::AppState;
use serde::Deserialize;
use std::sync::Arc;

/// Sprint 2026-05-26 HIGH-F — SSH key resolver wrapper.
async fn resolve_ssh_key(state: &AppState, repo_id: i64) -> AppResult<Option<String>> {
    let repo = state.db.get_repo(repo_id).await?;
    crate::profiles::resolve_ssh_key_for_repo(&state.db.pool, &repo).await
}

// ====== Sync (push / pull / fetch) ======

#[tauri::command]
#[tracing::instrument(target = "git_fried_lib::ipc::sync", skip(state), err)]
pub async fn fetch_all(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_sync::SyncResult> {
    let path = repo_path(&state, repo_id).await?;
    let ssh = resolve_ssh_key(state.inner(), repo_id).await?;
    git_sync::fetch_all(&path, ssh.as_deref()).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PullArgs {
    pub repo_id: i64,
    pub remote: Option<String>,
    pub branch: Option<String>,
    /// Phase 12-3 — Pull dropdown 옵션 (rebase / ff_only / no_rebase). 모두 None → 기본 pull.
    #[serde(default)]
    pub rebase: bool,
    #[serde(default)]
    pub ff_only: bool,
    #[serde(default)]
    pub no_rebase: bool,
}

#[tauri::command]
// Sprint c79 SEC-002 — skip_all + safe fields (clone_repo 와 일관, args.branch 의 사용자
// 입력값에 PAT inline 가능성 사전 차단).
#[tracing::instrument(
    target = "git_fried_lib::ipc::sync",
    skip_all,
    fields(repo_id = args.repo_id, rebase = args.rebase, ff_only = args.ff_only),
    err
)]
pub async fn pull(
    args: PullArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_sync::SyncResult> {
    let path = repo_path(&state, args.repo_id).await?;
    let opts = git_sync::PullOpts {
        rebase: args.rebase,
        ff_only: args.ff_only,
        no_rebase: args.no_rebase,
    };
    let ssh = resolve_ssh_key(state.inner(), args.repo_id).await?;
    git_sync::pull(
        &path,
        args.remote.as_deref(),
        args.branch.as_deref(),
        opts,
        ssh.as_deref(),
    )
    .await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PushArgs {
    pub repo_id: i64,
    pub remote: Option<String>,
    pub branch: Option<String>,
    #[serde(default)]
    pub force_with_lease: bool,
    #[serde(default)]
    pub set_upstream: bool,
    #[serde(default)]
    pub tags: bool,
}

#[tauri::command]
// Sprint c79 SEC-002 — skip_all + safe fields (push flag 만 record, remote/branch 사용자
// 입력값은 skip).
#[tracing::instrument(
    target = "git_fried_lib::ipc::sync",
    skip_all,
    fields(
        repo_id = args.repo_id,
        force_with_lease = args.force_with_lease,
        set_upstream = args.set_upstream,
        tags = args.tags,
    ),
    err
)]
pub async fn push(
    args: PushArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_sync::SyncResult> {
    let path = repo_path(&state, args.repo_id).await?;
    let ssh = resolve_ssh_key(state.inner(), args.repo_id).await?;
    git_sync::push(
        &path,
        args.remote.as_deref(),
        args.branch.as_deref(),
        git_sync::PushOpts {
            force_with_lease: args.force_with_lease,
            set_upstream: args.set_upstream,
            tags: args.tags,
        },
        ssh.as_deref(),
    )
    .await
}

// ====== Bulk (multi-repo) ======

#[tauri::command]
#[tracing::instrument(target = "git_fried_lib::ipc::sync", skip(state), err)]
pub async fn bulk_fetch(
    workspace_id: Option<i64>,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_bulk::BulkResult<git_sync::SyncResult>>> {
    git_bulk::bulk_fetch(&state.db, workspace_id).await
}

#[tauri::command]
pub async fn bulk_status(
    workspace_id: Option<i64>,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_bulk::BulkResult<git_status::RepoStatus>>> {
    git_bulk::bulk_status(&state.db, workspace_id).await
}

/// Sprint 22-11 F-P3 — Sidebar 50+ repo ahead/behind preview.
/// quick status (branch + upstream + ahead/behind) 만 일괄 조회.
#[tauri::command]
pub async fn bulk_quick_status(
    workspace_id: Option<i64>,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_bulk::BulkResult<git_status::QuickStatus>>> {
    git_bulk::bulk_quick_status(&state.db, workspace_id).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkPrsArgs {
    pub workspace_id: Option<i64>,
    pub state_filter: Option<crate::forge::PrState>,
}

#[tauri::command]
pub async fn bulk_list_prs(
    args: BulkPrsArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_bulk::BulkResult<Vec<crate::forge::PullRequest>>>> {
    git_bulk::bulk_list_prs(&state.db, args.workspace_id, args.state_filter).await
}
