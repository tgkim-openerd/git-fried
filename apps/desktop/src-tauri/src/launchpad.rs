// Launchpad PR meta + Saved Views (`docs/plan/11 §14` / Sprint A4).
//
// PR 식별자 = 5-tuple (forge_kind, base_url, owner, repo, number).
// Pin / Snooze / Saved Views 모두 SQLite 영속화 — 재시작 후 보존.

use crate::error::{AppError, AppResult};
use crate::storage::Db;
use serde::{Deserialize, Serialize};
use sqlx::Row;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrId {
    pub forge_kind: String,
    pub base_url: String,
    pub owner: String,
    pub repo: String,
    pub number: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrMeta {
    pub id: i64,
    pub forge_kind: String,
    pub base_url: String,
    pub owner: String,
    pub repo: String,
    pub number: i64,
    pub pinned: bool,
    /// unix ts; None 이면 active. 만료된 시각이면 UI 가 active 로 처리.
    pub snoozed_until: Option<i64>,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedView {
    pub id: i64,
    pub view_kind: String,
    pub name: String,
    pub filter_json: String,
    pub sort_json: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

// ====== PR meta ======

fn validate_pr_id(id: &PrId) -> AppResult<()> {
    if id.forge_kind.trim().is_empty()
        || id.base_url.trim().is_empty()
        || id.owner.trim().is_empty()
        || id.repo.trim().is_empty()
    {
        return Err(AppError::validation("PR 식별자에 빈 필드"));
    }
    if id.number <= 0 {
        return Err(AppError::validation("PR number 는 1 이상"));
    }
    Ok(())
}

fn parse_pr_meta(r: sqlx::sqlite::SqliteRow) -> AppResult<PrMeta> {
    Ok(PrMeta {
        id: r.try_get("id")?,
        forge_kind: r.try_get("forge_kind")?,
        base_url: r.try_get("base_url")?,
        owner: r.try_get("owner")?,
        repo: r.try_get("repo")?,
        number: r.try_get("number")?,
        pinned: r.try_get::<i64, _>("pinned")? != 0,
        snoozed_until: r.try_get("snoozed_until")?,
        updated_at: r.try_get("updated_at")?,
    })
}

/// 현재 시각 기준 active 한 모든 PR meta (pinned 또는 snoozed_until > now).
/// Launchpad 가 forge fetch 결과와 join 해서 실제 표시 결정.
pub async fn list_active(db: &Db) -> AppResult<Vec<PrMeta>> {
    let now = chrono::Utc::now().timestamp();
    let rows = sqlx::query(
        "SELECT * FROM pr_meta \
         WHERE pinned = 1 OR (snoozed_until IS NOT NULL AND snoozed_until > ?) \
         ORDER BY pinned DESC, updated_at DESC",
    )
    .bind(now)
    .fetch_all(&db.pool)
    .await
    .map_err(AppError::Db)?;
    rows.into_iter().map(parse_pr_meta).collect()
}

/// 한 레포의 모든 PR meta (Launchpad row 매칭용 일괄 fetch).
pub async fn list_for_repo(
    db: &Db,
    forge_kind: &str,
    base_url: &str,
    owner: &str,
    repo: &str,
) -> AppResult<Vec<PrMeta>> {
    let rows = sqlx::query(
        "SELECT * FROM pr_meta \
         WHERE forge_kind = ? AND base_url = ? AND owner = ? AND repo = ?",
    )
    .bind(forge_kind)
    .bind(base_url)
    .bind(owner)
    .bind(repo)
    .fetch_all(&db.pool)
    .await
    .map_err(AppError::Db)?;
    rows.into_iter().map(parse_pr_meta).collect()
}

/// 단일 PR meta (없으면 None — 행이 없는 PR 은 default state).
pub async fn get(db: &Db, id: &PrId) -> AppResult<Option<PrMeta>> {
    validate_pr_id(id)?;
    let row = sqlx::query(
        "SELECT * FROM pr_meta \
         WHERE forge_kind = ? AND base_url = ? AND owner = ? AND repo = ? AND number = ?",
    )
    .bind(&id.forge_kind)
    .bind(&id.base_url)
    .bind(&id.owner)
    .bind(&id.repo)
    .bind(id.number)
    .fetch_optional(&db.pool)
    .await
    .map_err(AppError::Db)?;
    match row {
        Some(r) => Ok(Some(parse_pr_meta(r)?)),
        None => Ok(None),
    }
}

/// upsert 패턴 — INSERT OR UPDATE the meta of a PR.
async fn upsert_with(
    db: &Db,
    id: &PrId,
    pinned: i64,
    snoozed_until: Option<i64>,
) -> AppResult<PrMeta> {
    validate_pr_id(id)?;
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "INSERT INTO pr_meta (forge_kind, base_url, owner, repo, number, pinned, snoozed_until, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) \
         ON CONFLICT (forge_kind, base_url, owner, repo, number) DO UPDATE SET \
           pinned = excluded.pinned, \
           snoozed_until = excluded.snoozed_until, \
           updated_at = excluded.updated_at",
    )
    .bind(&id.forge_kind)
    .bind(&id.base_url)
    .bind(&id.owner)
    .bind(&id.repo)
    .bind(id.number)
    .bind(pinned)
    .bind(snoozed_until)
    .bind(now)
    .execute(&db.pool)
    .await
    .map_err(AppError::Db)?;

    get(db, id)
        .await?
        .ok_or_else(|| AppError::internal("upsert 후 row 사라짐"))
}

pub async fn set_pinned(db: &Db, id: &PrId, pinned: bool) -> AppResult<PrMeta> {
    let existing = get(db, id).await?;
    let snoozed = existing.and_then(|m| m.snoozed_until);
    upsert_with(db, id, if pinned { 1 } else { 0 }, snoozed).await
}

pub async fn set_snooze(
    db: &Db,
    id: &PrId,
    snoozed_until: Option<i64>,
) -> AppResult<PrMeta> {
    let existing = get(db, id).await?;
    let pinned = existing.map(|m| if m.pinned { 1i64 } else { 0 }).unwrap_or(0);
    upsert_with(db, id, pinned, snoozed_until).await
}

/// snooze 해제 = NULL 로 설정.
pub async fn clear_snooze(db: &Db, id: &PrId) -> AppResult<PrMeta> {
    set_snooze(db, id, None).await
}

/// Pin / Snooze 둘 다 default 면 행 자체 제거 (storage 절약, optional).
pub async fn cleanup_defaults(db: &Db) -> AppResult<u64> {
    let now = chrono::Utc::now().timestamp();
    let r = sqlx::query(
        "DELETE FROM pr_meta \
         WHERE pinned = 0 AND (snoozed_until IS NULL OR snoozed_until <= ?)",
    )
    .bind(now)
    .execute(&db.pool)
    .await
    .map_err(AppError::Db)?;
    Ok(r.rows_affected())
}

// ====== Saved Views ======

fn parse_view(r: sqlx::sqlite::SqliteRow) -> AppResult<SavedView> {
    Ok(SavedView {
        id: r.try_get("id")?,
        view_kind: r.try_get("view_kind")?,
        name: r.try_get("name")?,
        filter_json: r.try_get("filter_json")?,
        sort_json: r.try_get("sort_json")?,
        created_at: r.try_get("created_at")?,
        updated_at: r.try_get("updated_at")?,
    })
}

pub async fn list_views(db: &Db, view_kind: &str) -> AppResult<Vec<SavedView>> {
    let rows = sqlx::query(
        "SELECT * FROM saved_views WHERE view_kind = ? ORDER BY name",
    )
    .bind(view_kind)
    .fetch_all(&db.pool)
    .await
    .map_err(AppError::Db)?;
    rows.into_iter().map(parse_view).collect()
}

pub async fn save_view(
    db: &Db,
    view_kind: &str,
    name: &str,
    filter_json: &str,
    sort_json: Option<&str>,
) -> AppResult<SavedView> {
    if view_kind.trim().is_empty() || name.trim().is_empty() {
        return Err(AppError::validation("view_kind / name 비어있음"));
    }
    // 빠른 JSON 검증 — 파싱 가능한지만.
    let _: serde_json::Value =
        serde_json::from_str(filter_json).map_err(AppError::Json)?;
    if let Some(s) = sort_json {
        let _: serde_json::Value = serde_json::from_str(s).map_err(AppError::Json)?;
    }
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "INSERT INTO saved_views (view_kind, name, filter_json, sort_json, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?) \
         ON CONFLICT (view_kind, name) DO UPDATE SET \
           filter_json = excluded.filter_json, \
           sort_json = excluded.sort_json, \
           updated_at = excluded.updated_at",
    )
    .bind(view_kind)
    .bind(name)
    .bind(filter_json)
    .bind(sort_json)
    .bind(now)
    .bind(now)
    .execute(&db.pool)
    .await
    .map_err(AppError::Db)?;

    let row = sqlx::query("SELECT * FROM saved_views WHERE view_kind = ? AND name = ?")
        .bind(view_kind)
        .bind(name)
        .fetch_one(&db.pool)
        .await
        .map_err(AppError::Db)?;
    parse_view(row)
}

pub async fn delete_view(db: &Db, id: i64) -> AppResult<()> {
    sqlx::query("DELETE FROM saved_views WHERE id = ?")
        .bind(id)
        .execute(&db.pool)
        .await
        .map_err(AppError::Db)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn open_test_db() -> Db {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        Db::open(tmp.path()).await.unwrap()
    }

    fn pr(num: i64) -> PrId {
        PrId {
            forge_kind: "gitea".into(),
            base_url: "https://git.dev.opnd.io".into(),
            owner: "opnd-frontend".into(),
            repo: "ankentrip".into(),
            number: num,
        }
    }

    #[tokio::test]
    async fn test_pin_unpin_round_trip() {
        let db = open_test_db().await;
        let m1 = set_pinned(&db, &pr(42), true).await.unwrap();
        assert!(m1.pinned);
        assert_eq!(m1.number, 42);

        let m2 = set_pinned(&db, &pr(42), false).await.unwrap();
        assert!(!m2.pinned);
        assert_eq!(m2.id, m1.id, "같은 row 갱신");
    }

    #[tokio::test]
    async fn test_snooze_and_clear() {
        let db = open_test_db().await;
        let until = chrono::Utc::now().timestamp() + 3600;
        let m1 = set_snooze(&db, &pr(7), Some(until)).await.unwrap();
        assert_eq!(m1.snoozed_until, Some(until));
        assert!(!m1.pinned);

        let m2 = clear_snooze(&db, &pr(7)).await.unwrap();
        assert_eq!(m2.snoozed_until, None);
    }

    #[tokio::test]
    async fn test_pin_and_snooze_coexist() {
        let db = open_test_db().await;
        set_pinned(&db, &pr(1), true).await.unwrap();
        let until = chrono::Utc::now().timestamp() + 600;
        let m = set_snooze(&db, &pr(1), Some(until)).await.unwrap();
        assert!(m.pinned, "snooze 설정해도 pin 보존");
        assert_eq!(m.snoozed_until, Some(until));
    }

    #[tokio::test]
    async fn test_list_active_filters_expired_snooze() {
        let db = open_test_db().await;
        // pinned PR
        set_pinned(&db, &pr(10), true).await.unwrap();
        // active snooze
        let future = chrono::Utc::now().timestamp() + 3600;
        set_snooze(&db, &pr(20), Some(future)).await.unwrap();
        // expired snooze
        set_snooze(&db, &pr(30), Some(0)).await.unwrap();

        let active = list_active(&db).await.unwrap();
        let nums: Vec<i64> = active.iter().map(|m| m.number).collect();
        assert!(nums.contains(&10), "pinned 포함");
        assert!(nums.contains(&20), "active snooze 포함");
        assert!(!nums.contains(&30), "만료된 snooze 제외");
    }

    #[tokio::test]
    async fn test_list_for_repo_korean() {
        let db = open_test_db().await;
        let mut p = pr(1);
        p.owner = "회사".into();
        p.repo = "한글-레포".into();
        set_pinned(&db, &p, true).await.unwrap();

        let list = list_for_repo(
            &db,
            &p.forge_kind,
            &p.base_url,
            &p.owner,
            &p.repo,
        )
        .await
        .unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].owner, "회사");
        assert_eq!(list[0].repo, "한글-레포");
    }

    #[tokio::test]
    async fn test_cleanup_defaults_keeps_pinned() {
        let db = open_test_db().await;
        set_pinned(&db, &pr(1), true).await.unwrap();
        set_snooze(&db, &pr(2), Some(0)).await.unwrap(); // 만료
        let removed = cleanup_defaults(&db).await.unwrap();
        assert_eq!(removed, 1);
        let remain = list_for_repo(&db, "gitea", "https://git.dev.opnd.io", "opnd-frontend", "ankentrip")
            .await
            .unwrap();
        assert_eq!(remain.len(), 1);
        assert!(remain[0].pinned);
    }

    #[tokio::test]
    async fn test_validation_rejects_empty_or_zero() {
        let db = open_test_db().await;
        let mut p = pr(1);
        p.owner = "".into();
        let r = set_pinned(&db, &p, true).await;
        assert!(r.is_err());

        let mut p2 = pr(0);
        p2.number = 0;
        let r2 = set_pinned(&db, &p2, true).await;
        assert!(r2.is_err());
    }

    // ====== Saved Views ======

    #[tokio::test]
    async fn test_saved_view_round_trip() {
        let db = open_test_db().await;
        let v = save_view(
            &db,
            "launchpad_pr",
            "내 PR",
            r#"{"author":"me","state":"open"}"#,
            Some(r#"{"by":"updated","dir":"desc"}"#),
        )
        .await
        .unwrap();
        assert!(v.id >= 1);
        assert_eq!(v.name, "내 PR");

        let list = list_views(&db, "launchpad_pr").await.unwrap();
        assert_eq!(list.len(), 1);

        // 같은 (kind, name) 다시 save → upsert.
        let v2 = save_view(
            &db,
            "launchpad_pr",
            "내 PR",
            r#"{"author":"me","state":"closed"}"#,
            None,
        )
        .await
        .unwrap();
        assert_eq!(v2.id, v.id);
        assert!(v2.filter_json.contains("closed"));
        assert_eq!(v2.sort_json, None);
    }

    #[tokio::test]
    async fn test_saved_view_invalid_json_rejects() {
        let db = open_test_db().await;
        let r = save_view(&db, "launchpad_pr", "x", "not-json", None).await;
        assert!(r.is_err());
    }

    #[tokio::test]
    async fn test_saved_view_kind_isolation() {
        let db = open_test_db().await;
        save_view(&db, "launchpad_pr", "v1", "{}", None).await.unwrap();
        save_view(&db, "commit_search", "v1", "{}", None).await.unwrap();
        let pr_views = list_views(&db, "launchpad_pr").await.unwrap();
        let cs_views = list_views(&db, "commit_search").await.unwrap();
        assert_eq!(pr_views.len(), 1);
        assert_eq!(cs_views.len(), 1);
        assert_eq!(pr_views[0].view_kind, "launchpad_pr");
    }

    #[tokio::test]
    async fn test_saved_view_delete() {
        let db = open_test_db().await;
        let v = save_view(&db, "launchpad_pr", "x", "{}", None).await.unwrap();
        delete_view(&db, v.id).await.unwrap();
        let list = list_views(&db, "launchpad_pr").await.unwrap();
        assert!(list.is_empty());
    }
}
