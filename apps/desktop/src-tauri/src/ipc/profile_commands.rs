// Profiles IPC — list / create / update / delete / activate.
// plan/43 P2 — repo↔profile 바인딩: preview / apply / select-default / clear.

use crate::error::AppResult;
use crate::git::profile_apply::{self, ProfileApplyPreview};
use crate::profiles::{self, Profile, ProfileInput};
use crate::storage::db::{DbExt, Repo};
use crate::AppState;
use serde::Deserialize;
use std::path::Path;
use std::sync::Arc;

#[tauri::command]
pub async fn list_profiles(state: tauri::State<'_, Arc<AppState>>) -> AppResult<Vec<Profile>> {
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
    let profile = profiles::update(&state.db.pool, args.id, args.input).await?;
    // plan/43 P2.5 — default_forge_account_id 변경 시 자동 매칭 재평가 (stale 처리).
    crate::git::profile_match::reevaluate_after_forge_change(&state.db).await?;
    Ok(profile)
}

#[tauri::command]
pub async fn delete_profile(id: i64, state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
    profiles::delete(&state.db.pool, id).await
}

#[tauri::command]
pub async fn activate_profile(
    id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Profile> {
    profiles::activate(&state.db.pool, id).await
}

// === plan/43 P2 — repo↔profile 바인딩 ===

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileBindingArgs {
    pub repo_id: i64,
    pub profile_id: i64,
}

/// dry-run preview — 실제 기입 없이 필드별 diff + 무결성 검사 결과만 반환.
#[tauri::command]
pub async fn preview_profile_apply(
    args: ProfileBindingArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<ProfileApplyPreview> {
    let repo = state.db.get_repo(args.repo_id).await?;
    let profile = profiles::get(&state.db.pool, args.profile_id).await?;
    profile_apply::preview(Path::new(&repo.local_path), &profile).await
}

/// 특정 프로필을 레포에 바인딩 — identity 적용(무결성 5종) + repos.profile_id 수동 지정(pin).
///
/// Sprint 2026-05-26 — Codex Wave 1 HIGH-D 해소: per-repo async lock 으로 TOCTOU 직렬화.
/// apply → clear_managed → set_repo_profile 3단계 사이 await 에서 동시 binding 가
/// 끼어들면 Git config 와 DB binding 가 불일치할 수 있었음.
#[tauri::command]
pub async fn apply_profile_binding(
    args: ProfileBindingArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Repo> {
    let lock = state.repo_lock(args.repo_id);
    let _guard = lock.lock().await;
    let repo = state.db.get_repo(args.repo_id).await?;
    let profile = profiles::get(&state.db.pool, args.profile_id).await?;
    let path = Path::new(&repo.local_path);
    // identity 기입 (all-or-nothing + provenance).
    profile_apply::apply(path, &profile).await?;
    // 전환 잔재 정리 — 새 프로필이 SET 한 키는 keep, 이전 프로필 managed 키만 정리.
    let keep = profile_apply::keys_set_by(&profile);
    profile_apply::clear_managed(path, &keep).await?;
    // 수동 지정 — pinned=true (자동 매칭이 덮어쓰지 않음).
    state
        .db
        .set_repo_profile(args.repo_id, Some(args.profile_id), true)
        .await
}

/// 명시적 공용(default) 프로필 선택 — profile_id=NULL, pinned=true (자동 매칭 재개 안 함).
///
/// Sprint 2026-05-26 — apply_profile_binding 과 대칭. 같은 repo 의 multi-step mutation 이
/// 동시에 일어나면 TOCTOU 위험 → 같은 per-repo lock 으로 직렬화.
#[tauri::command]
pub async fn select_default_profile(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Repo> {
    let lock = state.repo_lock(repo_id);
    let _guard = lock.lock().await;
    let repo = state.db.get_repo(repo_id).await?;
    // 이전 바인딩의 managed 키 정리 (공용 = global 프로필이 fallback 으로 동작).
    profile_apply::clear_managed(Path::new(&repo.local_path), &[]).await?;
    state.db.set_repo_profile(repo_id, None, true).await
}

/// 바인딩 해제 — profile_id=NULL, pinned=false (자동 매칭 재개).
///
/// Sprint 2026-05-26 — Codex Wave 2 review HIGH 후속: apply_profile_binding /
/// select_default_profile 과 sibling — 같은 multi-step (git config write + DB write)
/// 패턴이므로 per-repo lock 직렬화 필요.
#[tauri::command]
pub async fn clear_profile_binding(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Repo> {
    let lock = state.repo_lock(repo_id);
    let _guard = lock.lock().await;
    let repo = state.db.get_repo(repo_id).await?;
    profile_apply::clear_managed(Path::new(&repo.local_path), &[]).await?;
    state.db.set_repo_profile(repo_id, None, false).await
}
