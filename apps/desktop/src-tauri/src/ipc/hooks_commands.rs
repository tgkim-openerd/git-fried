// Plan #42 M-1 (Sprint c99+) — Git Hooks IPC commands
//
// Hook manager UI 의 read-only IPC. enable/disable / edit 은 별도 sprint (M-1 후속).

use super::repo_path;
use crate::error::AppResult;
use crate::git::hooks as git_hooks;
use crate::AppState;
use serde::Deserialize;
use std::sync::Arc;

/// `list_git_hooks(repoId)` — 표준 hook 28개 + 추가 발견 hook 통합 반환.
/// core.hooksPath 가 설정되어 있으면 caller (Vue) 가 별도 호출 후 결과 전달 또는
/// 본 IPC 의 `hooksPathOverride` 인자로 전달. None 시 .git/hooks/ default.
#[tauri::command]
pub async fn list_git_hooks(
    repo_id: i64,
    hooks_path_override: Option<String>,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<git_hooks::HookEntry>> {
    let path = repo_path(&state, repo_id).await?;
    git_hooks::list_git_hooks(&path, hooks_path_override.as_deref()).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HookToggleArgs {
    pub repo_id: i64,
    pub name: String,
    pub hooks_path_override: Option<String>,
}

/// Plan #42 M-1 후속 (Sprint c104) — `.sample` → active 활성화.
#[tauri::command]
pub async fn hook_activate(
    args: HookToggleArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let path = repo_path(&state, args.repo_id).await?;
    git_hooks::hook_activate_from_sample(&path, args.hooks_path_override.as_deref(), &args.name)
        .await
}

/// Plan #42 M-1 후속 (Sprint c104) — active → `.sample` 비활성화.
#[tauri::command]
pub async fn hook_deactivate(
    args: HookToggleArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let path = repo_path(&state, args.repo_id).await?;
    git_hooks::hook_deactivate_to_sample(&path, args.hooks_path_override.as_deref(), &args.name)
        .await
}
