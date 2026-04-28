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
    pub is_active: bool,
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
         default_forge_account_id, is_active FROM profiles ORDER BY name",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::Db)?;
    rows.into_iter().map(row_to_profile).collect()
}

pub async fn get(pool: &SqlitePool, id: i64) -> AppResult<Profile> {
    let row = sqlx::query(
        "SELECT id, name, git_user_name, git_user_email, signing_key, ssh_key_path, \
         default_forge_account_id, is_active FROM profiles WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Db)?
    .ok_or_else(|| AppError::validation(format!("프로파일을 찾을 수 없습니다 (id={id})")))?;
    row_to_profile(row)
}

pub async fn create(pool: &SqlitePool, input: ProfileInput) -> AppResult<Profile> {
    if input.name.trim().is_empty() {
        return Err(AppError::validation("프로파일 이름이 비었습니다."));
    }
    let row = sqlx::query(
        "INSERT INTO profiles (name, git_user_name, git_user_email, signing_key, ssh_key_path, \
         default_forge_account_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 0) \
         RETURNING id, name, git_user_name, git_user_email, signing_key, ssh_key_path, \
         default_forge_account_id, is_active",
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
    sqlx::query("DELETE FROM profiles WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppError::Db)?;
    Ok(())
}

/// 프로파일 활성화 — DB 의 is_active 토글 + git config --global 적용.
pub async fn activate(pool: &SqlitePool, id: i64) -> AppResult<Profile> {
    // DB: 모든 프로파일 비활성화 후 대상만 활성화 (single-active invariant)
    let mut tx = pool.begin().await.map_err(AppError::Db)?;
    sqlx::query("UPDATE profiles SET is_active = 0")
        .execute(&mut *tx)
        .await
        .map_err(AppError::Db)?;
    sqlx::query("UPDATE profiles SET is_active = 1 WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Db)?;
    tx.commit().await.map_err(AppError::Db)?;

    let profile = get(pool, id).await?;

    // git config --global 적용 (전역 Git 설정)
    apply_to_git_config(&profile).await?;

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
