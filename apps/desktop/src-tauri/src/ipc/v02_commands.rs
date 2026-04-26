// v0.2 stretch IPC — Worktree / Cherry-pick / AI subprocess.

use crate::ai;
use crate::error::{AppError, AppResult};
use crate::git::{
    bisect as git_bisect, cherry_pick as git_cp, conflict_prediction as git_cp_pred,
    file_history as git_fh, lfs as git_lfs, merge as git_merge, rebase as git_rebase,
    reflog as git_reflog, worktree as git_wt,
};
use crate::AppState;
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::Arc;

async fn repo_path(state: &Arc<AppState>, repo_id: i64) -> AppResult<PathBuf> {
    use crate::storage::DbExt;
    Ok(PathBuf::from(state.db.get_repo(repo_id).await?.local_path))
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
    let out = git_merge::launch_mergetool(
        &path,
        args.tool.as_deref(),
        args.file.as_deref(),
    )
    .await?;
    Ok(MergetoolResult {
        success: out.exit_code == Some(0),
        stdout: out.stdout,
        stderr: out.stderr,
        exit_code: out.exit_code,
    })
}

// ====== Bisect ======

#[tauri::command]
pub async fn bisect_status(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_bisect::BisectStatus> {
    let path = repo_path(&state, repo_id).await?;
    git_bisect::status(&path).await
}

#[tauri::command]
pub async fn bisect_start(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<String> {
    let path = repo_path(&state, repo_id).await?;
    git_bisect::start(&path).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BisectMarkArgs {
    pub repo_id: i64,
    pub mark: git_bisect::BisectMark,
    pub sha: Option<String>,
}

#[tauri::command]
pub async fn bisect_mark(
    args: BisectMarkArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<String> {
    let path = repo_path(&state, args.repo_id).await?;
    git_bisect::mark(&path, args.mark, args.sha.as_deref()).await
}

#[tauri::command]
pub async fn bisect_reset(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, repo_id).await?;
    git_bisect::reset(&path).await
}

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

// ====== LFS ======

#[tauri::command]
pub async fn lfs_status(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_lfs::LfsStatus> {
    let path = repo_path(&state, repo_id).await?;
    git_lfs::status(&path).await
}

#[tauri::command]
pub async fn lfs_list_files(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_lfs::LfsFile>> {
    let path = repo_path(&state, repo_id).await?;
    git_lfs::list_files(&path).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LfsPatternArgs {
    pub repo_id: i64,
    pub pattern: String,
}

#[tauri::command]
pub async fn lfs_track(
    args: LfsPatternArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_lfs::track(&path, &args.pattern).await
}

#[tauri::command]
pub async fn lfs_untrack(
    args: LfsPatternArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, args.repo_id).await?;
    git_lfs::untrack(&path, &args.pattern).await
}

#[tauri::command]
pub async fn lfs_fetch(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, repo_id).await?;
    git_lfs::fetch(&path).await
}

#[tauri::command]
pub async fn lfs_pull(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, repo_id).await?;
    git_lfs::pull(&path).await
}

#[tauri::command]
pub async fn lfs_prune(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let path = repo_path(&state, repo_id).await?;
    git_lfs::prune(&path).await
}

#[tauri::command]
pub async fn lfs_push_size(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_lfs::LfsPushSize> {
    let path = repo_path(&state, repo_id).await?;
    git_lfs::push_size(&path).await
}

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
}

#[tauri::command]
pub async fn get_file_blame(
    args: FileBlameArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_fh::BlameLine>> {
    let path = repo_path(&state, args.repo_id).await?;
    git_fh::file_blame(&path, &args.path).await
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
        return Err(AppError::validation(
            "AI 호출 전 송출 승인이 필요합니다.",
        ));
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
        return Err(AppError::validation(
            "AI 호출 전 송출 승인이 필요합니다.",
        ));
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
        .or_else(|| {
            repo.default_branch
                .as_ref()
                .map(|b| format!("origin/{b}"))
        })
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

    let prompt = ai::explain_branch_prompt(
        &args.head_branch,
        &args.base_branch,
        &commits,
        &stat,
    );
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

// ====== Interactive rebase (`docs/plan/09 옵션 A`) ======

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
pub async fn rebase_abort(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
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
