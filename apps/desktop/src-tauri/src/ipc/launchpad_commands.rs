// Launchpad PR meta + Saved Views IPC (Sprint A4 / `docs/plan/11 §14`).

use crate::error::AppResult;
use crate::launchpad::{self, PrId, PrMeta, SavedView};
use crate::AppState;
use serde::Deserialize;
use std::sync::Arc;

// ====== PR meta ======

#[tauri::command]
pub async fn launchpad_list_active(
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<PrMeta>> {
    launchpad::list_active(&state.db).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListForRepoArgs {
    pub forge_kind: String,
    pub base_url: String,
    pub owner: String,
    pub repo: String,
}

#[tauri::command]
pub async fn launchpad_list_for_repo(
    args: ListForRepoArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<PrMeta>> {
    launchpad::list_for_repo(
        &state.db,
        &args.forge_kind,
        &args.base_url,
        &args.owner,
        &args.repo,
    )
    .await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PinArgs {
    #[serde(flatten)]
    pub id: PrId,
    pub pinned: bool,
}

#[tauri::command]
pub async fn launchpad_set_pinned(
    args: PinArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<PrMeta> {
    launchpad::set_pinned(&state.db, &args.id, args.pinned).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnoozeArgs {
    #[serde(flatten)]
    pub id: PrId,
    /// unix ts; null = snooze 해제.
    pub snoozed_until: Option<i64>,
}

#[tauri::command]
pub async fn launchpad_set_snooze(
    args: SnoozeArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<PrMeta> {
    launchpad::set_snooze(&state.db, &args.id, args.snoozed_until).await
}

#[tauri::command]
pub async fn launchpad_cleanup_defaults(state: tauri::State<'_, Arc<AppState>>) -> AppResult<u64> {
    launchpad::cleanup_defaults(&state.db).await
}

// ====== Saved Views ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListViewsArgs {
    pub view_kind: String,
}

#[tauri::command]
pub async fn launchpad_list_views(
    args: ListViewsArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<SavedView>> {
    launchpad::list_views(&state.db, &args.view_kind).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveViewArgs {
    pub view_kind: String,
    pub name: String,
    pub filter_json: String,
    pub sort_json: Option<String>,
}

#[tauri::command]
pub async fn launchpad_save_view(
    args: SaveViewArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<SavedView> {
    launchpad::save_view(
        &state.db,
        &args.view_kind,
        &args.name,
        &args.filter_json,
        args.sort_json.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn launchpad_delete_view(
    id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    launchpad::delete_view(&state.db, id).await
}
