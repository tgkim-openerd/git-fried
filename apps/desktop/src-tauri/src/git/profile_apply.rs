// git/profile_apply.rs — plan/43 P2: 프로필 → 레포 identity 적용.
//
// 프로필의 user.name / user.email / user.signingkey 를 레포 `.git/config --local` 에 기입.
// 무결성 검사 5종:
//   ① 값 일괄 검증 — 모든 필드를 기입 전 한 번에 검증 (부분 적용 금지).
//   ② 충돌 diff   — 현재값이 프로필값과 다르면 고지 (preview 단계).
//   ③ 서명 정합   — commit.gpgsign=true 인데 서명 키 부재 시 경고.
//   ④ 기입 후 검증 — 기입 직후 재조회로 실제 반영 확인.
//   ⑤ rollback    — 기입 중 실패 시 적용 전 스냅샷으로 복원.
//
// provenance: git-fried 가 기입한 키+값을 `git-fried.managed-<key>` 에 기록 —
// 바인딩 해제/전환 시 사용자가 손으로 수정한 키를 보존하기 위함 (값 비교 후 unset).

use crate::error::{AppError, AppResult};
use crate::git::path::reject_dash_prefix;
use crate::git::runner::{git_run, GitRunOpts};
use crate::profiles::Profile;
use serde::Serialize;
use std::path::Path;

/// 프로필이 관리하는 git config identity 키.
const MANAGED_KEYS: [&str; 3] = ["user.name", "user.email", "user.signingkey"];

/// 키 → provenance 기록 키 (`.` 를 `-` 로 치환, git-fried 전용 섹션).
fn provenance_key(key: &str) -> String {
    format!("git-fried.managed-{}", key.replace('.', "-"))
}

/// 프로필에서 해당 키의 값 (빈 문자열은 None 으로 정규화).
fn profile_value(profile: &Profile, key: &str) -> Option<String> {
    let raw = match key {
        "user.name" => profile.git_user_name.clone(),
        "user.email" => profile.git_user_email.clone(),
        "user.signingkey" => profile.signing_key.clone(),
        _ => None,
    };
    raw.filter(|s| !s.trim().is_empty())
}

/// `git config --local --get <key>` — 미설정 시 None.
async fn read_local(repo: &Path, key: &str) -> AppResult<Option<String>> {
    let out = git_run(
        repo,
        &["config", "--local", "--get", "--end-of-options", key],
        &GitRunOpts::default(),
    )
    .await?;
    if out.exit_code == Some(0) {
        Ok(Some(out.stdout.trim_end().to_string()))
    } else {
        Ok(None)
    }
}

/// `git config --local <key> <value>` — value 는 caller 가 reject_dash_prefix 검증한 것.
async fn set_local(repo: &Path, key: &str, value: &str) -> AppResult<()> {
    git_run(
        repo,
        &["config", "--local", "--end-of-options", key, value],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;
    Ok(())
}

/// `git config --local --unset <key>` — 미존재 시 exit 5, 무시.
async fn unset_local(repo: &Path, key: &str) -> AppResult<()> {
    let _ = git_run(
        repo,
        &["config", "--local", "--unset", "--end-of-options", key],
        &GitRunOpts::default(),
    )
    .await?;
    Ok(())
}

/// 필드별 현재값 vs 프로필값 diff.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldDiff {
    pub key: String,
    /// `.git/config --local` 의 현재값.
    pub current: Option<String>,
    /// 프로필이 적용할 값. None = 프로필이 이 필드 미정의 → SET 안 함 (기존값 보존).
    pub new_value: Option<String>,
    /// 현재값이 있고 프로필값과 다름 (사용자가 손으로 박은 값일 수 있음).
    pub conflict: bool,
}

/// dry-run preview — 실제 기입 없이 diff + 무결성 검사 결과만.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileApplyPreview {
    pub fields: Vec<FieldDiff>,
    /// 하나라도 conflict 면 true — UI 에서 사용자 확인 필요.
    pub has_conflict: bool,
    /// ③ 서명 정합 경고 (commit.gpgsign=true + 서명 키 부재). None = 문제 없음.
    pub signing_warning: Option<String>,
}

/// ③ 서명 정합 — commit.gpgsign=true 인데 프로필 signing_key 부재/미존재 시 경고.
/// best-effort: 검증 실패해도 경고 string 만 반환, 절대 Err 안 함.
async fn signing_warning(repo: &Path, profile: &Profile) -> Option<String> {
    let gpgsign = read_local(repo, "commit.gpgsign")
        .await
        .ok()
        .flatten()
        .map(|v| v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    if !gpgsign {
        return None;
    }
    match profile_value(profile, "user.signingkey") {
        None => Some(
            "commit.gpgsign 이 켜져 있으나 이 프로필에 서명 키가 없습니다 — 커밋 서명이 실패할 수 있습니다."
                .to_string(),
        ),
        Some(_) => None,
    }
}

/// 이 프로필이 SET 할 (비어있지 않은) managed 키 목록.
/// 프로필 전환 시 `clear_managed` 의 keep_keys 로 사용 (B 가 SET 할 키는 정리 제외).
pub fn keys_set_by(profile: &Profile) -> Vec<&'static str> {
    MANAGED_KEYS
        .iter()
        .copied()
        .filter(|k| profile_value(profile, k).is_some())
        .collect()
}

/// dry-run preview 생성.
pub async fn preview(repo: &Path, profile: &Profile) -> AppResult<ProfileApplyPreview> {
    let mut fields = Vec::with_capacity(MANAGED_KEYS.len());
    let mut has_conflict = false;
    for key in MANAGED_KEYS {
        let current = read_local(repo, key).await?;
        let new_value = profile_value(profile, key);
        // conflict — 현재값이 있고, 프로필이 정의한 값과 다를 때.
        let conflict = match (&current, &new_value) {
            (Some(c), Some(n)) => c != n,
            _ => false,
        };
        if conflict {
            has_conflict = true;
        }
        fields.push(FieldDiff {
            key: key.to_string(),
            current,
            new_value,
            conflict,
        });
    }
    Ok(ProfileApplyPreview {
        fields,
        has_conflict,
        signing_warning: signing_warning(repo, profile).await,
    })
}

/// 프로필 identity 를 레포 `.git/config --local` 에 적용 (all-or-nothing + rollback + provenance).
///
/// 호출 측(IPC)이 preview 로 사용자 확인을 받은 뒤 호출하는 단계.
///
/// Sprint 2026-05-26 — Codex Wave 1 HIGH-E 해소: cancellation safety.
/// 기존 본체는 snapshot → set_local 루프 → verification → provenance 의 await 사이에서
/// task drop (cancel / abort) 시 rollback 미실행, partial state 남음. 본체를
/// `tokio::spawn` 으로 detach 해 부모 cancel 과 무관하게 끝까지 진행 + rollback 보장.
///
/// 트레이드오프: 부모가 cancel 되어도 spawned task 가 끝날 때까지 git config write 가
/// 백그라운드에서 계속됨. binding lock (lib.rs::repo_lock) 으로 같은 repo 의 후속 mutation
/// 직렬화 되므로 race 없음. 잘못된 profile binding 의 race-cancel "복구" 시도는 없으나
/// partial state 보호가 우선 (Codex Wave 1 HIGH-E).
pub async fn apply(repo: &Path, profile: &Profile) -> AppResult<()> {
    let repo_owned = repo.to_path_buf();
    let profile_owned = profile.clone();
    tokio::spawn(async move { apply_inner(&repo_owned, &profile_owned).await })
        .await
        .map_err(|e| AppError::Internal(format!("profile apply task join 실패: {e}")))?
}

/// 본체 — `apply` 가 spawn 으로 호출. cancel-safe 보장.
async fn apply_inner(repo: &Path, profile: &Profile) -> AppResult<()> {
    // ① 값 일괄 검증 — 기입 전 모든 값을 한 번에 검증 (부분 적용 금지).
    let pairs: Vec<(&str, Option<String>)> = MANAGED_KEYS
        .iter()
        .map(|k| (*k, profile_value(profile, k)))
        .collect();
    for (key, val) in &pairs {
        if let Some(v) = val {
            reject_dash_prefix(v, &format!("프로필 {key}"))?;
        }
    }

    // 적용 전 스냅샷 — ⑤ rollback 용.
    let mut snapshot: Vec<(&str, Option<String>)> = Vec::with_capacity(MANAGED_KEYS.len());
    for key in MANAGED_KEYS {
        snapshot.push((key, read_local(repo, key).await?));
    }

    // 기입 — 비어있지 않은 필드만 SET (부분 프로필 정책: 빈 필드는 건드리지 않음).
    let mut written: Vec<&str> = Vec::new();
    for (key, val) in &pairs {
        if let Some(v) = val {
            if let Err(e) = set_local(repo, key, v).await {
                rollback(repo, &snapshot).await;
                return Err(e);
            }
            written.push(key);
        }
    }

    // ④ 기입 후 검증 — 실제 반영 확인.
    for (key, val) in &pairs {
        if let Some(expected) = val {
            let actual = read_local(repo, key).await?;
            if actual.as_deref() != Some(expected.as_str()) {
                rollback(repo, &snapshot).await;
                return Err(AppError::Internal(format!(
                    "프로필 적용 후 검증 실패: {key} 가 반영되지 않음"
                )));
            }
        }
    }

    // provenance 기록 — git-fried 가 기입한 키+값 (바인딩 해제 시 보존 판정용).
    for (key, val) in &pairs {
        let pkey = provenance_key(key);
        match val {
            Some(v) => {
                let _ = set_local(repo, &pkey, v).await;
            }
            None => {
                let _ = unset_local(repo, &pkey).await;
            }
        }
    }

    tracing::info!(
        target: "git_fried_lib::profile_apply",
        repo = %repo.display(),
        profile = %profile.name,
        written = ?written,
        "프로필 identity 적용 완료"
    );
    Ok(())
}

/// ⑤ rollback — 스냅샷의 값으로 복원 (Some → set, None → unset). best-effort.
async fn rollback(repo: &Path, snapshot: &[(&str, Option<String>)]) {
    for (key, val) in snapshot {
        match val {
            Some(v) => {
                let _ = set_local(repo, key, v).await;
            }
            None => {
                let _ = unset_local(repo, key).await;
            }
        }
    }
    tracing::warn!(
        target: "git_fried_lib::profile_apply",
        repo = %repo.display(),
        "프로필 적용 실패 — 스냅샷으로 rollback"
    );
}

/// 바인딩 해제/전환 — git-fried 가 기입했던 managed 키만 정리.
///
/// provenance 값과 현재 `.git/config` 값을 비교 — 같으면 unset (git-fried 기입분),
/// 다르면 보존 (사용자가 손으로 수정함). `keep_keys` 에 든 키는 unset 대상에서 제외
/// (프로필 전환 시 새 프로필이 SET 할 키 — A managed − B managed 계산용).
pub async fn clear_managed(repo: &Path, keep_keys: &[&str]) -> AppResult<()> {
    for key in MANAGED_KEYS {
        if keep_keys.contains(&key) {
            continue;
        }
        let pkey = provenance_key(key);
        let recorded = read_local(repo, &pkey).await?;
        let Some(recorded) = recorded else {
            continue; // git-fried 가 기입한 적 없음 — 건드리지 않음.
        };
        let current = read_local(repo, key).await?;
        if current.as_deref() == Some(recorded.as_str()) {
            // git-fried 가 기입한 값 그대로 — unset.
            unset_local(repo, key).await?;
        }
        // 다르면 사용자 수정 → 보존. provenance 키는 정리.
        unset_local(repo, &pkey).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::profiles::Profile;

    fn mk_profile(name: &str, email: Option<&str>) -> Profile {
        Profile {
            id: 1,
            name: name.to_string(),
            git_user_name: Some("tgkim".to_string()),
            git_user_email: email.map(|s| s.to_string()),
            signing_key: None,
            ssh_key_path: None,
            default_forge_account_id: None,
            is_active: false,
            is_default: false,
        }
    }

    async fn init_repo() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        git_run(dir.path(), &["init"], &GitRunOpts::default())
            .await
            .unwrap();
        dir
    }

    #[tokio::test]
    async fn test_preview_and_apply_round_trip() {
        let dir = init_repo().await;
        let profile = mk_profile("회사", Some("tgkim@opnd.com"));

        // preview — 신규 레포라 현재값 없음, conflict 없음.
        let pv = preview(dir.path(), &profile).await.unwrap();
        assert!(!pv.has_conflict);
        assert!(pv.fields.iter().any(|f| f.key == "user.email"));

        // apply — 기입 + 검증.
        apply(dir.path(), &profile).await.unwrap();
        assert_eq!(
            read_local(dir.path(), "user.email")
                .await
                .unwrap()
                .as_deref(),
            Some("tgkim@opnd.com")
        );
        // provenance 기록 확인.
        assert_eq!(
            read_local(dir.path(), &provenance_key("user.email"))
                .await
                .unwrap()
                .as_deref(),
            Some("tgkim@opnd.com")
        );
    }

    #[tokio::test]
    async fn test_conflict_detected_on_manual_value() {
        let dir = init_repo().await;
        // 사용자가 손으로 user.email 박음.
        set_local(dir.path(), "user.email", "manual@x.com")
            .await
            .unwrap();
        let profile = mk_profile("회사", Some("tgkim@opnd.com"));
        let pv = preview(dir.path(), &profile).await.unwrap();
        assert!(pv.has_conflict);
        let email_field = pv.fields.iter().find(|f| f.key == "user.email").unwrap();
        assert!(email_field.conflict);
        assert_eq!(email_field.current.as_deref(), Some("manual@x.com"));
    }

    #[tokio::test]
    async fn test_clear_managed_preserves_user_edit() {
        let dir = init_repo().await;
        let profile = mk_profile("회사", Some("tgkim@opnd.com"));
        apply(dir.path(), &profile).await.unwrap();

        // 사용자가 user.email 을 손으로 수정 → provenance 와 불일치.
        set_local(dir.path(), "user.email", "edited@x.com")
            .await
            .unwrap();

        clear_managed(dir.path(), &[]).await.unwrap();
        // user.name 은 git-fried 기입 그대로 → unset.
        assert_eq!(read_local(dir.path(), "user.name").await.unwrap(), None);
        // user.email 은 사용자 수정 → 보존.
        assert_eq!(
            read_local(dir.path(), "user.email")
                .await
                .unwrap()
                .as_deref(),
            Some("edited@x.com")
        );
    }
}
