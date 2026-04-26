// Profiles IPC — list / create / update / delete / activate.

use crate::error::AppResult;
use crate::profiles::{self, Profile, ProfileInput};
use crate::AppState;
use serde::Deserialize;
use std::sync::Arc;

#[tauri::command]
pub async fn list_profiles(
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<Profile>> {
    profiles::list_all(&state.db.pool).await
}

#[tauri::command]
pub async fn create_profile(
    input: ProfileInput,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Profile> {
    profiles::create(&state.db.pool, input).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfileArgs {
    pub id: i64,
    pub input: ProfileInput,
}

#[tauri::command]
pub async fn update_profile(
    args: UpdateProfileArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Profile> {
    profiles::update(&state.db.pool, args.id, args.input).await
}

#[tauri::command]
pub async fn delete_profile(
    id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    profiles::delete(&state.db.pool, id).await
}

#[tauri::command]
pub async fn activate_profile(
    id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Profile> {
    profiles::activate(&state.db.pool, id).await
}
