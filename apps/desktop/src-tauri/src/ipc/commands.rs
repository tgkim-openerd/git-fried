// Tauri commands — Frontend (Vue) 에서 invoke() 로 호출하는 함수들.
//
// 규칙:
//   - 모든 함수 서명: async fn name(args, state) -> AppResult<T>
//   - args 는 단일 struct (camelCase 필드, serde rename_all)
//   - 에러는 AppError (자동 직렬화)
//   - DB 작업은 state.db 사용
//   - Git 작업은 storage::Db + git::repository / git::runner / git::stage / ...

use crate::error::{AppError, AppResult};
use crate::git::{
    branch as git_branch, bulk as git_bulk, clone as git_clone, commit as git_commit,
    config_local as git_cfg_local, diff as git_diff, graph as git_graph,
    maintenance as git_maint, remote as git_remote, repository as repo, reset as git_reset,
    runner, stage, stash as git_stash, status as git_status, submodule as git_sub,
    sync as git_sync, tag as git_tag,
};
use crate::importer::gitkraken;
use crate::storage::{DbExt, Repo, Workspace};
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;

// ====== App info ======

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub version: String,
    pub git_version: Option<String>,
    pub platform: String,
}

#[tauri::command]
pub async fn get_app_info() -> AppInfo {
    let git_version = runner::git_version().await.ok();
    AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        git_version,
        platform: std::env::consts::OS.to_string(),
    }
}

// ====== Workspaces ======

#[tauri::command]
pub async fn list_workspaces(state: tauri::State<'_, Arc<AppState>>) -> AppResult<Vec<Workspace>> {
    state.db.list_workspaces().await
}

#[tauri::command]
pub async fn create_workspace(
    name: String,
    color: Option<String>,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Workspace> {
    if name.trim().is_empty() {
        return Err(AppError::validation("워크스페이스 이름이 비었습니다."));
    }
    state.db.create_workspace(&name, color.as_deref()).await
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateWorkspaceArgs {
    pub id: i64,
    pub name: Option<String>,
    pub color: Option<String>,
}

#[tauri::command]
pub async fn update_workspace(
    args: UpdateWorkspaceArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Workspace> {
    state
        .db
        .update_workspace(args.id, args.name.as_deref(), args.color.as_deref())
        .await
}

#[tauri::command]
pub async fn delete_workspace(id: i64, state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
    state.db.delete_workspace(id).await
}

// ====== Sprint B8 — Branch / Commit drag-drop ops ======

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeBranchArgs {
    pub repo_id: i64,
    /// 머지 source (현재 HEAD 에 합쳐질 ref).
    pub source: String,
    #[serde(default)]
    pub no_ff: bool,
    #[serde(default)]
    pub no_commit: bool,
}

#[tauri::command]
pub async fn merge_branch(
    args: MergeBranchArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<crate::git::branch::MergeResult> {
    let path = repo_path(&state, args.repo_id).await?;
    crate::git::branch::merge_into_head(&path, &args.source, args.no_ff, args.no_commit).await
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RebaseBranchArgs {
    pub repo_id: i64,
    pub upstream: String,
}

#[tauri::command]
pub async fn rebase_branch(
    args: RebaseBranchArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<crate::git::branch::MergeResult> {
    let path = repo_path(&state, args.repo_id).await?;
    crate::git::branch::rebase_onto(&path, &args.upstream).await
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CherryPickShaArgs {
    pub repo_id: i64,
    pub sha: String,
    /// 지정 시 그 브랜치로 switch 후 cherry-pick → 복귀. 없으면 현재 HEAD 에.
    pub target_branch: Option<String>,
}

#[tauri::command]
pub async fn cherry_pick_sha(
    args: CherryPickShaArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<crate::git::branch::MergeResult> {
    let path = repo_path(&state, args.repo_id).await?;
    crate::git::branch::cherry_pick_sha(&path, &args.sha, args.target_branch.as_deref()).await
}

// ====== Repos ======

#[tauri::command]
pub async fn list_repos(
    workspace_id: Option<i64>,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<Repo>> {
    state.db.list_repos(workspace_id).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddRepoArgs {
    pub local_path: String,
    pub workspace_id: Option<i64>,
    pub name: Option<String>,
}

#[tauri::command]
pub async fn add_repo(
    args: AddRepoArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Repo> {
    let path = Path::new(&args.local_path);
    if !path.exists() {
        return Err(AppError::validation(format!(
            "경로가 존재하지 않습니다: {}",
            args.local_path
        )));
    }

    let meta = repo::detect_meta(path)?;

    state
        .db
        .add_repo(
            &args.local_path,
            args.workspace_id,
            args.name.as_deref(),
            meta.default_branch.as_deref(),
            meta.default_remote.as_deref(),
            meta.forge_kind,
            meta.forge_owner.as_deref(),
            meta.forge_repo.as_deref(),
        )
        .await
}

#[tauri::command]
pub async fn remove_repo(id: i64, state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
    state.db.remove_repo(id).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetPinnedArgs {
    pub id: i64,
    pub pinned: bool,
}

#[tauri::command]
pub async fn set_repo_pinned(
    args: SetPinnedArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Repo> {
    state.db.set_repo_pinned(args.id, args.pinned).await
}

// ====== 헬퍼: repo_id → 로컬 경로 ======

async fn repo_path(state: &Arc<AppState>, repo_id: i64) -> AppResult<PathBuf> {
    Ok(PathBuf::from(state.db.get_repo(repo_id).await?.local_path))
}

// ====== Git read ======

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

#[tauri::command]
pub async fn get_status(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_status::RepoStatus> {
    let path = repo_path(&state, repo_id).await?;
    tokio::task::spawn_blocking(move || git_status::read_status(&path))
        .await
        .map_err(|e| AppError::internal(format!("spawn_blocking: {e}")))?
}

// ====== Stage / Unstage / Discard ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathsArgs {
    pub repo_id: i64,
    pub paths: Vec<String>,
}

#[tauri::command]
pub async fn stage_paths(args: PathsArgs, state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    stage::stage_paths(&path, &args.paths).await
}

#[tauri::command]
pub async fn stage_all(repo_id: i64, state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
    let path = repo_path(&state, repo_id).await?;
    stage::stage_all(&path).await
}

#[tauri::command]
pub async fn unstage_paths(
    args: PathsArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    stage::unstage_paths(&path, &args.paths).await
}

#[tauri::command]
pub async fn discard_paths(
    args: PathsArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    stage::discard_paths(&path, &args.paths).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchArgs {
    pub repo_id: i64,
    pub patch: String,
    /// false 면 stage, true 면 unstage (reverse).
    pub reverse: bool,
}

#[tauri::command]
pub async fn apply_patch(args: PatchArgs, state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    if args.reverse {
        stage::unstage_patch(&path, &args.patch).await
    } else {
        stage::stage_patch(&path, &args.patch).await
    }
}

// ====== Diff ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffCommandArgs {
    pub repo_id: i64,
    pub staged: bool,
    pub path: Option<String>,
    pub rev: Option<String>,
    pub context: Option<u32>,
}

#[tauri::command]
pub async fn get_diff(
    args: DiffCommandArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<String> {
    let path = repo_path(&state, args.repo_id).await?;
    git_diff::diff(
        &path,
        &git_diff::DiffArgs {
            staged: args.staged,
            path: args.path,
            rev: args.rev,
            context: args.context,
        },
    )
    .await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffCommitArgs {
    pub repo_id: i64,
    pub sha: String,
    /// Sprint B1 — 3-mode 토글 (compact=0 / default=None / context=25).
    pub context: Option<u32>,
}

#[tauri::command]
pub async fn get_commit_diff(
    args: DiffCommitArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<String> {
    let path = repo_path(&state, args.repo_id).await?;
    git_diff::diff_commit(&path, &args.sha, args.context).await
}

// ====== Commit ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitArgs {
    pub repo_id: i64,
    pub message: String,
    #[serde(default)]
    pub amend: bool,
    #[serde(default)]
    pub allow_empty: bool,
    #[serde(default)]
    pub no_verify: bool,
    #[serde(default)]
    pub signoff: bool,
    pub author: Option<String>,
}

#[tauri::command]
pub async fn commit(
    args: CommitArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_commit::CommitResult> {
    let path = repo_path(&state, args.repo_id).await?;
    git_commit::commit(
        &path,
        &args.message,
        git_commit::CommitOpts {
            amend: args.amend,
            allow_empty: args.allow_empty,
            no_verify: args.no_verify,
            signoff: args.signoff,
            author: args.author,
        },
    )
    .await
}

#[tauri::command]
pub async fn last_commit_message(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<String> {
    let path = repo_path(&state, repo_id).await?;
    git_commit::last_commit_message(&path).await
}

// ====== Sync (push / pull / fetch) ======

#[tauri::command]
pub async fn fetch_all(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_sync::SyncResult> {
    let path = repo_path(&state, repo_id).await?;
    git_sync::fetch_all(&path).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PullArgs {
    pub repo_id: i64,
    pub remote: Option<String>,
    pub branch: Option<String>,
}

#[tauri::command]
pub async fn pull(
    args: PullArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_sync::SyncResult> {
    let path = repo_path(&state, args.repo_id).await?;
    git_sync::pull(&path, args.remote.as_deref(), args.branch.as_deref()).await
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
pub async fn push(
    args: PushArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_sync::SyncResult> {
    let path = repo_path(&state, args.repo_id).await?;
    git_sync::push(
        &path,
        args.remote.as_deref(),
        args.branch.as_deref(),
        git_sync::PushOpts {
            force_with_lease: args.force_with_lease,
            set_upstream: args.set_upstream,
            tags: args.tags,
        },
    )
    .await
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

// ====== Branches ======

#[tauri::command]
pub async fn list_branches(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_branch::BranchInfo>> {
    let path = repo_path(&state, repo_id).await?;
    tokio::task::spawn_blocking(move || git_branch::list_branches(&path))
        .await
        .map_err(|e| AppError::internal(format!("spawn_blocking: {e}")))?
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwitchBranchArgs {
    pub repo_id: i64,
    pub name: String,
    #[serde(default)]
    pub create: bool,
}

#[tauri::command]
pub async fn switch_branch(
    args: SwitchBranchArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_branch::switch_branch(&path, &args.name, args.create).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBranchArgs {
    pub repo_id: i64,
    pub name: String,
    pub start: Option<String>,
}

#[tauri::command]
pub async fn create_branch(
    args: CreateBranchArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_branch::create_branch(&path, &args.name, args.start.as_deref()).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteBranchArgs {
    pub repo_id: i64,
    pub name: String,
    #[serde(default)]
    pub force: bool,
}

#[tauri::command]
pub async fn delete_branch(
    args: DeleteBranchArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_branch::delete_branch(&path, &args.name, args.force).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameBranchArgs {
    pub repo_id: i64,
    pub old_name: String,
    pub new_name: String,
}

#[tauri::command]
pub async fn rename_branch(
    args: RenameBranchArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_branch::rename_branch(&path, &args.old_name, &args.new_name).await
}

// ====== Stash ======

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

// ====== Compare (`docs/plan/14 §2 A1`) ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareRefsArgs {
    pub repo_id: i64,
    pub ref1: String,
    pub ref2: String,
}

/// 두 ref 비교 — commits + diff + ahead/behind.
#[tauri::command]
pub async fn compare_refs(
    args: CompareRefsArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<crate::git::compare::CompareResult> {
    let path = repo_path(&state, args.repo_id).await?;
    crate::git::compare::compare_refs(&path, &args.ref1, &args.ref2).await
}

// ====== Reset / Revert ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResetArgs {
    pub repo_id: i64,
    pub mode: git_reset::ResetMode,
    pub target: String,
}

#[tauri::command]
pub async fn reset(args: ResetArgs, state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_reset::reset(&path, args.mode, &args.target).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RevertArgs {
    pub repo_id: i64,
    pub sha: String,
    #[serde(default)]
    pub no_commit: bool,
}

#[tauri::command]
pub async fn revert(args: RevertArgs, state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_reset::revert(&path, &args.sha, args.no_commit).await
}

// ====== Sprint c25-1.5 — Undo last action ======

// ARCH-007 fix — 다른 IPC (reset/revert) 와 일관 args struct 패턴.
// 향후 옵션 (e.g., confirm_force) 추가 시 breaking change 회피.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UndoLastActionArgs {
    pub repo_id: i64,
}

#[tauri::command]
pub async fn undo_last_action(
    args: UndoLastActionArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_reset::UndoResult> {
    let path = repo_path(&state, args.repo_id).await?;
    git_reset::undo_last_action(&path).await
}

// ====== Submodule ======

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
    let path = repo_path(&state, args.repo_id).await?;
    git_sub::update_submodules(&path, args.remote).await
}

#[tauri::command]
pub async fn sync_submodules(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, repo_id).await?;
    git_sub::sync_submodules(&path).await
}

// ====== Bulk (multi-repo) ======

#[tauri::command]
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

// ====== Remote 관리 (`docs/plan/14 §4` Sprint B14-1) ======

#[tauri::command]
pub async fn list_remotes(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_remote::RemoteInfo>> {
    let r = state.db.get_repo(repo_id).await?;
    git_remote::list_remotes(Path::new(&r.local_path)).await
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
    let r = state.db.get_repo(args.repo_id).await?;
    git_remote::add_remote(Path::new(&r.local_path), &args.name, &args.url).await
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
    let r = state.db.get_repo(args.repo_id).await?;
    git_remote::remove_remote(Path::new(&r.local_path), &args.name).await
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
    let r = state.db.get_repo(args.repo_id).await?;
    git_remote::rename_remote(Path::new(&r.local_path), &args.old_name, &args.new_name).await
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
    let r = state.db.get_repo(args.repo_id).await?;
    git_remote::set_remote_url(Path::new(&r.local_path), &args.name, &args.url).await
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
    let r = state.db.get_repo(args.repo_id).await?;
    git_maint::gc(Path::new(&r.local_path), args.aggressive).await
}

#[tauri::command]
pub async fn maintenance_fsck(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_maint::MaintenanceResult> {
    let r = state.db.get_repo(repo_id).await?;
    git_maint::fsck(Path::new(&r.local_path)).await
}

// ====== Repository-Specific Preferences (`docs/plan/14 §3` Sprint B14-3) ======

#[tauri::command]
pub async fn read_repo_config(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_cfg_local::RepoConfigSnapshot> {
    let r = state.db.get_repo(repo_id).await?;
    git_cfg_local::read_snapshot(Path::new(&r.local_path)).await
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
    let r = state.db.get_repo(args.repo_id).await?;
    git_cfg_local::apply_snapshot(Path::new(&r.local_path), &args.snapshot).await
}

// ====== Repo Clone with options (`docs/plan/14 §6 E1+E2` Sprint C14-2) ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloneRepoArgs {
    pub url: String,
    pub target_path: String,
    #[serde(default)]
    pub options: git_clone::CloneOptions,
    /// 클론 후 git-fried 워크스페이스에 자동 등록할지.
    #[serde(default = "default_auto_register")]
    pub auto_register: bool,
    /// 자동 등록 시 소속 워크스페이스. None = unassigned.
    #[serde(default)]
    pub workspace_id: Option<i64>,
}

fn default_auto_register() -> bool {
    true
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloneRepoResult {
    pub clone: git_clone::CloneResult,
    /// auto_register=true 이고 add_repo 성공 시 등록된 Repo. 실패 시 None + warning.
    pub registered_repo: Option<Repo>,
    pub warning: Option<String>,
}

#[tauri::command]
pub async fn clone_repo(
    args: CloneRepoArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<CloneRepoResult> {
    let target = Path::new(&args.target_path);
    let clone_res = git_clone::clone(&args.url, target, &args.options).await?;

    if !args.auto_register {
        return Ok(CloneRepoResult {
            clone: clone_res,
            registered_repo: None,
            warning: None,
        });
    }

    // auto_register: detect_meta + add_repo (importer 와 동일 graceful 패턴)
    let meta = repo::detect_meta(target);
    let (name, default_branch, default_remote, forge_kind, forge_owner, forge_repo) = match meta {
        Ok(m) => (
            m.name,
            m.default_branch,
            m.default_remote,
            m.forge_kind,
            m.forge_owner,
            m.forge_repo,
        ),
        Err(_) => {
            let fallback = target
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("repo")
                .to_string();
            (
                fallback,
                None,
                None,
                repo::ForgeKindLite::Unknown,
                None,
                None,
            )
        }
    };

    match state
        .db
        .add_repo(
            &args.target_path,
            args.workspace_id,
            Some(&name),
            default_branch.as_deref(),
            default_remote.as_deref(),
            forge_kind,
            forge_owner.as_deref(),
            forge_repo.as_deref(),
        )
        .await
    {
        Ok(r) => Ok(CloneRepoResult {
            clone: clone_res,
            registered_repo: Some(r),
            warning: None,
        }),
        Err(e) => Ok(CloneRepoResult {
            clone: clone_res,
            registered_repo: None,
            warning: Some(format!("자동 등록 실패: {e}")),
        }),
    }
}

// ====== Tag panel (`docs/plan/14 §8 G1` Sprint C14) ======

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
pub async fn push_tag(
    args: PushTagArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
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

// ====== GitKraken importer (`docs/plan/21`) ======

#[tauri::command]
pub async fn import_gitkraken_detect() -> AppResult<Option<gitkraken::DetectResult>> {
    gitkraken::detect_summary()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitKrakenImportArgs {
    pub profile_dir: String,
}

#[tauri::command]
pub async fn import_gitkraken_dry_run(
    args: GitKrakenImportArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<gitkraken::ImportPlan> {
    let payload = gitkraken::read_payload(Path::new(&args.profile_dir))?;
    gitkraken::dry_run(&state.db, &payload).await
}

#[tauri::command]
pub async fn import_gitkraken_apply(
    args: GitKrakenImportArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<gitkraken::ApplyResult> {
    let payload = gitkraken::read_payload(Path::new(&args.profile_dir))?;
    gitkraken::apply(&state.db, &payload).await
}

