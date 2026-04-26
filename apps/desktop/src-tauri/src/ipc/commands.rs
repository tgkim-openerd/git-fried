// Tauri commands — Frontend (Vue) 에서 invoke() 로 호출하는 함수들.
//
// 규칙:
//   - 모든 함수 서명: async fn name(args, state) -> AppResult<T>
//   - args 는 단일 struct (camelCase 필드, serde rename_all)
//   - 에러는 AppError (자동 직렬화)
//   - DB 작업은 state.db 사용
//   - Git 작업은 storage::Db + git::repository / git::runner

use crate::error::{AppError, AppResult};
use crate::git::{repository as repo, runner};
use crate::storage::{Db, DbExt, Repo, Workspace};
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::path::Path;
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
pub async fn list_workspaces(
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<Workspace>> {
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

    // 메타 추출 (default branch / forge / remote)
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
pub async fn remove_repo(
    id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    state.db.remove_repo(id).await
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
    let repo_row = state.db.get_repo(args.repo_id).await?;
    let path = std::path::PathBuf::from(repo_row.local_path);
    let limit = args.limit.unwrap_or(200).min(2000);
    let skip = args.skip.unwrap_or(0);

    // git2-rs 호출은 동기 — tokio block_in_place 로 감쌈.
    tokio::task::spawn_blocking(move || -> AppResult<Vec<repo::CommitSummary>> {
        let r = repo::open(&path)?;
        repo::log(&r, limit, skip)
    })
    .await
    .map_err(|e| AppError::internal(format!("spawn_blocking join: {e}")))?
}

// 사용하지 않는 Db import 컴파일러 경고 회피 — 추후 fetch/clone 명령에서 사용 예정.
#[allow(dead_code)]
fn _db_marker(_: &Db) {}
