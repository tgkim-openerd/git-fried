// Tauri commands — Status (read + stage / unstage / discard / patch /
// restore / range_diff) + Diff (working / commit / read_file).
//
// /analyze HIGH 1 후속 — commands.rs 의 status / stage / restore / range_diff /
// diff 영역 11 commands 분리.

use super::repo_path;
use crate::error::{AppError, AppResult};
use crate::git::{
    diff as git_diff, range_diff as git_range_diff, read_file as git_read_file,
    restore as git_restore, stage, status as git_status,
};
use crate::AppState;
use serde::Deserialize;
use std::sync::Arc;

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
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let path = repo_path(&state, args.repo_id).await?;
    stage::stage_paths(&path, &args.paths).await
}

#[tauri::command]
pub async fn stage_all(repo_id: i64, state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(repo_id).await;
    let path = repo_path(&state, repo_id).await?;
    stage::stage_all(&path).await
}

#[tauri::command]
pub async fn unstage_paths(
    args: PathsArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let path = repo_path(&state, args.repo_id).await?;
    stage::unstage_paths(&path, &args.paths).await
}

#[tauri::command]
pub async fn discard_paths(
    args: PathsArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(args.repo_id).await;
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
    let _guard = state.repo_mutation_guard(args.repo_id).await;
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
    let _guard = state.repo_mutation_guard(args.repo_id).await;
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
    let _guard = state.repo_mutation_guard(args.repo_id).await;
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
