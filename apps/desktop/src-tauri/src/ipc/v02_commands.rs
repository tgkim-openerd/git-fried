// v0.2 stretch IPC — Worktree / Cherry-pick / 3-way merge / Reflog / File history / AI subprocess.
//
// 2026-05-04 /analyze 후속 — LFS / Bisect / Rebase 는 각각 lfs_commands /
// bisect_commands / rebase_commands 모듈로 분리. lib.rs 의 generate_handler! 에
// 등록된 path `ipc::v02_commands::lfs_install` 등을 보존하기 위해 아래에서
// `pub use` 로 re-export 한다.
pub use crate::ipc::bisect_commands::*;
pub use crate::ipc::lfs_commands::*;
pub use crate::ipc::rebase_commands::*;

use super::repo_path;
use crate::ai;
use crate::error::{AppError, AppResult};
use crate::git::{
    cherry_pick as git_cp, conflict_prediction as git_cp_pred, file_history as git_fh,
    merge as git_merge, reflog as git_reflog, worktree as git_wt,
};
use crate::AppState;
use serde::Deserialize;
use std::sync::Arc;

// ====== Open repo path in OS file manager (Sprint F4) ======

#[tauri::command]
pub async fn open_in_explorer(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, repo_id).await?;
    open_path_in_os(&path)
}

/// Sprint c38 / plan/29 E5 — 임의 경로 (worktree 의 path 등) 를 OS 파일 매니저로.
///
/// `open_in_explorer` 는 repo_id 단위라 main repo 만 열림. worktree 의 실제
/// 경로를 직접 받는 변형. **Sprint c38 fix MED-4** — defense-in-depth 강화:
///
///   1. canonicalize 로 `..` / symlink 정규화
///   2. 등록된 repo path 또는 그 worktree path 의 ancestor 안에 있을 때만 허용
///   3. 외부 임의 경로 (시스템 폴더 / `~/.ssh` 등) 은 거부
///
/// 이는 렌더러 (Vue) 에 임의 코드 실행 (XSS 등) 발생 시 host filesystem 정찰을
/// 차단하기 위함. 사용자 의도 사용 케이스 (WorktreePanel `Open in Explorer`) 는
/// 모두 등록 repo / worktree path 안.
#[tauri::command]
pub async fn open_path_in_explorer(
    path: String,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    use crate::storage::DbExt;
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(AppError::validation("경로가 비었습니다."));
    }
    let p = std::path::Path::new(trimmed);
    if !p.exists() {
        return Err(AppError::validation(format!(
            "경로가 존재하지 않습니다: {trimmed}"
        )));
    }
    let canon = p
        .canonicalize()
        .map_err(|e| AppError::Internal(format!("경로 정규화 실패: {e}")))?;

    // 등록된 모든 repo + 각 repo 의 worktree path 와 cross-check.
    let repos = state.db.list_repos(None).await?;
    let mut allowed = false;
    for r in &repos {
        let repo_path = std::path::PathBuf::from(&r.local_path);
        let Ok(repo_canon) = repo_path.canonicalize() else {
            continue;
        };
        if canon.starts_with(&repo_canon) {
            allowed = true;
            break;
        }
        // worktree path 도 검사 (별도 path 일 수 있음).
        let Ok(worktrees) = crate::git::worktree::list_worktrees(&repo_canon).await else {
            continue;
        };
        for wt in &worktrees {
            let wt_path = std::path::PathBuf::from(&wt.path);
            if let Ok(wt_canon) = wt_path.canonicalize() {
                if canon.starts_with(&wt_canon) {
                    allowed = true;
                    break;
                }
            }
        }
        if allowed {
            break;
        }
    }
    if !allowed {
        return Err(AppError::validation(format!(
            "허용되지 않은 경로 (등록 repo / worktree 외): {trimmed}"
        )));
    }
    open_path_in_os(&canon)
}

#[cfg(target_os = "windows")]
fn open_path_in_os(path: &std::path::Path) -> AppResult<()> {
    std::process::Command::new("explorer.exe")
        .arg(path)
        .spawn()
        .map_err(|e| AppError::Internal(format!("explorer.exe spawn 실패: {e}")))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn open_path_in_os(path: &std::path::Path) -> AppResult<()> {
    std::process::Command::new("open")
        .arg(path)
        .spawn()
        .map_err(|e| AppError::Internal(format!("open spawn 실패: {e}")))?;
    Ok(())
}

#[cfg(all(unix, not(target_os = "macos")))]
fn open_path_in_os(path: &std::path::Path) -> AppResult<()> {
    std::process::Command::new("xdg-open")
        .arg(path)
        .spawn()
        .map_err(|e| AppError::Internal(format!("xdg-open spawn 실패: {e}")))?;
    Ok(())
}

// ====== Worktree ======

#[tauri::command]
pub async fn list_worktrees(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_wt::WorktreeEntry>> {
    let path = repo_path(&state, repo_id).await?;
    git_wt::list_worktrees(&path).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddWorktreeArgs {
    pub repo_id: i64,
    pub path: String,
    pub create_branch: Option<String>,
    pub branch: Option<String>,
    pub start_point: Option<String>,
}

#[tauri::command]
pub async fn add_worktree(
    args: AddWorktreeArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_wt::add_worktree(
        &path,
        &git_wt::AddWorktreeOpts {
            path: args.path,
            create_branch: args.create_branch,
            branch: args.branch,
            start_point: args.start_point,
        },
    )
    .await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveWorktreeArgs {
    pub repo_id: i64,
    pub path: String,
    #[serde(default)]
    pub force: bool,
}

#[tauri::command]
pub async fn remove_worktree(
    args: RemoveWorktreeArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_wt::remove_worktree(&path, &args.path, args.force).await
}

#[tauri::command]
pub async fn prune_worktrees(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, repo_id).await?;
    git_wt::prune_worktrees(&path).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LockWorktreeArgs {
    pub repo_id: i64,
    pub path: String,
    pub reason: Option<String>,
}

#[tauri::command]
pub async fn lock_worktree(
    args: LockWorktreeArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_wt::lock_worktree(&path, &args.path, args.reason.as_deref()).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnlockWorktreeArgs {
    pub repo_id: i64,
    pub path: String,
}

#[tauri::command]
pub async fn unlock_worktree(
    args: UnlockWorktreeArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_wt::unlock_worktree(&path, &args.path).await
}

// ====== Cherry-pick (단일 + 멀티 레포) ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkCherryPickArgs {
    pub repo_ids: Vec<i64>,
    pub sha: String,
    pub strategy: git_cp::CherryPickStrategy,
    #[serde(default)]
    pub no_commit: bool,
}

#[tauri::command]
pub async fn bulk_cherry_pick(
    args: BulkCherryPickArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_cp::CherryPickResult>> {
    git_cp::bulk_cherry_pick(
        &state.db,
        &args.repo_ids,
        &args.sha,
        args.strategy,
        args.no_commit,
    )
    .await
}

// ====== 3-way merge ======

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

// ====== Bisect — 분리 (ipc/bisect_commands.rs) ======

// ====== Reflog ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReflogArgs {
    pub repo_id: i64,
    pub ref_name: Option<String>,
    pub limit: Option<usize>,
}

#[tauri::command]
pub async fn list_reflog(
    args: ReflogArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_reflog::ReflogEntry>> {
    let path = repo_path(&state, args.repo_id).await?;
    let ref_name = args.ref_name.as_deref().unwrap_or("HEAD");
    let limit = args.limit.unwrap_or(200).min(1000);
    git_reflog::list_reflog(&path, ref_name, limit).await
}

// ====== LFS — 분리 (ipc/lfs_commands.rs) ======

// ====== File history / Blame ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileHistoryArgs {
    pub repo_id: i64,
    pub path: String,
    pub limit: Option<usize>,
}

#[tauri::command]
pub async fn get_file_history(
    args: FileHistoryArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<crate::git::repository::CommitSummary>> {
    let path = repo_path(&state, args.repo_id).await?;
    let limit = args.limit.unwrap_or(200).min(1000);
    git_fh::file_history(&path, &args.path, limit).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileBlameArgs {
    pub repo_id: i64,
    pub path: String,
    /// Sprint c30 / GitKraken UX (Phase 8b) — None=HEAD default, Some(sha)=그 시점 기준.
    pub rev: Option<String>,
}

#[tauri::command]
pub async fn get_file_blame(
    args: FileBlameArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_fh::BlameLine>> {
    let path = repo_path(&state, args.repo_id).await?;
    git_fh::file_blame(&path, &args.path, args.rev.as_deref()).await
}

// ====== AI subprocess ======

#[tauri::command]
pub async fn ai_detect_clis() -> Vec<ai::AiProbe> {
    ai::detect_clis().await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCommitMessageArgs {
    pub repo_id: i64,
    pub cli: ai::AiCli,
    /// 사용자 승인 여부 (회사 워크스페이스에서 강제, 개인은 디폴트 true).
    #[serde(default)]
    pub user_approved: bool,
}

#[tauri::command]
pub async fn ai_commit_message(
    args: AiCommitMessageArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<ai::AiOutput> {
    if !args.user_approved {
        return Err(AppError::validation("AI 호출 전 송출 승인이 필요합니다."));
    }
    let path = repo_path(&state, args.repo_id).await?;

    // staged diff 추출
    let diff = crate::git::diff::diff(
        &path,
        &crate::git::diff::DiffArgs {
            staged: true,
            path: None,
            rev: None,
            context: Some(3),
        },
    )
    .await?;
    if diff.trim().is_empty() {
        return Err(AppError::validation("staged 변경이 없습니다."));
    }

    // 최근 5개 commit subject
    let recent = crate::git::runner::git_run(
        &path,
        &["log", "-5", "--pretty=%s"],
        &crate::git::runner::GitRunOpts::default(),
    )
    .await
    .ok()
    .and_then(|o| o.into_ok().ok())
    .unwrap_or_default();
    let recent_subjects: Vec<String> = recent
        .lines()
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.to_string())
        .collect();

    let prompt = ai::commit_message_prompt(&diff, &recent_subjects);
    ai::ai_run(args.cli, &prompt).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiResolveConflictArgs {
    pub repo_id: i64,
    pub cli: ai::AiCli,
    pub path: String,
    #[serde(default)]
    pub user_approved: bool,
}

#[tauri::command]
pub async fn ai_resolve_conflict(
    args: AiResolveConflictArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<ai::AiOutput> {
    if !args.user_approved {
        return Err(AppError::validation("AI 호출 전 송출 승인이 필요합니다."));
    }
    let path = repo_path(&state, args.repo_id).await?;

    // 충돌 파일 read (sync — git2)
    let cf = {
        let p = path.clone();
        let f = args.path.clone();
        tokio::task::spawn_blocking(move || git_merge::read_conflicted(&p, &f))
            .await
            .map_err(|e| AppError::internal(format!("spawn_blocking: {e}")))??
    };

    let prompt = ai::merge_resolution_prompt(
        &args.path,
        cf.working.as_deref().unwrap_or(""),
        cf.ours.as_deref().unwrap_or(""),
        cf.theirs.as_deref().unwrap_or(""),
        cf.base.as_deref(),
    );
    ai::ai_run(args.cli, &prompt).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCodeReviewArgs {
    pub repo_id: i64,
    pub cli: ai::AiCli,
    pub head_branch: String,
    pub base_branch: String,
    pub pr_title: String,
    pub pr_body: String,
    #[serde(default)]
    pub user_approved: bool,
}

#[tauri::command]
pub async fn ai_code_review(
    args: AiCodeReviewArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<ai::AiOutput> {
    if !args.user_approved {
        return Err(AppError::validation("AI 호출 전 송출 승인이 필요합니다."));
    }
    let path = repo_path(&state, args.repo_id).await?;

    // base..head commits + diff
    let log_arg = format!("{}..{}", args.base_branch, args.head_branch);
    let log = crate::git::runner::git_run(
        &path,
        &["log", &log_arg, "--pretty=%s", "--reverse"],
        &crate::git::runner::GitRunOpts::default(),
    )
    .await
    .ok()
    .and_then(|o| o.into_ok().ok())
    .unwrap_or_default();
    let commits: Vec<String> = log
        .lines()
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.to_string())
        .collect();

    let diff = crate::git::runner::git_run(
        &path,
        &["diff", "--no-color", &log_arg],
        &crate::git::runner::GitRunOpts::default(),
    )
    .await
    .ok()
    .and_then(|o| o.into_ok().ok())
    .unwrap_or_default();

    if diff.trim().is_empty() {
        return Err(AppError::validation(
            "diff 가 비었습니다. branch 범위를 확인.",
        ));
    }

    let prompt = ai::code_review_prompt(&args.pr_title, &args.pr_body, &commits, &diff);
    ai::ai_run(args.cli, &prompt).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiPrBodyArgs {
    pub repo_id: i64,
    pub cli: ai::AiCli,
    pub head_branch: String,
    pub base_branch: String,
    #[serde(default)]
    pub user_approved: bool,
}

#[tauri::command]
pub async fn ai_pr_body(
    args: AiPrBodyArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<ai::AiOutput> {
    if !args.user_approved {
        return Err(AppError::validation("AI 호출 전 송출 승인이 필요합니다."));
    }
    let path = repo_path(&state, args.repo_id).await?;

    // base..head 커밋 subject 목록
    let log_arg = format!("{}..{}", args.base_branch, args.head_branch);
    let log = crate::git::runner::git_run(
        &path,
        &["log", &log_arg, "--pretty=%s", "--reverse"],
        &crate::git::runner::GitRunOpts::default(),
    )
    .await
    .ok()
    .and_then(|o| o.into_ok().ok())
    .unwrap_or_default();
    let commits: Vec<String> = log
        .lines()
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.to_string())
        .collect();

    // diff stat
    let stat = crate::git::runner::git_run(
        &path,
        &["diff", "--stat", &log_arg],
        &crate::git::runner::GitRunOpts::default(),
    )
    .await
    .ok()
    .and_then(|o| o.into_ok().ok())
    .unwrap_or_default();

    let prompt = ai::pr_body_prompt(&commits, &stat, &args.head_branch, &args.base_branch);
    ai::ai_run(args.cli, &prompt).await
}

// ====== Conflict Prediction (Sprint B2 / `docs/plan/11 §20`) ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PredictConflictArgs {
    pub repo_id: i64,
    /// 비교 대상 (예: 'origin/main' 또는 'main'). 비어있으면 default_branch 사용.
    pub target: Option<String>,
}

#[tauri::command]
pub async fn predict_target_conflict(
    args: PredictConflictArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_cp_pred::ConflictPrediction> {
    use crate::storage::DbExt;
    let repo = state.db.get_repo(args.repo_id).await?;
    let path = std::path::PathBuf::from(&repo.local_path);
    let target = args
        .target
        .or_else(|| repo.default_branch.as_ref().map(|b| format!("origin/{b}")))
        .unwrap_or_else(|| "origin/main".to_string());
    git_cp_pred::predict(&path, &target).await
}

// ====== AI explain / stash (Sprint B7 / `docs/plan/11 §18`) ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiExplainCommitArgs {
    pub repo_id: i64,
    pub cli: ai::AiCli,
    pub sha: String,
    #[serde(default)]
    pub user_approved: bool,
}

#[tauri::command]
pub async fn ai_explain_commit(
    args: AiExplainCommitArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<ai::AiOutput> {
    if !args.user_approved {
        return Err(AppError::validation("AI 호출 전 송출 승인이 필요합니다."));
    }
    let path = repo_path(&state, args.repo_id).await?;

    // commit subject + diff 추출.
    let subject = crate::git::runner::git_run(
        &path,
        &["log", "-1", "--pretty=%s", &args.sha],
        &crate::git::runner::GitRunOpts::default(),
    )
    .await?
    .into_ok()?
    .trim()
    .to_string();

    let diff = crate::git::runner::git_run(
        &path,
        &["show", "--no-color", "--format=", &args.sha],
        &crate::git::runner::GitRunOpts::default(),
    )
    .await?
    .into_ok()?;

    if diff.trim().is_empty() {
        return Err(AppError::validation("commit diff 가 비었습니다."));
    }

    let prompt = ai::explain_commit_prompt(&subject, &diff);
    ai::ai_run(args.cli, &prompt).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiExplainBranchArgs {
    pub repo_id: i64,
    pub cli: ai::AiCli,
    pub head_branch: String,
    pub base_branch: String,
    #[serde(default)]
    pub user_approved: bool,
}

#[tauri::command]
pub async fn ai_explain_branch(
    args: AiExplainBranchArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<ai::AiOutput> {
    if !args.user_approved {
        return Err(AppError::validation("AI 호출 전 송출 승인이 필요합니다."));
    }
    let path = repo_path(&state, args.repo_id).await?;

    let log_arg = format!("{}..{}", args.base_branch, args.head_branch);
    let log = crate::git::runner::git_run(
        &path,
        &["log", &log_arg, "--pretty=%s", "--reverse"],
        &crate::git::runner::GitRunOpts::default(),
    )
    .await
    .ok()
    .and_then(|o| o.into_ok().ok())
    .unwrap_or_default();
    let commits: Vec<String> = log
        .lines()
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.to_string())
        .collect();

    let stat = crate::git::runner::git_run(
        &path,
        &["diff", "--stat", &log_arg],
        &crate::git::runner::GitRunOpts::default(),
    )
    .await
    .ok()
    .and_then(|o| o.into_ok().ok())
    .unwrap_or_default();

    if commits.is_empty() && stat.trim().is_empty() {
        return Err(AppError::validation(
            "브랜치에 변경이 없습니다. base/head 확인.",
        ));
    }

    let prompt = ai::explain_branch_prompt(&args.head_branch, &args.base_branch, &commits, &stat);
    ai::ai_run(args.cli, &prompt).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiStashMessageArgs {
    pub repo_id: i64,
    pub cli: ai::AiCli,
    /// `true` 이면 untracked 포함; `false` 면 tracked 변경만.
    #[serde(default)]
    pub include_untracked: bool,
    #[serde(default)]
    pub user_approved: bool,
}

#[tauri::command]
pub async fn ai_stash_message(
    args: AiStashMessageArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<ai::AiOutput> {
    if !args.user_approved {
        return Err(AppError::validation("AI 호출 전 송출 승인이 필요합니다."));
    }
    let path = repo_path(&state, args.repo_id).await?;

    // working tree 의 모든 변경 (staged + unstaged) — `git diff HEAD`.
    let diff_args: Vec<&str> = if args.include_untracked {
        vec!["diff", "HEAD", "--no-color"]
    } else {
        vec!["diff", "--no-color"]
    };
    let diff = crate::git::runner::git_run(
        &path,
        &diff_args,
        &crate::git::runner::GitRunOpts::default(),
    )
    .await?
    .into_ok()?;

    if diff.trim().is_empty() {
        return Err(AppError::validation("stash 할 변경이 없습니다."));
    }

    let prompt = ai::stash_message_prompt(&diff);
    ai::ai_run(args.cli, &prompt).await
}

// ====== Commit Composer AI (Sprint B3 / `docs/plan/11 §18`) ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiComposerArgs {
    pub repo_id: i64,
    pub cli: ai::AiCli,
    /// 마지막 N 개 commit 을 대상으로 (oldest → newest 순서로 prompt).
    pub count: usize,
    #[serde(default)]
    pub user_approved: bool,
}

#[tauri::command]
pub async fn ai_composer_plan(
    args: AiComposerArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<ai::AiOutput> {
    if !args.user_approved {
        return Err(AppError::validation("AI 호출 전 송출 승인이 필요합니다."));
    }
    if args.count == 0 || args.count > 30 {
        return Err(AppError::validation("count 는 1~30."));
    }
    let path = repo_path(&state, args.repo_id).await?;

    // 마지막 N commit 의 (sha, subject) 추출 (oldest → newest).
    let n = format!("-n{}", args.count);
    let log = crate::git::runner::git_run(
        &path,
        &["log", &n, "--pretty=%H%x1f%s", "--reverse"],
        &crate::git::runner::GitRunOpts::default(),
    )
    .await?
    .into_ok()?;

    let mut entries: Vec<(String, String, String)> = Vec::new();
    for line in log.lines() {
        let mut parts = line.splitn(2, '\x1f');
        let sha = parts.next().unwrap_or("").trim().to_string();
        let subject = parts.next().unwrap_or("").to_string();
        if sha.is_empty() {
            continue;
        }
        // 각 commit 의 diff 추출 (parent vs commit). truncate 는 prompt 가 처리.
        let diff = crate::git::runner::git_run(
            &path,
            &["show", "--no-color", "--format=", &sha],
            &crate::git::runner::GitRunOpts::default(),
        )
        .await
        .ok()
        .and_then(|o| o.into_ok().ok())
        .unwrap_or_default();
        entries.push((sha, subject, diff));
    }

    if entries.is_empty() {
        return Err(AppError::validation("commit 이 없습니다."));
    }

    let prompt = ai::composer_plan_prompt(&entries);
    ai::ai_run(args.cli, &prompt).await
}

// ====== Interactive rebase — 분리 (ipc/rebase_commands.rs) ======
