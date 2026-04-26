// Hide branches IPC (`docs/plan/11 §5d` / Sprint A1).
//
// Frontend 가 그래프 / BranchPanel 렌더링 전 `list_hidden_refs(repo_id)` 호출 →
// 결과를 ref filter set 으로 사용. hide / unhide / hide_kind / unhide_kind /
// unhide_all 5 종 mutation.

use crate::error::AppResult;
use crate::git::hide;
use crate::AppState;
use serde::Deserialize;
use std::sync::Arc;

#[tauri::command]
pub async fn list_hidden_refs(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<hide::HiddenRef>> {
    hide::list_hidden(&state.db, repo_id).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HideRefArgs {
    pub repo_id: i64,
    pub ref_name: String,
    pub ref_kind: hide::HiddenRefKind,
}

#[tauri::command]
pub async fn hide_ref(
    args: HideRefArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    hide::hide(&state.db, args.repo_id, &args.ref_name, args.ref_kind).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnhideRefArgs {
    pub repo_id: i64,
    pub ref_name: String,
}

#[tauri::command]
pub async fn unhide_ref(
    args: UnhideRefArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    hide::unhide(&state.db, args.repo_id, &args.ref_name).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HideRefsByKindArgs {
    pub repo_id: i64,
    /// (ref_name, ref_kind) 쌍 목록 — 한 번에 일괄 hide.
    pub refs: Vec<HideRefEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HideRefEntry {
    pub ref_name: String,
    pub ref_kind: hide::HiddenRefKind,
}

#[tauri::command]
pub async fn hide_refs_bulk(
    args: HideRefsByKindArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<usize> {
    let pairs: Vec<(String, hide::HiddenRefKind)> = args
        .refs
        .into_iter()
        .map(|e| (e.ref_name, e.ref_kind))
        .collect();
    hide::hide_many(&state.db, args.repo_id, &pairs).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnhideKindArgs {
    pub repo_id: i64,
    pub ref_kind: hide::HiddenRefKind,
}

#[tauri::command]
pub async fn unhide_refs_by_kind(
    args: UnhideKindArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<u64> {
    hide::unhide_kind(&state.db, args.repo_id, args.ref_kind).await
}

#[tauri::command]
pub async fn unhide_all_refs(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<u64> {
    hide::unhide_all(&state.db, repo_id).await
}
