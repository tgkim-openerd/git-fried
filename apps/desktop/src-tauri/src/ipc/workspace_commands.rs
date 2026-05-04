// Tauri commands — Workspace CRUD (분해: /analyze HIGH 1 — commands.rs 시범).
//
// commands.rs (1387 LOC, 79 commands) 의 워크스페이스 영역 4 commands 를
// 도메인별 분해 패턴 검증 차원에서 분리. 후속 sprint 에서 repo / status /
// commit / branch / stash / network / tag / submodule / remote / maintenance /
// repo_config / compare 도메인으로 동일 패턴 확장.

use crate::error::{AppError, AppResult};
use crate::storage::{DbExt, Workspace};
use crate::AppState;
use std::sync::Arc;

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
