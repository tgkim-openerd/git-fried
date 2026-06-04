// v0.2 stretch IPC — Cherry-pick / Reflog / File history / Conflict prediction
// + system path 명령 (open_in_explorer / open_path_in_explorer).
//
// 2026-05-04 /analyze 후속 (c39) — LFS / Bisect / Rebase 분리. lib.rs 의 generate_handler!
// 에 등록된 path `ipc::v02_commands::lfs_install` 등을 보존하기 위해 `pub use` 로 re-export.
// 2026-05-05 /analyze 후속 (c40+) — AI subprocess 영역 (~410 LOC, 9 commands) 을
// `ai_commands.rs` 로 분리. 동일 re-export 패턴.
// 2026-05-06 c48 Wave D-4 — Worktree (6) + 3-way merge (4) 분리. lib.rs path 보존.
pub use crate::ipc::ai_commands::*;
pub use crate::ipc::bisect_commands::*;
pub use crate::ipc::lfs_commands::*;
pub use crate::ipc::merge_commands::*;
pub use crate::ipc::rebase_commands::*;
pub use crate::ipc::worktree_commands::*;

use super::repo_path;
use crate::error::{AppError, AppResult};
use crate::git::{
    cherry_pick as git_cp, conflict_prediction as git_cp_pred, file_history as git_fh,
    reflog as git_reflog,
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

// ====== Worktree — 분리 (ipc/worktree_commands.rs, c48 Wave D-4) ======

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
    // Codex review 2026-06-04 (F1) — bulk 은 여러 repo 에 cherry-pick (HEAD mutation). 각 repo 의
    // mutation guard 를 미리 획득해 같은 repo 의 단건 cherry_pick_sha/commit 등과 직렬화.
    // 정렬 + dedup 순서로 획득 → 다른 bulk 호출과 lock-ordering deadlock 방지 (모두 동일 순서).
    // Codex review 2026-06-04 (R3) — guard 와 작업 대상을 같은 dedup 집합으로 통일.
    // `args.repo_ids` 를 그대로 넘기면 `[2,2]` 같은 중복 입력 시 같은 repo 에 cherry-pick task 가
    // 병렬 2개 실행되어 intra-bulk race + 무의미 중복 apply. dedup 한 `ids` 를 작업에도 사용.
    let mut ids: Vec<i64> = args.repo_ids.clone();
    ids.sort_unstable();
    ids.dedup();
    let mut guards = Vec::with_capacity(ids.len());
    for id in &ids {
        guards.push(state.repo_mutation_guard(*id).await);
    }
    let result =
        git_cp::bulk_cherry_pick(&state.db, &ids, &args.sha, args.strategy, args.no_commit).await;
    drop(guards);
    result
}

// ====== 3-way merge — 분리 (ipc/merge_commands.rs, c48 Wave D-4) ======

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

// ====== AI subprocess — 분리 (ipc/ai_commands.rs) ======

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

// ====== Interactive rebase — 분리 (ipc/rebase_commands.rs) ======
