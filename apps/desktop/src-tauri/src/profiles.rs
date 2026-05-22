// Profiles — 개인 ↔ 회사 1-click 토글.
//
// `docs/plan/02 §3` 의 사용자 듀얼 포지(8:2 회사 vs 개인) 핵심 차별화.
// 한 토글로 다음을 일괄 적용:
//   - git config user.name / user.email / user.signingKey (글로벌)
//   - SSH key path (메모만 — 실제 key 적용은 사용자 ssh-agent 가 별도)
//   - 디폴트 forge account (PR 작업 시 사용)
//
// activate 시 git config --global 변경 → 다른 git GUI / CLI 와도 일관.
// 위험: --global 이라 사용자 글로벌 .gitconfig 가 덮여씌어짐. UI 에서 명확 고지.

use crate::error::{AppError, AppResult};
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use sqlx::SqlitePool;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: i64,
    pub name: String,
    pub git_user_name: Option<String>,
    pub git_user_email: Option<String>,
    pub signing_key: Option<String>,
    pub ssh_key_path: Option<String>,
    pub default_forge_account_id: Option<i64>,
    /// 전역 활성 프로필 (UI 강조). plan/43 이후 activate 가 is_default 와 함께 토글.
    pub is_active: bool,
    /// plan/43 P1 (D2) — 공용(default) 프로필. 레포 바인딩이 없을 때의 fallback SoT.
    /// 전역 git config 기입 대상은 오직 이 프로필 (F-04 — activate 가 일원화 토글).
    pub is_default: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileInput {
    pub name: String,
    pub git_user_name: Option<String>,
    pub git_user_email: Option<String>,
    pub signing_key: Option<String>,
    pub ssh_key_path: Option<String>,
    pub default_forge_account_id: Option<i64>,
}

pub async fn list_all(pool: &SqlitePool) -> AppResult<Vec<Profile>> {
    let rows = sqlx::query(
        "SELECT id, name, git_user_name, git_user_email, signing_key, ssh_key_path, \
         default_forge_account_id, is_active, is_default FROM profiles ORDER BY name",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::Db)?;
    rows.into_iter().map(row_to_profile).collect()
}

pub async fn get(pool: &SqlitePool, id: i64) -> AppResult<Profile> {
    let row = sqlx::query(
        "SELECT id, name, git_user_name, git_user_email, signing_key, ssh_key_path, \
         default_forge_account_id, is_active, is_default FROM profiles WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Db)?
    .ok_or_else(|| AppError::validation(format!("프로파일을 찾을 수 없습니다 (id={id})")))?;
    row_to_profile(row)
}

/// SEC-301-FU (plan v0.9) + code-review SEC-001/SEC-002/SEC-004 — SSH key path 가
/// GIT_SSH_COMMAND env value 로 들어가므로 shell injection 차단. **pub** 으로 다른 storage
/// 경로 (db.rs::set_repo_ssh_key_path 등) 에서도 호출 가능.
///
/// 차단: `"` (quote escape) / `;` `&` `|` (command chain) / `$` `` ` `` (shell expansion) /
///       제어 문자 / glob meta (`*` `?` `[` `]` `{` `}` `<` `>`) / Unicode 양방향 override.
///
/// 허용 패턴: `~/.ssh/id_ed25519` / `C:\Users\u\.ssh\key` / `/home/u/.ssh/key` 등.
/// Windows 경로 backslash 는 caller (runner.rs) 가 forward-slash 로 normalize 책임.
pub fn validate_ssh_key_path(p: &str) -> AppResult<()> {
    if p.trim().is_empty() {
        return Ok(()); // empty 는 caller 단계에서 Option::None 처리
    }
    let forbidden = [
        '"', ';', '&', '|', '$', '`', '\n', '\r', '\0', // shell meta + control
        '*', '?', '[', ']', '{', '}', '<', '>', // glob / redirection meta
        '\u{202E}', '\u{202D}', '\u{202C}', // Unicode RTL/LTR override (homograph)
    ];
    if p.chars().any(|c| forbidden.contains(&c) || c.is_control()) {
        tracing::warn!(
            target: "git_fried_lib::profiles",
            path = %p,
            "validate_ssh_key_path reject — 허용되지 않는 meta/control 문자"
        );
        return Err(AppError::validation(format!(
            "ssh_key_path 에 허용되지 않는 문자 포함 (quote/shell meta/glob/제어/RTL): {p:?}"
        )));
    }
    Ok(())
}

pub async fn create(pool: &SqlitePool, input: ProfileInput) -> AppResult<Profile> {
    if input.name.trim().is_empty() {
        return Err(AppError::validation("프로파일 이름이 비었습니다."));
    }
    if let Some(p) = &input.ssh_key_path {
        validate_ssh_key_path(p)?;
    }
    let row = sqlx::query(
        "INSERT INTO profiles (name, git_user_name, git_user_email, signing_key, ssh_key_path, \
         default_forge_account_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 0) \
         RETURNING id, name, git_user_name, git_user_email, signing_key, ssh_key_path, \
         default_forge_account_id, is_active, is_default",
    )
    .bind(&input.name)
    .bind(&input.git_user_name)
    .bind(&input.git_user_email)
    .bind(&input.signing_key)
    .bind(&input.ssh_key_path)
    .bind(input.default_forge_account_id)
    .fetch_one(pool)
    .await
    .map_err(AppError::Db)?;
    row_to_profile(row)
}

pub async fn update(pool: &SqlitePool, id: i64, input: ProfileInput) -> AppResult<Profile> {
    if let Some(p) = &input.ssh_key_path {
        validate_ssh_key_path(p)?; // SEC-301-FU
    }
    sqlx::query(
        "UPDATE profiles SET name = ?, git_user_name = ?, git_user_email = ?, \
         signing_key = ?, ssh_key_path = ?, default_forge_account_id = ? \
         WHERE id = ?",
    )
    .bind(&input.name)
    .bind(&input.git_user_name)
    .bind(&input.git_user_email)
    .bind(&input.signing_key)
    .bind(&input.ssh_key_path)
    .bind(input.default_forge_account_id)
    .bind(id)
    .execute(pool)
    .await
    .map_err(AppError::Db)?;
    get(pool, id).await
}

pub async fn delete(pool: &SqlitePool, id: i64) -> AppResult<()> {
    // plan/43 (F-06) — 공용(is_default) 프로필 삭제 거부. "정확히 1개" 불변식 보호.
    let prof = get(pool, id).await?;
    if prof.is_default {
        return Err(AppError::validation(
            "공용(default) 프로필은 삭제할 수 없습니다. 다른 프로필을 먼저 공용으로 지정한 뒤 삭제하세요.",
        ));
    }
    tracing::info!(target: "git_fried_lib::profiles", id, "delete profile");
    // plan/43 (iter8 F8-4) — 삭제 전 이 프로필에 바인딩된 레포의 profile_pinned 리셋.
    // FK `ON DELETE SET NULL` 은 profile_id 만 NULL — pinned 는 별도 리셋해야 auto-match 재개.
    sqlx::query("UPDATE repos SET profile_pinned = 0 WHERE profile_id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppError::Db)?;
    sqlx::query("DELETE FROM profiles WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppError::Db)?;
    Ok(())
}

/// 프로파일 활성화 — DB 의 is_active 토글 + git config --global 적용.
pub async fn activate(pool: &SqlitePool, id: i64) -> AppResult<Profile> {
    let started = std::time::Instant::now();
    tracing::info!(target: "git_fried_lib::profiles", id, "activate 시작");
    // DB: 모든 프로파일 비활성화 후 대상만 활성화 (single-active invariant)
    //
    // tx rollback path: explicit `tx.rollback()` 없음 — sqlx `Transaction` 의 Drop trait
    // 가 commit 전 drop 시 자동 rollback 수행 (sqlx 0.8 idiomatic). 본 site 의 2 UPDATE
    // 사이 panic 또는 cancellation 시 단일 active invariant 가 깨지지 않도록 보장.
    // UltraPlan v0.4 B4 (docs/plan/37 §B4) 검증 통과 — explicit guard 추가 불필요.
    // plan/43 (F-04 / iter2 #2) — activate 가 is_active 와 is_default 를 함께 토글.
    // is_default = 레포 바인딩 없을 때의 fallback SoT, 전역 git config 기입 대상.
    // 둘을 일원화해 "전역에 써진 프로필 ≠ fallback 프로필" 모순을 차단.
    let mut tx = pool.begin().await.map_err(AppError::Db)?;
    sqlx::query("UPDATE profiles SET is_active = 0, is_default = 0")
        .execute(&mut *tx)
        .await
        .map_err(AppError::Db)?;
    sqlx::query("UPDATE profiles SET is_active = 1, is_default = 1 WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Db)?;
    tx.commit().await.map_err(AppError::Db)?;

    let profile = get(pool, id).await?;

    // git config --global 적용 (전역 Git 설정)
    apply_to_git_config(&profile).await?;

    let elapsed_ms = started.elapsed().as_millis() as u64;
    tracing::info!(
        target: "git_fried_lib::profiles",
        id,
        name = %profile.name,
        elapsed_ms,
        "activate 완료 (git config --global 적용)"
    );

    Ok(profile)
}

/// git config --global 에 프로파일 정보 적용.
///
/// `git_run` 의 `global=true` 옵션 사용 — 호출 자체에 cwd 의존 없음.
/// `--unset` 처리: None 인 필드는 글로벌 설정에서 제거.
async fn apply_to_git_config(profile: &Profile) -> AppResult<()> {
    let dummy = Path::new(".");
    let opts = GitRunOpts {
        global: true,
        ..Default::default()
    };

    set_or_unset(dummy, &opts, "user.name", profile.git_user_name.as_deref()).await?;
    set_or_unset(
        dummy,
        &opts,
        "user.email",
        profile.git_user_email.as_deref(),
    )
    .await?;
    set_or_unset(
        dummy,
        &opts,
        "user.signingkey",
        profile.signing_key.as_deref(),
    )
    .await?;

    Ok(())
}

async fn set_or_unset(
    cwd: &Path,
    opts: &GitRunOpts,
    key: &str,
    value: Option<&str>,
) -> AppResult<()> {
    if let Some(v) = value.filter(|s| !s.trim().is_empty()) {
        // git config --global <key> <value>
        git_run(cwd, &["config", "--global", key, v], opts).await?;
        // exit code 가 0 아니어도 set 자체는 멱등성 → into_ok() 안 함
    } else {
        // git config --global --unset <key> (없으면 exit 5, 무시)
        let _ = git_run(cwd, &["config", "--global", "--unset", key], opts).await?;
    }
    Ok(())
}

fn row_to_profile(r: sqlx::sqlite::SqliteRow) -> AppResult<Profile> {
    Ok(Profile {
        id: r.try_get("id")?,
        name: r.try_get("name")?,
        git_user_name: r.try_get("git_user_name")?,
        git_user_email: r.try_get("git_user_email")?,
        signing_key: r.try_get("signing_key")?,
        ssh_key_path: r.try_get("ssh_key_path")?,
        default_forge_account_id: r.try_get("default_forge_account_id")?,
        is_active: r.try_get::<i64, _>("is_active")? != 0,
        is_default: r.try_get::<i64, _>("is_default")? != 0,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::Db;

    #[tokio::test]
    async fn test_profiles_crud_round_trip() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let db = Db::open(tmp.path()).await.unwrap();

        // 빈 시작
        assert_eq!(list_all(&db.pool).await.unwrap().len(), 0);

        // 생성 (한글 이름)
        let p = create(
            &db.pool,
            ProfileInput {
                name: "회사 (opnd)".to_string(),
                git_user_name: Some("tgkim".into()),
                git_user_email: Some("tgkim@opnd.com".into()),
                signing_key: None,
                ssh_key_path: Some("~/.ssh/opnd_ed25519".into()),
                default_forge_account_id: None,
            },
        )
        .await
        .unwrap();
        assert_eq!(p.name, "회사 (opnd)");
        assert!(!p.is_active);

        // 두 번째
        let p2 = create(
            &db.pool,
            ProfileInput {
                name: "개인".to_string(),
                git_user_name: Some("tgkim".into()),
                git_user_email: Some("oharapass@gmail.com".into()),
                signing_key: None,
                ssh_key_path: None,
                default_forge_account_id: None,
            },
        )
        .await
        .unwrap();

        assert_eq!(list_all(&db.pool).await.unwrap().len(), 2);

        // 업데이트 (한글 + 영문 mixed)
        let updated = update(
            &db.pool,
            p.id,
            ProfileInput {
                name: "회사 (opnd-frontend)".to_string(),
                git_user_name: Some("tgkim".into()),
                git_user_email: Some("tgkim@opnd.com".into()),
                signing_key: Some("ssh-ed25519 AAA...".into()),
                ssh_key_path: None,
                default_forge_account_id: None,
            },
        )
        .await
        .unwrap();
        assert_eq!(updated.name, "회사 (opnd-frontend)");
        assert!(updated.signing_key.is_some());

        // 삭제
        delete(&db.pool, p2.id).await.unwrap();
        assert_eq!(list_all(&db.pool).await.unwrap().len(), 1);
    }

    #[tokio::test]
    async fn test_activate_single_active_invariant() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let db = Db::open(tmp.path()).await.unwrap();
        let p1 = create(
            &db.pool,
            ProfileInput {
                name: "p1".into(),
                git_user_name: None,
                git_user_email: None,
                signing_key: None,
                ssh_key_path: None,
                default_forge_account_id: None,
            },
        )
        .await
        .unwrap();
        let p2 = create(
            &db.pool,
            ProfileInput {
                name: "p2".into(),
                git_user_name: None,
                git_user_email: None,
                signing_key: None,
                ssh_key_path: None,
                default_forge_account_id: None,
            },
        )
        .await
        .unwrap();

        // p1 활성화 — git config 적용은 시스템에 영향 주지 않도록 모두 None.
        // (None 이면 set 호출 안 됨, --unset 만 호출 — global git config 가
        // 사용자 시스템에 영향 줄 수는 있어 주의)
        let active = activate(&db.pool, p1.id).await.unwrap();
        assert!(active.is_active);

        let list = list_all(&db.pool).await.unwrap();
        let actives: Vec<_> = list.iter().filter(|p| p.is_active).collect();
        assert_eq!(actives.len(), 1);
        assert_eq!(actives[0].id, p1.id);

        // p2 활성화 — p1 자동 비활성화
        let _ = activate(&db.pool, p2.id).await.unwrap();
        let list2 = list_all(&db.pool).await.unwrap();
        let actives2: Vec<_> = list2.iter().filter(|p| p.is_active).collect();
        assert_eq!(actives2.len(), 1);
        assert_eq!(actives2[0].id, p2.id);
    }
}
