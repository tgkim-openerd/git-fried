// Tauri commands — GitKraken importer (`docs/plan/21`).
//
// /analyze HIGH 1 후속 — commands.rs 의 importer 영역 3 commands 분리.

use crate::error::AppResult;
use crate::importer::gitkraken;
use crate::AppState;
use serde::Deserialize;
use std::path::Path;
use std::sync::Arc;

#[tauri::command]
pub async fn import_gitkraken_detect() -> AppResult<Option<gitkraken::DetectResult>> {
    gitkraken::detect_summary()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitKrakenImportArgs {
    pub profile_dir: String,
}

#[tauri::command]
pub async fn import_gitkraken_dry_run(
    args: GitKrakenImportArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<gitkraken::ImportPlan> {
    let payload = gitkraken::read_payload(Path::new(&args.profile_dir))?;
    gitkraken::dry_run(&state.db, &payload).await
}

#[tauri::command]
pub async fn import_gitkraken_apply(
    args: GitKrakenImportArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<gitkraken::ApplyResult> {
    let payload = gitkraken::read_payload(Path::new(&args.profile_dir))?;
    gitkraken::apply(&state.db, &payload).await
}
