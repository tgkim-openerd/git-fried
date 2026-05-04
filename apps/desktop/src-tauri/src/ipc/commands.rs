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
    bulk as git_bulk, commit as git_commit, config_local as git_cfg_local, diff as git_diff,
    graph as git_graph, identity_stats as git_identity, maintenance as git_maint,
    range_diff as git_range_diff, read_file as git_read_file, reflog as git_reflog,
    remote as git_remote, repository as repo, reset as git_reset, restore as git_restore, runner,
    stage, status as git_status, submodule as git_sub, sync as git_sync, tag as git_tag,
};
use crate::importer::gitkraken;
use crate::storage::DbExt;
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

// ====== Workspaces — workspace_commands.rs 로 분리 (/analyze HIGH 1) ======
// list_workspaces / create_workspace / update_workspace / delete_workspace +
// UpdateWorkspaceArgs 는 ipc/workspace_commands.rs 에 있다. mod.rs 의
// `pub use workspace_commands::*` 로 동일 path (`ipc::workspace_commands::*`)
// 노출, lib.rs invoke_handler 의 등록 경로도 업데이트됨.

// ====== Branch ops — branch_commands.rs 로 분리 (/analyze 후속) ======
// merge_branch / rebase_branch / cherry_pick_sha + list/switch/create/delete/rename
// 는 ipc/branch_commands.rs.

// ====== Repos — repo_commands.rs 로 분리 (/analyze 후속) ======
// list_repos / add_repo / remove_repo / set_repo_pinned + clone_repo 는
// ipc/repo_commands.rs.

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

// Sprint c38 / plan/29 E1 후속 — hunk 단위 워킹트리 복원 (`git apply --reverse`).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreWorktreePatchArgs {
    pub repo_id: i64,
    pub patch: String,
}

#[tauri::command]
pub async fn restore_worktree_patch(
    args: RestoreWorktreePatchArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    stage::restore_worktree_patch(&path, &args.patch).await
}

// ====== Range Diff (Sprint c38 / plan/29 E2 — Range Diff Panel) ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RangeDiffArgs {
    pub repo_id: i64,
    /// "base..tip1" 형태. 없으면 rev1/rev2 로 3-dot 자동 base.
    #[serde(default)]
    pub range1: Option<String>,
    #[serde(default)]
    pub range2: Option<String>,
    /// 자동 base (3-dot) 모드.
    #[serde(default)]
    pub rev1: Option<String>,
    #[serde(default)]
    pub rev2: Option<String>,
}

#[tauri::command]
pub async fn range_diff(
    args: RangeDiffArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_range_diff::RangeDiffEntry>> {
    let path = repo_path(&state, args.repo_id).await?;
    match (args.range1, args.range2, args.rev1, args.rev2) {
        (Some(r1), Some(r2), _, _) => git_range_diff::range_diff(&path, &r1, &r2).await,
        (_, _, Some(a), Some(b)) => git_range_diff::range_diff_auto(&path, &a, &b).await,
        _ => Err(AppError::validation(
            "range-diff: range1/range2 또는 rev1/rev2 둘 중 하나의 쌍이 필요합니다.",
        )),
    }
}

// ====== Restore (Sprint c38 / plan/29 E1 — Restore Center) ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreArgs {
    pub repo_id: i64,
    pub paths: Vec<String>,
    pub opts: git_restore::RestoreOpts,
}

#[tauri::command]
pub async fn restore_paths(
    args: RestoreArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_restore::restore_paths(&path, &args.paths, &args.opts).await
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

// Sprint c30 / GitKraken UX (Phase 6b) — File View 토글용 raw content read.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadFileArgs {
    pub repo_id: i64,
    pub path: String,
    /// None = working dir, Some(sha) = 그 시점의 파일.
    pub rev: Option<String>,
    /// rev=None 일 때 staged 버전 읽기 (`git show :path`).
    #[serde(default)]
    pub is_staged: bool,
}

#[tauri::command]
pub async fn read_file(
    args: ReadFileArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<String> {
    let path = repo_path(&state, args.repo_id).await?;
    git_read_file::read_file(&path, &args.path, args.rev.as_deref(), args.is_staged).await
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
    /// Phase 12-3 — Pull dropdown 옵션 (rebase / ff_only / no_rebase). 모두 None → 기본 pull.
    #[serde(default)]
    pub rebase: bool,
    #[serde(default)]
    pub ff_only: bool,
    #[serde(default)]
    pub no_rebase: bool,
}

#[tauri::command]
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
    git_sync::pull(&path, args.remote.as_deref(), args.branch.as_deref(), opts).await
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

// ====== Branches — branch_commands.rs 로 분리 (/analyze 후속) ======

// ====== Stash + Smart Stash — stash_commands.rs 로 분리 (/analyze 후속) ======

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

// Sprint c35 — undo/redo 는 reflog 기반 — git_reflog 진입점 사용 (실 구현은 reset.rs re-export).
#[tauri::command]
pub async fn undo_last_action(
    args: UndoLastActionArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_reflog::UndoResult> {
    let path = repo_path(&state, args.repo_id).await?;
    git_reflog::undo_last_action(&path).await
}

#[tauri::command]
pub async fn redo_last_action(
    args: UndoLastActionArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_reflog::UndoResult> {
    let path = repo_path(&state, args.repo_id).await?;
    git_reflog::redo_last_action(&path).await
}

// ====== Identity stats (Sprint c36) ======

#[derive(Debug, Deserialize)]
pub struct CountHangulCommitsArgs {
    pub repo_id: i64,
}

/// IdentityCard 의 dogfood 통계 — 한글 commit 비율 (plan/26 Phase 2).
#[tauri::command]
pub async fn count_hangul_commits(
    args: CountHangulCommitsArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_identity::HangulCommitStats> {
    let path = repo_path(&state, args.repo_id).await?;
    git_identity::count_hangul_commits(&path).await
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

// ====== Repo Clone — repo_commands.rs 로 분리 (/analyze 후속) ======

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
