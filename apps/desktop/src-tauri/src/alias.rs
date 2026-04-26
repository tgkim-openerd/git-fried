// Repo tab alias — Sprint B4 / `docs/plan/11 §15`.
//
// (profile_id, repo_id) → alias. profile_id NULL = global default.
// resolve 우선순위: per-profile alias > global > repo.name.

use crate::error::{AppError, AppResult};
use crate::storage::Db;
use serde::{Deserialize, Serialize};
use sqlx::Row;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoAlias {
    /// None = global default.
    pub profile_id: Option<i64>,
    pub repo_id: i64,
    pub alias: String,
    pub updated_at: i64,
}

fn parse_alias(r: sqlx::sqlite::SqliteRow) -> AppResult<RepoAlias> {
    Ok(RepoAlias {
        profile_id: r.try_get("profile_id")?,
        repo_id: r.try_get("repo_id")?,
        alias: r.try_get("alias")?,
        updated_at: r.try_get("updated_at")?,
    })
}

/// 한 레포의 모든 alias (per-profile + global). Sidebar bulk lookup 용.
pub async fn list_for_repo(db: &Db, repo_id: i64) -> AppResult<Vec<RepoAlias>> {
    let rows = sqlx::query(
        "SELECT profile_id, repo_id, alias, updated_at \
         FROM repo_alias WHERE repo_id = ?",
    )
    .bind(repo_id)
    .fetch_all(&db.pool)
    .await
    .map_err(AppError::Db)?;
    rows.into_iter().map(parse_alias).collect()
}

/// 모든 레포의 모든 alias 한 번에 (Sidebar 처음 렌더 시 N+1 회피).
pub async fn list_all(db: &Db) -> AppResult<Vec<RepoAlias>> {
    let rows = sqlx::query("SELECT profile_id, repo_id, alias, updated_at FROM repo_alias")
        .fetch_all(&db.pool)
        .await
        .map_err(AppError::Db)?;
    rows.into_iter().map(parse_alias).collect()
}

/// 활성 profile (또는 global) 의 alias 1개. 둘 다 없으면 None.
pub async fn resolve(
    db: &Db,
    repo_id: i64,
    active_profile: Option<i64>,
) -> AppResult<Option<String>> {
    if let Some(pid) = active_profile {
        let row = sqlx::query("SELECT alias FROM repo_alias WHERE repo_id = ? AND profile_id = ?")
            .bind(repo_id)
            .bind(pid)
            .fetch_optional(&db.pool)
            .await
            .map_err(AppError::Db)?;
        if let Some(r) = row {
            return Ok(Some(r.try_get("alias")?));
        }
    }
    let row = sqlx::query("SELECT alias FROM repo_alias WHERE repo_id = ? AND profile_id IS NULL")
        .bind(repo_id)
        .fetch_optional(&db.pool)
        .await
        .map_err(AppError::Db)?;
    Ok(match row {
        Some(r) => Some(r.try_get("alias")?),
        None => None,
    })
}

pub async fn set(
    db: &Db,
    repo_id: i64,
    profile_id: Option<i64>,
    alias: &str,
) -> AppResult<RepoAlias> {
    let trimmed = alias.trim();
    if trimmed.is_empty() {
        return Err(AppError::validation("alias 비어있음"));
    }
    if trimmed.chars().count() > 80 {
        return Err(AppError::validation("alias 80자 이내"));
    }
    let now = chrono::Utc::now().timestamp();

    // expression UNIQUE INDEX 가 (COALESCE(profile_id, -1), repo_id) 라
    // ON CONFLICT 표현이 까다로움 — 명시적 SELECT 후 INSERT/UPDATE 분기.
    let existing = sqlx::query(
        "SELECT 1 FROM repo_alias \
         WHERE repo_id = ? AND COALESCE(profile_id, -1) = COALESCE(?, -1)",
    )
    .bind(repo_id)
    .bind(profile_id)
    .fetch_optional(&db.pool)
    .await
    .map_err(AppError::Db)?;

    if existing.is_some() {
        sqlx::query(
            "UPDATE repo_alias SET alias = ?, updated_at = ? \
             WHERE repo_id = ? AND COALESCE(profile_id, -1) = COALESCE(?, -1)",
        )
        .bind(trimmed)
        .bind(now)
        .bind(repo_id)
        .bind(profile_id)
        .execute(&db.pool)
        .await
        .map_err(AppError::Db)?;
    } else {
        sqlx::query(
            "INSERT INTO repo_alias (profile_id, repo_id, alias, updated_at) \
             VALUES (?, ?, ?, ?)",
        )
        .bind(profile_id)
        .bind(repo_id)
        .bind(trimmed)
        .bind(now)
        .execute(&db.pool)
        .await
        .map_err(AppError::Db)?;
    }

    Ok(RepoAlias {
        profile_id,
        repo_id,
        alias: trimmed.to_string(),
        updated_at: now,
    })
}

pub async fn unset(db: &Db, repo_id: i64, profile_id: Option<i64>) -> AppResult<()> {
    sqlx::query(
        "DELETE FROM repo_alias \
         WHERE repo_id = ? AND COALESCE(profile_id, -1) = COALESCE(?, -1)",
    )
    .bind(repo_id)
    .bind(profile_id)
    .execute(&db.pool)
    .await
    .map_err(AppError::Db)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::repository::ForgeKindLite;
    use crate::storage::DbExt;

    async fn open_test_db() -> Db {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        Db::open(tmp.path()).await.unwrap()
    }

    async fn add_test_repo(db: &Db, name: &str, path: &str) -> i64 {
        db.add_repo(
            path,
            None,
            Some(name),
            Some("main"),
            None,
            ForgeKindLite::Github,
            None,
            None,
        )
        .await
        .unwrap()
        .id
    }

    #[tokio::test]
    async fn test_set_and_resolve_global() {
        let db = open_test_db().await;
        let r = add_test_repo(&db, "frontend", "/tmp/r1").await;

        let a = set(&db, r, None, "회사 메인").await.unwrap();
        assert_eq!(a.alias, "회사 메인");
        assert_eq!(a.profile_id, None);

        let res = resolve(&db, r, None).await.unwrap();
        assert_eq!(res.as_deref(), Some("회사 메인"));
    }

    #[tokio::test]
    async fn test_per_profile_overrides_global() {
        let db = open_test_db().await;
        let r = add_test_repo(&db, "frontend", "/tmp/r1").await;

        // 이 프로필을 만들기 위해 직접 INSERT (profiles CRUD 가 별도 모듈).
        sqlx::query(
            "INSERT INTO profiles (name, git_user_name, git_user_email) \
             VALUES ('회사', '실명', 'work@x'), ('개인', '닉', 'me@x')",
        )
        .execute(&db.pool)
        .await
        .unwrap();
        let pid_corp: i64 = sqlx::query("SELECT id FROM profiles WHERE name = '회사'")
            .fetch_one(&db.pool)
            .await
            .unwrap()
            .try_get("id")
            .unwrap();

        set(&db, r, None, "default").await.unwrap();
        set(&db, r, Some(pid_corp), "회사용").await.unwrap();

        let with_corp = resolve(&db, r, Some(pid_corp)).await.unwrap();
        assert_eq!(with_corp.as_deref(), Some("회사용"));

        // 다른 profile 은 global 로 fallback.
        let pid_personal: i64 = sqlx::query("SELECT id FROM profiles WHERE name = '개인'")
            .fetch_one(&db.pool)
            .await
            .unwrap()
            .try_get("id")
            .unwrap();
        let with_personal = resolve(&db, r, Some(pid_personal)).await.unwrap();
        assert_eq!(with_personal.as_deref(), Some("default"));
    }

    #[tokio::test]
    async fn test_set_idempotent_updates_alias() {
        let db = open_test_db().await;
        let r = add_test_repo(&db, "x", "/tmp/x").await;
        set(&db, r, None, "v1").await.unwrap();
        set(&db, r, None, "v2").await.unwrap();
        let res = resolve(&db, r, None).await.unwrap();
        assert_eq!(res.as_deref(), Some("v2"));
        let all = list_for_repo(&db, r).await.unwrap();
        assert_eq!(all.len(), 1);
    }

    #[tokio::test]
    async fn test_unset_removes_only_target() {
        let db = open_test_db().await;
        let r = add_test_repo(&db, "x", "/tmp/x").await;
        sqlx::query("INSERT INTO profiles (name) VALUES ('p1')")
            .execute(&db.pool)
            .await
            .unwrap();
        let pid: i64 = sqlx::query("SELECT id FROM profiles WHERE name = 'p1'")
            .fetch_one(&db.pool)
            .await
            .unwrap()
            .try_get("id")
            .unwrap();
        set(&db, r, None, "global").await.unwrap();
        set(&db, r, Some(pid), "per").await.unwrap();

        unset(&db, r, Some(pid)).await.unwrap();
        let all = list_for_repo(&db, r).await.unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].profile_id, None);
    }

    #[tokio::test]
    async fn test_validation_empty_or_long() {
        let db = open_test_db().await;
        let r = add_test_repo(&db, "x", "/tmp/x").await;
        assert!(set(&db, r, None, "").await.is_err());
        assert!(set(&db, r, None, "   ").await.is_err());
        let long = "가".repeat(81);
        assert!(set(&db, r, None, &long).await.is_err());
    }

    #[tokio::test]
    async fn test_repo_delete_cascades() {
        let db = open_test_db().await;
        let r = add_test_repo(&db, "x", "/tmp/x").await;
        set(&db, r, None, "alias").await.unwrap();
        db.remove_repo(r).await.unwrap();
        let all = list_for_repo(&db, r).await.unwrap();
        assert!(all.is_empty(), "ON DELETE CASCADE 동작");
    }
}
