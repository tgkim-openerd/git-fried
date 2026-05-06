// SQLite 풀 + 마이그레이션 + repo / workspace CRUD.

use crate::error::{AppError, AppResult};
use crate::git::repository::ForgeKindLite;
use serde::{Deserialize, Serialize};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{Row, SqlitePool};
use std::path::{Path, PathBuf};
use std::str::FromStr;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub id: i64,
    pub name: String,
    pub color: Option<String>,
    pub forge_kind: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Repo {
    pub id: i64,
    pub workspace_id: Option<i64>,
    pub name: String,
    pub local_path: String,
    pub default_remote: Option<String>,
    pub default_branch: Option<String>,
    pub forge_kind: String,
    pub forge_owner: Option<String>,
    pub forge_repo: Option<String>,
    pub last_fetched_at: Option<i64>,
    pub is_pinned: bool,
}

#[derive(Clone)]
pub struct Db {
    pub pool: SqlitePool,
}

impl Db {
    /// `~/.git-fried/db.sqlite` (또는 macOS `~/Library/Application Support/...`)
    pub async fn open_default() -> AppResult<Self> {
        let path = default_db_path()?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(AppError::Io)?;
        }
        Self::open(&path).await
    }

    pub async fn open(path: &Path) -> AppResult<Self> {
        let url = format!("sqlite://{}?mode=rwc", path.to_string_lossy());
        let opts = SqliteConnectOptions::from_str(&url)
            .map_err(|e| AppError::Internal(format!("DB URL parse: {e}")))?
            .create_if_missing(true)
            .foreign_keys(true)
            .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
            .synchronous(sqlx::sqlite::SqliteSynchronous::Normal);

        let pool = SqlitePoolOptions::new()
            .max_connections(8)
            .connect_with(opts)
            .await
            .map_err(AppError::Db)?;

        // 마이그레이션 — 시작 시 항상 실행. 멱등성 보장.
        sqlx::migrate!("./src/storage/migrations")
            .run(&pool)
            .await
            .map_err(AppError::Migrate)?;

        Ok(Self { pool })
    }
}

#[async_trait::async_trait]
pub trait DbExt {
    async fn list_workspaces(&self) -> AppResult<Vec<Workspace>>;
    async fn create_workspace(&self, name: &str, color: Option<&str>) -> AppResult<Workspace>;
    async fn update_workspace(
        &self,
        id: i64,
        name: Option<&str>,
        color: Option<&str>,
    ) -> AppResult<Workspace>;
    async fn delete_workspace(&self, id: i64) -> AppResult<()>;
    async fn list_repos(&self, workspace_id: Option<i64>) -> AppResult<Vec<Repo>>;
    async fn add_repo(
        &self,
        local_path: &str,
        workspace_id: Option<i64>,
        name: Option<&str>,
        default_branch: Option<&str>,
        default_remote: Option<&str>,
        forge_kind: ForgeKindLite,
        forge_owner: Option<&str>,
        forge_repo: Option<&str>,
    ) -> AppResult<Repo>;
    async fn remove_repo(&self, id: i64) -> AppResult<()>;
    async fn get_repo(&self, id: i64) -> AppResult<Repo>;
    async fn set_repo_pinned(&self, id: i64, pinned: bool) -> AppResult<Repo>;
}

#[async_trait::async_trait]
impl DbExt for Db {
    async fn list_workspaces(&self) -> AppResult<Vec<Workspace>> {
        let rows = sqlx::query(
            "SELECT id, name, color, forge_kind, created_at FROM workspaces ORDER BY name",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::Db)?;
        let mut out = Vec::with_capacity(rows.len());
        for r in rows {
            out.push(Workspace {
                id: r.try_get("id")?,
                name: r.try_get("name")?,
                color: r.try_get("color")?,
                forge_kind: r.try_get("forge_kind")?,
                created_at: r.try_get("created_at")?,
            });
        }
        Ok(out)
    }

    async fn update_workspace(
        &self,
        id: i64,
        name: Option<&str>,
        color: Option<&str>,
    ) -> AppResult<Workspace> {
        // 둘 다 None 이면 no-op fetch.
        if let Some(n) = name {
            sqlx::query("UPDATE workspaces SET name = ? WHERE id = ?")
                .bind(n)
                .bind(id)
                .execute(&self.pool)
                .await
                .map_err(AppError::Db)?;
        }
        if let Some(c) = color {
            sqlx::query("UPDATE workspaces SET color = ? WHERE id = ?")
                .bind(c)
                .bind(id)
                .execute(&self.pool)
                .await
                .map_err(AppError::Db)?;
        }
        let r = sqlx::query(
            "SELECT id, name, color, forge_kind, created_at FROM workspaces WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::Db)?
        .ok_or(AppError::WorkspaceNotFound(id))?;
        Ok(Workspace {
            id: r.try_get("id")?,
            name: r.try_get("name")?,
            color: r.try_get("color")?,
            forge_kind: r.try_get("forge_kind")?,
            created_at: r.try_get("created_at")?,
        })
    }

    async fn delete_workspace(&self, id: i64) -> AppResult<()> {
        // FK ON DELETE SET NULL 가 repos.workspace_id 자동 정리.
        sqlx::query("DELETE FROM workspaces WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(AppError::Db)?;
        Ok(())
    }

    async fn create_workspace(&self, name: &str, color: Option<&str>) -> AppResult<Workspace> {
        let now = chrono::Utc::now().timestamp();
        let id = sqlx::query(
            "INSERT INTO workspaces (name, color, forge_kind, created_at) VALUES (?, ?, 'mixed', ?)",
        )
        .bind(name)
        .bind(color)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(AppError::Db)?
        .last_insert_rowid();
        Ok(Workspace {
            id,
            name: name.to_string(),
            color: color.map(|s| s.to_string()),
            forge_kind: "mixed".into(),
            created_at: now,
        })
    }

    async fn list_repos(&self, workspace_id: Option<i64>) -> AppResult<Vec<Repo>> {
        let rows = if let Some(wid) = workspace_id {
            sqlx::query("SELECT * FROM repos WHERE workspace_id = ? ORDER BY is_pinned DESC, name")
                .bind(wid)
                .fetch_all(&self.pool)
                .await
        } else {
            sqlx::query("SELECT * FROM repos ORDER BY is_pinned DESC, name")
                .fetch_all(&self.pool)
                .await
        }
        .map_err(AppError::Db)?;

        let mut out = Vec::with_capacity(rows.len());
        for r in rows {
            out.push(Repo {
                id: r.try_get("id")?,
                workspace_id: r.try_get("workspace_id")?,
                name: r.try_get("name")?,
                local_path: r.try_get("local_path")?,
                default_remote: r.try_get("default_remote")?,
                default_branch: r.try_get("default_branch")?,
                forge_kind: r.try_get("forge_kind")?,
                forge_owner: r.try_get("forge_owner")?,
                forge_repo: r.try_get("forge_repo")?,
                last_fetched_at: r.try_get("last_fetched_at")?,
                is_pinned: r.try_get::<i64, _>("is_pinned")? != 0,
            });
        }
        Ok(out)
    }

    async fn add_repo(
        &self,
        local_path: &str,
        workspace_id: Option<i64>,
        name: Option<&str>,
        default_branch: Option<&str>,
        default_remote: Option<&str>,
        forge_kind: ForgeKindLite,
        forge_owner: Option<&str>,
        forge_repo: Option<&str>,
    ) -> AppResult<Repo> {
        let kind_str = forge_kind_to_str(forge_kind);
        let auto_name = derive_repo_name(local_path);
        let resolved_name = name.unwrap_or(&auto_name);

        let id = sqlx::query(
            "INSERT INTO repos (workspace_id, name, local_path, default_remote, default_branch, \
             forge_kind, forge_owner, forge_repo, is_pinned) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0) \
             ON CONFLICT(local_path) DO UPDATE SET \
             workspace_id = excluded.workspace_id, name = excluded.name, \
             default_remote = excluded.default_remote, default_branch = excluded.default_branch, \
             forge_kind = excluded.forge_kind, forge_owner = excluded.forge_owner, \
             forge_repo = excluded.forge_repo \
             RETURNING id",
        )
        .bind(workspace_id)
        .bind(resolved_name)
        .bind(local_path)
        .bind(default_remote)
        .bind(default_branch)
        .bind(kind_str)
        .bind(forge_owner)
        .bind(forge_repo)
        .fetch_one(&self.pool)
        .await
        .map_err(AppError::Db)?
        .try_get::<i64, _>("id")?;

        self.get_repo(id).await
    }

    async fn remove_repo(&self, id: i64) -> AppResult<()> {
        sqlx::query("DELETE FROM repos WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(AppError::Db)?;
        Ok(())
    }

    async fn get_repo(&self, id: i64) -> AppResult<Repo> {
        let r = sqlx::query("SELECT * FROM repos WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(AppError::Db)?
            .ok_or(AppError::RepoNotFound(id))?;
        Ok(Repo {
            id: r.try_get("id")?,
            workspace_id: r.try_get("workspace_id")?,
            name: r.try_get("name")?,
            local_path: r.try_get("local_path")?,
            default_remote: r.try_get("default_remote")?,
            default_branch: r.try_get("default_branch")?,
            forge_kind: r.try_get("forge_kind")?,
            forge_owner: r.try_get("forge_owner")?,
            forge_repo: r.try_get("forge_repo")?,
            last_fetched_at: r.try_get("last_fetched_at")?,
            is_pinned: r.try_get::<i64, _>("is_pinned")? != 0,
        })
    }

    async fn set_repo_pinned(&self, id: i64, pinned: bool) -> AppResult<Repo> {
        sqlx::query("UPDATE repos SET is_pinned = ? WHERE id = ?")
            .bind(if pinned { 1i64 } else { 0i64 })
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(AppError::Db)?;
        self.get_repo(id).await
    }
}

fn default_db_path() -> AppResult<PathBuf> {
    // dirs::data_local_dir() 가 OS 별 적절한 위치 반환:
    //   Win:  %LOCALAPPDATA%\git-fried\db.sqlite
    //   Mac:  ~/Library/Application Support/git-fried/db.sqlite
    //   Lin:  ~/.local/share/git-fried/db.sqlite
    let base = dirs::data_local_dir().ok_or_else(|| AppError::path("data_local_dir 없음"))?;
    Ok(base.join("git-fried").join("db.sqlite"))
}

fn forge_kind_to_str(k: ForgeKindLite) -> &'static str {
    match k {
        ForgeKindLite::Gitea => "gitea",
        ForgeKindLite::Github => "github",
        ForgeKindLite::Unknown => "unknown",
    }
}

fn derive_repo_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("repo")
        .to_string()
}

// sqlx::Error → AppError 변환은 이미 `From` 으로 구현됨.
// row.try_get 이 sqlx::Error 반환하므로 ? 만으로 변환 동작.

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_db_open_and_migrate() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let db = Db::open(tmp.path()).await.unwrap();

        // workspaces 테이블 동작 확인
        let ws = db.list_workspaces().await.unwrap();
        assert_eq!(ws.len(), 0);

        let w = db.create_workspace("개인", Some("#0ea5e9")).await.unwrap();
        assert_eq!(w.name, "개인"); // 한글 round-trip

        let ws2 = db.list_workspaces().await.unwrap();
        assert_eq!(ws2.len(), 1);
        assert_eq!(ws2[0].name, "개인");
    }

    #[tokio::test]
    async fn test_add_repo_korean_name_idempotent() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let db = Db::open(tmp.path()).await.unwrap();

        // 한글 경로 + 한글 이름
        let r1 = db
            .add_repo(
                "/tmp/한글-레포",
                None,
                Some("내 레포"),
                Some("main"),
                Some("origin"),
                ForgeKindLite::Github,
                Some("tgkim"),
                Some("project"),
            )
            .await
            .unwrap();
        assert_eq!(r1.name, "내 레포");
        assert_eq!(r1.local_path, "/tmp/한글-레포");

        // 같은 path 로 다시 add → 업데이트 (id 동일)
        let r2 = db
            .add_repo(
                "/tmp/한글-레포",
                None,
                Some("새 이름"),
                Some("dev"),
                None,
                ForgeKindLite::Gitea,
                None,
                None,
            )
            .await
            .unwrap();
        assert_eq!(r1.id, r2.id);
        assert_eq!(r2.name, "새 이름");
        assert_eq!(r2.default_branch.as_deref(), Some("dev"));
    }

    // 2026-05-05 c41 — storage migration smoke + DbExt CRUD round-trip 강화.
    // /analyze 후속 권장 작업 #3 (forge/storage 단위 test).

    #[tokio::test]
    async fn test_workspace_update_delete_round_trip() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let db = Db::open(tmp.path()).await.unwrap();

        let w = db.create_workspace("회사", Some("#0ea5e9")).await.unwrap();
        let id = w.id;

        // name 만 update.
        let updated = db.update_workspace(id, Some("팀A"), None).await.unwrap();
        assert_eq!(updated.name, "팀A");
        assert_eq!(updated.color.as_deref(), Some("#0ea5e9"));

        // color 만 update.
        let updated2 = db
            .update_workspace(id, None, Some("#10b981"))
            .await
            .unwrap();
        assert_eq!(updated2.name, "팀A");
        assert_eq!(updated2.color.as_deref(), Some("#10b981"));

        // 둘 다 None — no-op fetch.
        let updated3 = db.update_workspace(id, None, None).await.unwrap();
        assert_eq!(updated3.id, id);

        // delete + 재조회 시 not found.
        db.delete_workspace(id).await.unwrap();
        let after = db.list_workspaces().await.unwrap();
        assert!(after.iter().all(|w| w.id != id));

        // 없는 id update → WorkspaceNotFound.
        let err = db.update_workspace(99999, Some("x"), None).await;
        assert!(err.is_err());
    }

    #[tokio::test]
    async fn test_list_repos_workspace_filter_and_pin_toggle() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let db = Db::open(tmp.path()).await.unwrap();

        let w_personal = db.create_workspace("개인", None).await.unwrap();
        let w_work = db.create_workspace("회사", None).await.unwrap();

        // 3 repos: 2 in personal, 1 in work.
        let r1 = db
            .add_repo(
                "/tmp/p-1",
                Some(w_personal.id),
                Some("p1"),
                None,
                None,
                ForgeKindLite::Github,
                None,
                None,
            )
            .await
            .unwrap();
        let _r2 = db
            .add_repo(
                "/tmp/p-2",
                Some(w_personal.id),
                Some("p2"),
                None,
                None,
                ForgeKindLite::Github,
                None,
                None,
            )
            .await
            .unwrap();
        let _r3 = db
            .add_repo(
                "/tmp/w-1",
                Some(w_work.id),
                Some("w1"),
                None,
                None,
                ForgeKindLite::Gitea,
                None,
                None,
            )
            .await
            .unwrap();

        // workspace 필터.
        let p_all = db.list_repos(Some(w_personal.id)).await.unwrap();
        assert_eq!(p_all.len(), 2);
        let w_all = db.list_repos(Some(w_work.id)).await.unwrap();
        assert_eq!(w_all.len(), 1);
        // None = 전체.
        let all = db.list_repos(None).await.unwrap();
        assert_eq!(all.len(), 3);

        // pin toggle round-trip.
        assert!(!r1.is_pinned);
        let pinned = db.set_repo_pinned(r1.id, true).await.unwrap();
        assert!(pinned.is_pinned);
        let unpinned = db.set_repo_pinned(r1.id, false).await.unwrap();
        assert!(!unpinned.is_pinned);
    }

    // 2026-05-06 c42 — 5 migration smoke: 모든 migration 이 적용된 후
    // 예상 테이블 + 핵심 인덱스가 모두 생성되었는지 검증.
    #[tokio::test]
    async fn test_5_migrations_apply_expected_schema() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let db = Db::open(tmp.path()).await.unwrap();

        // 11 테이블 (0001 7 + 0002 1 + 0003 2 + 0004 1) — sqlx_migrations 1 + index 들 제외.
        let rows = sqlx::query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        )
        .fetch_all(&db.pool)
        .await
        .unwrap();
        let names: Vec<String> = rows
            .iter()
            .map(|r| r.try_get::<String, _>(0).unwrap())
            .collect();
        // 모든 migration 의 핵심 테이블이 모두 존재해야 함.
        for expected in [
            "workspaces",
            "repos",
            "forge_accounts",
            "profiles",
            "settings",
            "commits",
            "repo_ref_hidden",
            "pr_meta",
            "saved_views",
            "repo_alias",
        ] {
            assert!(
                names.iter().any(|n| n == expected),
                "expected table '{expected}' not found; got: {names:?}"
            );
        }

        // c41 + c42 추가 인덱스 검증 (성능 INDEX 2개).
        let idx_rows = sqlx::query(
            "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'",
        )
        .fetch_all(&db.pool)
        .await
        .unwrap();
        let idx_names: Vec<String> = idx_rows
            .iter()
            .map(|r| r.try_get::<String, _>(0).unwrap())
            .collect();
        assert!(
            idx_names.iter().any(|n| n == "idx_commits_lookup"),
            "0005 의 idx_commits_lookup 가 누락; got: {idx_names:?}"
        );
        assert!(
            idx_names.iter().any(|n| n == "idx_repo_ref_hidden_kind"),
            "0002 의 idx_repo_ref_hidden_kind 가 누락; got: {idx_names:?}"
        );
    }

    #[tokio::test]
    async fn test_migrations_idempotent_on_reopen() {
        // 같은 DB 파일을 두 번 열어도 migration 이 멱등이어야 함 (CREATE TABLE IF NOT EXISTS).
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let db1 = Db::open(tmp.path()).await.unwrap();
        // 첫 open 후 데이터 INSERT.
        let w = db1.create_workspace("재오픈테스트", None).await.unwrap();
        drop(db1);

        // 같은 파일 재open — migration 재실행 (idempotent) + 데이터 보존.
        let db2 = Db::open(tmp.path()).await.unwrap();
        let ws = db2.list_workspaces().await.unwrap();
        assert!(ws.iter().any(|x| x.id == w.id && x.name == "재오픈테스트"));
    }

    #[tokio::test]
    async fn test_workspace_delete_cascade_sets_repo_workspace_id_null() {
        // FK ON DELETE SET NULL 확인 (workspaces -> repos.workspace_id).
        // workspace 삭제 시 그 안의 repo 는 살아있고 workspace_id 만 NULL.
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let db = Db::open(tmp.path()).await.unwrap();

        let w = db.create_workspace("temp", None).await.unwrap();
        let r = db
            .add_repo(
                "/tmp/cascade",
                Some(w.id),
                Some("repo"),
                None,
                None,
                ForgeKindLite::Unknown,
                None,
                None,
            )
            .await
            .unwrap();
        assert_eq!(r.workspace_id, Some(w.id));

        db.delete_workspace(w.id).await.unwrap();

        // repo 는 살아있고 workspace_id 가 NULL.
        let still = db.get_repo(r.id).await.unwrap();
        assert_eq!(still.workspace_id, None);
        assert_eq!(still.local_path, "/tmp/cascade");
    }
}
