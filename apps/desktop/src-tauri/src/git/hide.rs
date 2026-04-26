// Hide branches — 시각화 필터 (`docs/plan/11 §5d`).
//
// 핵심:
//   - 데이터 변경 0 (git 자체의 ref / commit 은 그대로).
//   - Frontend 가 `list_hidden(repo_id)` 로 가져와서 그래프 / 패널 렌더링 시 제외.
//   - bulk hide: section 헤더 우클릭 → "Hide all Remotes / Tags / ..." 일괄.
//   - Solo 는 transient (세션 메모리) — 본 모듈은 영속 hide 만 다룸.
//
// 향후 확장 (v1.x):
//   - hidden ref 만 도달 가능한 commit 도 그래프에서 빼는 commit-level filter
//     (현재 v1 은 ref label 만 숨김 — 단순/안전).

use crate::error::{AppError, AppResult};
use crate::storage::Db;
use serde::{Deserialize, Serialize};
use sqlx::Row;

/// Hide 영속화 ref 의 종류. v1.x 의 bulk hide 시 sub-set 기준.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HiddenRefKind {
    Branch,
    Remote,
    Tag,
    Stash,
}

impl HiddenRefKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Branch => "branch",
            Self::Remote => "remote",
            Self::Tag => "tag",
            Self::Stash => "stash",
        }
    }

    pub fn parse(s: &str) -> AppResult<Self> {
        match s {
            "branch" => Ok(Self::Branch),
            "remote" => Ok(Self::Remote),
            "tag" => Ok(Self::Tag),
            "stash" => Ok(Self::Stash),
            other => Err(AppError::validation(format!(
                "unknown hidden ref kind: {other}"
            ))),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HiddenRef {
    pub ref_name: String,
    pub ref_kind: HiddenRefKind,
    pub hidden_at: i64,
}

/// 한 레포의 hidden ref 전체 목록.
pub async fn list_hidden(db: &Db, repo_id: i64) -> AppResult<Vec<HiddenRef>> {
    let rows = sqlx::query(
        "SELECT ref_name, ref_kind, hidden_at \
         FROM repo_ref_hidden WHERE repo_id = ? \
         ORDER BY ref_kind, ref_name",
    )
    .bind(repo_id)
    .fetch_all(&db.pool)
    .await
    .map_err(AppError::Db)?;

    let mut out = Vec::with_capacity(rows.len());
    for r in rows {
        let kind_str: String = r.try_get("ref_kind")?;
        out.push(HiddenRef {
            ref_name: r.try_get("ref_name")?,
            ref_kind: HiddenRefKind::parse(&kind_str)?,
            hidden_at: r.try_get("hidden_at")?,
        });
    }
    Ok(out)
}

/// 단일 ref 를 hide 마킹 (idempotent — 이미 있으면 hidden_at 만 갱신).
pub async fn hide(db: &Db, repo_id: i64, ref_name: &str, ref_kind: HiddenRefKind) -> AppResult<()> {
    if ref_name.trim().is_empty() {
        return Err(AppError::validation("ref_name 비어있음"));
    }
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "INSERT INTO repo_ref_hidden (repo_id, ref_name, ref_kind, hidden_at) \
         VALUES (?, ?, ?, ?) \
         ON CONFLICT(repo_id, ref_name) DO UPDATE SET \
           ref_kind = excluded.ref_kind, \
           hidden_at = excluded.hidden_at",
    )
    .bind(repo_id)
    .bind(ref_name)
    .bind(ref_kind.as_str())
    .bind(now)
    .execute(&db.pool)
    .await
    .map_err(AppError::Db)?;
    Ok(())
}

/// 단일 ref unhide. 없으면 no-op.
pub async fn unhide(db: &Db, repo_id: i64, ref_name: &str) -> AppResult<()> {
    sqlx::query("DELETE FROM repo_ref_hidden WHERE repo_id = ? AND ref_name = ?")
        .bind(repo_id)
        .bind(ref_name)
        .execute(&db.pool)
        .await
        .map_err(AppError::Db)?;
    Ok(())
}

/// 다수 ref 일괄 hide (예: 모든 remote 한 번에).
pub async fn hide_many(
    db: &Db,
    repo_id: i64,
    refs: &[(String, HiddenRefKind)],
) -> AppResult<usize> {
    if refs.is_empty() {
        return Ok(0);
    }
    let now = chrono::Utc::now().timestamp();
    let mut tx = db.pool.begin().await.map_err(AppError::Db)?;
    let mut inserted = 0usize;
    for (name, kind) in refs {
        if name.trim().is_empty() {
            continue;
        }
        sqlx::query(
            "INSERT INTO repo_ref_hidden (repo_id, ref_name, ref_kind, hidden_at) \
             VALUES (?, ?, ?, ?) \
             ON CONFLICT(repo_id, ref_name) DO UPDATE SET \
               ref_kind = excluded.ref_kind, \
               hidden_at = excluded.hidden_at",
        )
        .bind(repo_id)
        .bind(name)
        .bind(kind.as_str())
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Db)?;
        inserted += 1;
    }
    tx.commit().await.map_err(AppError::Db)?;
    Ok(inserted)
}

/// 한 종류의 ref 만 모두 unhide (예: 모든 remote 다시 표시).
pub async fn unhide_kind(db: &Db, repo_id: i64, kind: HiddenRefKind) -> AppResult<u64> {
    let r = sqlx::query("DELETE FROM repo_ref_hidden WHERE repo_id = ? AND ref_kind = ?")
        .bind(repo_id)
        .bind(kind.as_str())
        .execute(&db.pool)
        .await
        .map_err(AppError::Db)?;
    Ok(r.rows_affected())
}

/// 한 레포의 hidden 전부 클리어.
pub async fn unhide_all(db: &Db, repo_id: i64) -> AppResult<u64> {
    let r = sqlx::query("DELETE FROM repo_ref_hidden WHERE repo_id = ?")
        .bind(repo_id)
        .execute(&db.pool)
        .await
        .map_err(AppError::Db)?;
    Ok(r.rows_affected())
}

/// Lazy GC — 현재 존재하지 않는 ref 의 hidden 엔트리 제거.
/// `valid_refs` 는 git branch/tag list 결과. 빈 vec 이면 no-op (안전).
pub async fn gc_stale(db: &Db, repo_id: i64, valid_refs: &[String]) -> AppResult<u64> {
    if valid_refs.is_empty() {
        return Ok(0);
    }
    // SQLite 변수 바인딩 한도 (보통 999) 회피 — IN 절 chunking.
    let mut total_deleted = 0u64;
    for chunk in valid_refs.chunks(500) {
        let placeholders = std::iter::repeat("?")
            .take(chunk.len())
            .collect::<Vec<_>>()
            .join(",");
        let q = format!(
            "DELETE FROM repo_ref_hidden \
             WHERE repo_id = ? AND ref_name NOT IN ({placeholders})"
        );
        let mut query = sqlx::query(&q).bind(repo_id);
        for r in chunk {
            query = query.bind(r);
        }
        let res = query.execute(&db.pool).await.map_err(AppError::Db)?;
        total_deleted += res.rows_affected();
    }
    Ok(total_deleted)
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

    async fn add_test_repo(db: &Db) -> i64 {
        let r = db
            .add_repo(
                "/tmp/test-repo",
                None,
                Some("test"),
                Some("main"),
                None,
                ForgeKindLite::Github,
                None,
                None,
            )
            .await
            .unwrap();
        r.id
    }

    #[tokio::test]
    async fn test_hide_unhide_round_trip() {
        let db = open_test_db().await;
        let repo_id = add_test_repo(&db).await;

        hide(&db, repo_id, "origin/feature/한글", HiddenRefKind::Remote)
            .await
            .unwrap();
        hide(&db, repo_id, "old-branch", HiddenRefKind::Branch)
            .await
            .unwrap();

        let list = list_hidden(&db, repo_id).await.unwrap();
        assert_eq!(list.len(), 2);
        assert!(list.iter().any(|h| h.ref_name == "old-branch"));
        // 한글 round-trip
        assert!(list
            .iter()
            .any(|h| h.ref_name == "origin/feature/한글" && h.ref_kind == HiddenRefKind::Remote));

        unhide(&db, repo_id, "old-branch").await.unwrap();
        let list2 = list_hidden(&db, repo_id).await.unwrap();
        assert_eq!(list2.len(), 1);
        assert_eq!(list2[0].ref_name, "origin/feature/한글");
    }

    #[tokio::test]
    async fn test_hide_idempotent_updates_kind() {
        let db = open_test_db().await;
        let repo_id = add_test_repo(&db).await;

        hide(&db, repo_id, "x", HiddenRefKind::Branch)
            .await
            .unwrap();
        hide(&db, repo_id, "x", HiddenRefKind::Tag).await.unwrap();
        let list = list_hidden(&db, repo_id).await.unwrap();
        assert_eq!(list.len(), 1, "duplicate insert 가 같은 row 갱신");
        assert_eq!(list[0].ref_kind, HiddenRefKind::Tag);
    }

    #[tokio::test]
    async fn test_unhide_kind_deletes_only_matching() {
        let db = open_test_db().await;
        let repo_id = add_test_repo(&db).await;

        hide_many(
            &db,
            repo_id,
            &[
                ("origin/a".into(), HiddenRefKind::Remote),
                ("origin/b".into(), HiddenRefKind::Remote),
                ("local-x".into(), HiddenRefKind::Branch),
                ("v1.0".into(), HiddenRefKind::Tag),
            ],
        )
        .await
        .unwrap();
        assert_eq!(list_hidden(&db, repo_id).await.unwrap().len(), 4);

        let removed = unhide_kind(&db, repo_id, HiddenRefKind::Remote)
            .await
            .unwrap();
        assert_eq!(removed, 2);

        let remain = list_hidden(&db, repo_id).await.unwrap();
        assert_eq!(remain.len(), 2);
        assert!(remain.iter().all(|h| h.ref_kind != HiddenRefKind::Remote));
    }

    #[tokio::test]
    async fn test_gc_stale_removes_unknown_refs() {
        let db = open_test_db().await;
        let repo_id = add_test_repo(&db).await;

        hide_many(
            &db,
            repo_id,
            &[
                ("a".into(), HiddenRefKind::Branch),
                ("b".into(), HiddenRefKind::Branch),
                ("zombie".into(), HiddenRefKind::Branch),
            ],
        )
        .await
        .unwrap();

        let removed = gc_stale(&db, repo_id, &["a".into(), "b".into()])
            .await
            .unwrap();
        assert_eq!(removed, 1);

        let list = list_hidden(&db, repo_id).await.unwrap();
        assert_eq!(list.len(), 2);
        assert!(list.iter().all(|h| h.ref_name != "zombie"));
    }

    #[tokio::test]
    async fn test_unhide_all_clears_repo() {
        let db = open_test_db().await;
        let repo_id = add_test_repo(&db).await;
        hide(&db, repo_id, "x", HiddenRefKind::Branch)
            .await
            .unwrap();
        hide(&db, repo_id, "y", HiddenRefKind::Tag).await.unwrap();
        let removed = unhide_all(&db, repo_id).await.unwrap();
        assert_eq!(removed, 2);
        assert!(list_hidden(&db, repo_id).await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_repo_delete_cascades_hidden() {
        let db = open_test_db().await;
        let repo_id = add_test_repo(&db).await;
        hide(&db, repo_id, "x", HiddenRefKind::Branch)
            .await
            .unwrap();
        db.remove_repo(repo_id).await.unwrap();
        // ON DELETE CASCADE → 자동 정리
        let list = list_hidden(&db, repo_id).await.unwrap();
        assert!(list.is_empty(), "repo 삭제 시 hidden 도 cascade 삭제");
    }
}
