// Tauri commands — Repo CRUD + clone with options.
//
// /analyze HIGH 1 후속 — commands.rs 의 repo + clone 영역 5 commands 분리.

use crate::error::{AppError, AppResult};
use crate::git::{clone as git_clone, repository as repo};
use crate::storage::{DbExt, Repo};
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;

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
    // SEC-006: `..` / symlink 정규화. DB 에 저장되는 경로는 항상 canonical.
    let canonical = path.canonicalize().map_err(|e| {
        AppError::validation(format!("경로 정규화 실패 ({}): {e}", args.local_path))
    })?;
    let canonical_str = canonical.to_string_lossy().to_string();

    let meta = repo::detect_meta(&canonical)?;

    // plan/43 P2.5 — register_repo 단일 진입점 (add_repo + 자동 매칭).
    crate::git::profile_match::register_repo(
        &state.db,
        &canonical_str,
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
    /// plan #45 M4b — FE 가 생성한 취소 job_id. Some 이면 clone 도중 cancel_git_op(job_id)
    /// 로 중단 가능 (child kill). None = 취소 불가 (기존 동작 보존).
    #[serde(default)]
    pub job_id: Option<String>,
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
// Sprint c78 — args.url 은 PAT inline (https://oauth:TOKEN@...) 가능성 있어 skip_all + 안전 필드만 record.
#[tracing::instrument(
    target = "git_fried_lib::ipc::repo",
    skip_all,
    fields(target = %args.target_path, auto_register = args.auto_register),
    err
)]
pub async fn clone_repo(
    args: CloneRepoArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<CloneRepoResult> {
    let target = Path::new(&args.target_path);
    // plan #45 M4b — job_id 있으면 CancelGuard 로 취소 가능 clone. guard drop(완료/`?` 에러/
    // panic) 시 자동 unregister → registry leak 방지 (Codex M4b.2/M4b.5). scope = clone 만
    // (fetch/push 취소는 동일 메커니즘으로 후속, Codex M4b.3). clone 은 fresh target 이라 kill
    // 시 기존 repo 의 .git lock 잔존 위험 없음 (Codex M4b.6 N/A — 부분 target dir 만 남음).
    let cancel_guard = args
        .job_id
        .as_deref()
        .map(|id| crate::CancelGuard::new(state.inner().clone(), id.to_string()));
    let cancel = cancel_guard.as_ref().map(|g| g.notify.clone());
    let clone_res = git_clone::clone(&args.url, target, &args.options, cancel).await?;
    drop(cancel_guard); // 네트워크 clone 완료 — 후속 DB 작업 전 registry 정리.

    if !args.auto_register {
        return Ok(CloneRepoResult {
            clone: clone_res,
            registered_repo: None,
            warning: None,
        });
    }

    // SEC-006: clone 직후 target 디렉토리가 존재하므로 canonicalize 가능.
    // 실패 시 원래 경로로 fallback (auto_register 는 best-effort).
    let canonical_target = target
        .canonicalize()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| args.target_path.clone());

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

    // plan/43 P2.5 — clone 자동 등록도 register_repo 단일 진입점 경유 (자동 매칭 포함).
    match crate::git::profile_match::register_repo(
        &state.db,
        &canonical_target,
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
