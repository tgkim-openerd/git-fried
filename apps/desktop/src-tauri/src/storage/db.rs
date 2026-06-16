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
    /// v0.4 #1 (UltraPlan plan/31 §2) — per-repo forge account override.
    /// None → active Profile 의 default_forge_account_id 사용 (fallback chain).
    /// Some(id) → 본 저장소 명시 계정 사용 (회사 PAT vs 개인 PAT 분리 등).
    pub forge_account_id: Option<i64>,
    /// v0.5 #9 (UltraPlan plan/31) — per-repo SSH key path override.
    /// None → Profile.ssh_key_path fallback. Some(path) → git -c core.sshCommand 적용.
    /// 실 git operation 통합은 git/runner.rs (별도 sprint).
    pub ssh_key_path: Option<String>,
    /// plan/43 P1 — 레포에 바인딩된 프로필. None → 공용(is_default) 프로필 fallback.
    /// 프로필 삭제 시 FK `ON DELETE SET NULL` 로 NULL 복귀.
    pub profile_id: Option<i64>,
    /// plan/43 P1 (D7) — true = 사용자 수동 지정 (자동 매칭이 덮어쓰지 않음).
    /// false = 자동 매칭 대상. profile_id 만으론 "미매칭" 과 "수동 공용 선택" 구분 불가.
    pub profile_pinned: bool,
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
        match Self::open_and_migrate(path).await {
            Ok(db) => Ok(db),
            Err(e) => {
                // M6 (plan #45) — 손상 / 마이그레이션 실패 시 프로세스 abort 대신 graceful
                // recovery: 손상 파일 집합(db + -wal + -shm)을 `.corrupt-<ts>` 로 격리(보존)
                // 후 fresh DB 재생성 + migrate. 두 번째 실패는 진짜 결함 → 전파(상위에서 처리).
                tracing::error!(
                    target: "git_fried_lib::storage",
                    path = %path.display(),
                    error = %e,
                    "Db::open 실패 — DB 손상 의심, 격리 후 재생성 시도"
                );
                // 격리 실패(특히 -wal/-shm 잔존) 시 재생성하면 fresh DB 에 stale WAL 이
                // replay 될 수 있다 (Codex M6.3) → 재생성하지 않고 원 에러 전파.
                if !Self::quarantine_corrupt(path).await {
                    tracing::error!(
                        target: "git_fried_lib::storage",
                        path = %path.display(),
                        "손상 파일 격리 실패 — fresh DB 재생성 중단, 원 에러 전파"
                    );
                    return Err(e);
                }
                let db = Self::open_and_migrate(path).await?;
                tracing::warn!(
                    target: "git_fried_lib::storage",
                    path = %path.display(),
                    "손상 DB 격리 후 fresh DB 재생성 완료 (이전 데이터는 .corrupt-* 파일에 보존)"
                );
                Ok(db)
            }
        }
    }

    /// 연결 + 무결성 검사 + 마이그레이션. 실패 시 pool 을 명시적으로 닫아
    /// (Windows 파일 잠금 해제) 호출자가 손상 파일을 격리/재생성할 수 있게 한다.
    async fn open_and_migrate(path: &Path) -> AppResult<Self> {
        let started = std::time::Instant::now();
        tracing::info!(
            target: "git_fried_lib::storage",
            path = %path.display(),
            "Db::open 시작"
        );
        let url = format!("sqlite://{}?mode=rwc", path.to_string_lossy());
        let opts = SqliteConnectOptions::from_str(&url)
            .map_err(|e| AppError::Internal(format!("DB URL parse: {e}")))?
            .create_if_missing(true)
            .foreign_keys(true)
            .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
            .synchronous(sqlx::sqlite::SqliteSynchronous::Normal);

        // SAF-303 (R5) — acquire_timeout 명시 (sqlx default 30s 너무 길어 IPC 무응답 유발).
        // 10s 면 Doherty Threshold (400ms) 를 25배 초과 — UI 가 spinner 후 graceful 에러 toast 가능.
        // pool size 8 유지 (bulk concurrency 4 로 제한해서 pool 고갈 방지 — bulk.rs follow-up sprint).
        let pool = SqlitePoolOptions::new()
            .max_connections(8)
            .acquire_timeout(std::time::Duration::from_secs(10))
            .connect_with(opts)
            .await
            .map_err(AppError::Db)?;

        if let Err(e) = Self::verify_and_migrate(&pool).await {
            // 손상/마이그레이션 실패 — 격리 전 파일 잠금 해제를 위해 pool 명시 close.
            pool.close().await;
            return Err(e);
        }

        let elapsed_ms = started.elapsed().as_millis() as u64;
        tracing::info!(
            target: "git_fried_lib::storage",
            path = %path.display(),
            elapsed_ms,
            "Db::open 완료 (integrity ok + migrations 적용)"
        );

        Ok(Self { pool })
    }

    /// M6 — `PRAGMA quick_check` 무결성 검사 후 마이그레이션 (멱등). 손상 시 Err.
    ///
    /// quick_check 는 시작 시 빠른 best-effort 게이트 (Codex M6.1): 구조/페이지/malformed
    /// 손상은 잡지만 일부 index 불일치는 놓칠 수 있다. 매 시작 full `integrity_check` 는
    /// 대형 DB 에서 비싸므로 quick_check 채택. 성공 시 단일 "ok" 행, 손상 시 첫 행이 오류
    /// 설명 → `fetch_one` 의 첫 행이 "ok" 가 아니면 손상 (Codex M6.2: 첫 행으로 충분).
    async fn verify_and_migrate(pool: &SqlitePool) -> AppResult<()> {
        let check: String = sqlx::query_scalar("PRAGMA quick_check")
            .fetch_one(pool)
            .await
            .map_err(AppError::Db)?;
        if check != "ok" {
            return Err(AppError::Internal(format!(
                "DB 무결성 quick_check 실패: {check}"
            )));
        }
        sqlx::migrate!("./src/storage/migrations")
            .run(pool)
            .await
            .map_err(AppError::Migrate)?;
        Ok(())
    }

    /// M6 — 손상 DB 파일 집합(`-wal`, `-shm`, 그리고 main db)을 `<path>.corrupt-<ts>` 로
    /// 격리(보존). 데이터 손실 없이 사용자가 수동 복구할 수 있게 원본을 옮겨둔다.
    ///
    /// **순서 (Codex M6.3)**: sidecar(-wal/-shm)를 main 보다 **먼저** 옮긴다. main 만 옮기고
    /// sidecar 가 남으면 재생성된 fresh DB 에 stale WAL 이 replay 되어 손상되기 때문. 하나라도
    /// 옮기지 못하면 `false` 반환 → 호출자가 재생성을 중단하고 원 에러를 전파(안전).
    ///
    /// dst 는 `ts`(나노초) + process 수명 `seq` 카운터로 유일성 보장 — 같은 초/같은 나노초
    /// tick 다중 격리나 ts=0 fallback(시계 스큐)에도 충돌 안 함 (Codex M6.4 + review M-2).
    /// rename 은 같은 볼륨 내
    /// 메타데이터 연산이라 파일 크기와 무관하게 빠름 — async 블로킹 무시 가능 (Codex M6.5).
    /// Windows 파일 잠금 해제 지연 대비 1회 재시도.
    async fn quarantine_corrupt(path: &Path) -> bool {
        // process 수명 단조 카운터 — 거친 클럭 해상도(Windows)로 같은 나노초 tick 에 2회
        // 격리하거나 시계 스큐로 ts=0 fallback 이 겹쳐도 dst 가 유일하도록 tiebreaker.
        // (silent-failure review M-2 — ts 단독으로는 충돌 가능)
        use std::sync::atomic::{AtomicU64, Ordering};
        static SEQ: AtomicU64 = AtomicU64::new(0);
        let seq = SEQ.fetch_add(1, Ordering::Relaxed);
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let base = path.to_string_lossy().to_string();
        for suffix in ["-wal", "-shm", ""] {
            let src = PathBuf::from(format!("{base}{suffix}"));
            if !src.exists() {
                continue;
            }
            let dst = PathBuf::from(format!("{base}.corrupt-{ts}-{seq}{suffix}"));
            let mut moved = std::fs::rename(&src, &dst).is_ok();
            if !moved {
                // pool close 후에도 핸들 해제가 지연될 수 있음 — 짧게 대기 후 1회 재시도.
                tokio::time::sleep(std::time::Duration::from_millis(150)).await;
                moved = std::fs::rename(&src, &dst).is_ok();
            }
            if !moved {
                tracing::warn!(
                    target: "git_fried_lib::storage",
                    "손상 파일 격리 실패 {src:?} -> {dst:?} — 재생성 중단 (stale WAL 방지)"
                );
                return false;
            }
        }
        true
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
    /// Sprint 2026-06-04 — forge 메타 self-heal/backfill 전용 부분 UPDATE.
    /// `add_repo` upsert 와 달리 workspace_id/name/is_pinned/forge_account_id/
    /// profile_id/profile_pinned 를 건드리지 않아 사용자 바인딩·핀 보존.
    /// GitKraken 대량 임포트 시 detect_meta 실패로 비어버린 forge 메타 복구에 사용.
    async fn update_repo_forge_meta(
        &self,
        id: i64,
        default_branch: Option<&str>,
        default_remote: Option<&str>,
        forge_kind: ForgeKindLite,
        forge_owner: Option<&str>,
        forge_repo: Option<&str>,
    ) -> AppResult<Repo>;
    async fn set_repo_pinned(&self, id: i64, pinned: bool) -> AppResult<Repo>;
    /// v0.4 #1 — per-repo forge account override. None → fallback chain.
    async fn set_repo_forge_account(&self, id: i64, account_id: Option<i64>) -> AppResult<Repo>;
    /// v0.5 #9 — per-repo SSH key path override. None → Profile fallback.
    async fn set_repo_ssh_key_path(&self, id: i64, path: Option<&str>) -> AppResult<Repo>;
    /// plan/43 P1 — repo↔profile 바인딩 설정. (profile_id, pinned) 조합으로
    /// apply(Some,true) / auto-match(Some,false) / select-default(None,true) /
    /// clear(None,false) 4 케이스 모두 표현.
    async fn set_repo_profile(
        &self,
        id: i64,
        profile_id: Option<i64>,
        pinned: bool,
    ) -> AppResult<Repo>;
    /// plan/43 P1 — 프로필 삭제 전 그 프로필 바인딩 레포의 profile_pinned 를 0 으로 리셋.
    /// FK `ON DELETE SET NULL` 은 profile_id 만 NULL — pinned 별도 리셋 (auto-match 재개).
    async fn reset_profile_bindings(&self, profile_id: i64) -> AppResult<()>;
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
                forge_account_id: r.try_get("forge_account_id")?,
                ssh_key_path: r.try_get("ssh_key_path")?,
                profile_id: r.try_get("profile_id")?,
                profile_pinned: r.try_get::<i64, _>("profile_pinned")? != 0,
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
             default_remote = excluded.default_remote, \
             default_branch = COALESCE(excluded.default_branch, repos.default_branch), \
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

    async fn update_repo_forge_meta(
        &self,
        id: i64,
        default_branch: Option<&str>,
        default_remote: Option<&str>,
        forge_kind: ForgeKindLite,
        forge_owner: Option<&str>,
        forge_repo: Option<&str>,
    ) -> AppResult<Repo> {
        // 부분 UPDATE — forge 메타 5개 컬럼만 갱신. workspace_id/name/is_pinned/
        // forge_account_id/profile_id/profile_pinned 는 의도적으로 제외 (바인딩·핀 보존).
        //
        // COALESCE/CASE — 기존에 채워진 값을 None/unknown 으로 덮어쓰지 않는다(clobber 방지,
        // Codex R2 리뷰). self-heal 대상은 "한 필드라도 비어있음" 이라 owner/repo 가 이미
        // 있는 부분 상태도 포함되는데, detect_meta 재탐지가 (URL 변경 등으로) 더 빈약한 결과를
        // 내도 present 값을 잃지 않게 한다. nullable 4컬럼은 COALESCE, NOT NULL 인 forge_kind 는
        // 'unknown'(부재 sentinel) 일 때 기존 값 보존.
        let kind_str = forge_kind_to_str(forge_kind);
        sqlx::query(
            "UPDATE repos SET \
             default_branch = COALESCE(?, default_branch), \
             default_remote = COALESCE(?, default_remote), \
             forge_kind = CASE WHEN ? = 'unknown' THEN forge_kind ELSE ? END, \
             forge_owner = COALESCE(?, forge_owner), \
             forge_repo = COALESCE(?, forge_repo) \
             WHERE id = ?",
        )
        .bind(default_branch)
        .bind(default_remote)
        .bind(kind_str)
        .bind(kind_str)
        .bind(forge_owner)
        .bind(forge_repo)
        .bind(id)
        .execute(&self.pool)
        .await
        .map_err(AppError::Db)?;
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
            forge_account_id: r.try_get("forge_account_id")?,
            ssh_key_path: r.try_get("ssh_key_path")?,
            profile_id: r.try_get("profile_id")?,
            profile_pinned: r.try_get::<i64, _>("profile_pinned")? != 0,
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

    async fn set_repo_forge_account(&self, id: i64, account_id: Option<i64>) -> AppResult<Repo> {
        sqlx::query("UPDATE repos SET forge_account_id = ? WHERE id = ?")
            .bind(account_id)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(AppError::Db)?;
        self.get_repo(id).await
    }

    async fn set_repo_ssh_key_path(&self, id: i64, path: Option<&str>) -> AppResult<Repo> {
        // code-review SEC-002 — validate_ssh_key_path gate (profiles 외 caller 도 동일 검증).
        // shell meta / control / glob 차단 + bypass 방지 (1-line fix per security review).
        if let Some(p) = path {
            crate::profiles::validate_ssh_key_path(p)?;
        }
        sqlx::query("UPDATE repos SET ssh_key_path = ? WHERE id = ?")
            .bind(path)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(AppError::Db)?;
        self.get_repo(id).await
    }

    async fn set_repo_profile(
        &self,
        id: i64,
        profile_id: Option<i64>,
        pinned: bool,
    ) -> AppResult<Repo> {
        sqlx::query("UPDATE repos SET profile_id = ?, profile_pinned = ? WHERE id = ?")
            .bind(profile_id)
            .bind(if pinned { 1i64 } else { 0i64 })
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(AppError::Db)?;
        self.get_repo(id).await
    }

    async fn reset_profile_bindings(&self, profile_id: i64) -> AppResult<()> {
        sqlx::query("UPDATE repos SET profile_pinned = 0 WHERE profile_id = ?")
            .bind(profile_id)
            .execute(&self.pool)
            .await
            .map_err(AppError::Db)?;
        Ok(())
    }
}

fn default_db_path() -> AppResult<PathBuf> {
    // e2e/테스트 격리 — debug 빌드에서만 GIT_FRIED_DB_PATH 로 DB 경로 override 허용.
    // release 에서는 차단: 외부 launcher 가 env 로 실 DB(repos/profiles/forge 메타)를 silently
    // 바꿔치기하는 면을 제거 (Codex SEC 권고). open_default 이 parent dir 를 create_dir_all 하므로
    // temp 경로의 부모도 자동 생성됨. WAL/journal sibling 이 같은 디렉토리에 생기니 호출측이
    // temp 디렉토리 안의 경로를 줘야 한다.
    #[cfg(debug_assertions)]
    if let Ok(p) = std::env::var("GIT_FRIED_DB_PATH") {
        if !p.trim().is_empty() {
            return Ok(PathBuf::from(p));
        }
    }
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

    // M6 (plan #45) — 손상 DB 는 프로세스 abort 대신 graceful recovery (격리 + 재생성).
    #[tokio::test]
    async fn test_db_open_recovers_from_corrupt_file() {
        let tmp = tempfile::TempDir::new().unwrap();
        let path = tmp.path().join("db.sqlite");
        // sqlite 가 아닌 garbage — connect 또는 quick_check 단계에서 손상 감지.
        std::fs::write(&path, b"NOT A SQLITE DATABASE \x00\x01\x02 garbage bytes").unwrap();

        // abort 가 아니라 Ok (fresh DB 재생성) 여야 함.
        let db = Db::open(&path)
            .await
            .expect("손상 DB 에서 graceful recovery 되어야 함");

        // 재생성된 DB 는 정상 동작 (무결성 ok + 마이그레이션 적용).
        let check: String = sqlx::query_scalar("PRAGMA quick_check")
            .fetch_one(&db.pool)
            .await
            .unwrap();
        assert_eq!(check, "ok");
        assert_eq!(db.list_workspaces().await.unwrap().len(), 0);

        // 손상 원본은 `.corrupt-*` 로 격리(보존)되어야 함.
        let quarantined = std::fs::read_dir(tmp.path())
            .unwrap()
            .filter_map(|e| e.ok())
            .any(|e| e.file_name().to_string_lossy().contains(".corrupt-"));
        assert!(quarantined, "손상 DB 가 .corrupt-* 로 격리되어야 함");
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

    /// CDX-001 — detached HEAD 에서 detect_meta.default_branch=None 이 와도 기존 저장값을
    /// NULL 로 덮어쓰면 안 됨 (add_repo upsert COALESCE 보존). detached 는 일시 상태라
    /// 영속 default_branch 를 지우는 건 데이터 손실.
    #[tokio::test]
    async fn test_add_repo_preserves_default_branch_on_none() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let db = Db::open(tmp.path()).await.unwrap();

        let r1 = db
            .add_repo(
                "/tmp/detached-repo",
                None,
                Some("repo"),
                Some("main"),
                Some("origin"),
                ForgeKindLite::Github,
                None,
                None,
            )
            .await
            .unwrap();
        assert_eq!(r1.default_branch.as_deref(), Some("main"));

        // detached 상태 재등록 — default_branch=None.
        let r2 = db
            .add_repo(
                "/tmp/detached-repo",
                None,
                Some("repo"),
                None,
                Some("origin"),
                ForgeKindLite::Github,
                None,
                None,
            )
            .await
            .unwrap();
        assert_eq!(r1.id, r2.id);
        assert_eq!(
            r2.default_branch.as_deref(),
            Some("main"),
            "detached 재등록(None)이 저장된 default_branch 를 wipe 하면 안 됨 (CDX-001)"
        );
    }

    /// Sprint 2026-06-04 — `update_repo_forge_meta` 는 forge 메타 5컬럼만 갱신하고
    /// 사용자 바인딩(workspace/name/pin/profile/forge_account) 은 보존해야 한다.
    /// self-heal/backfill 이 `add_repo` upsert 를 재사용하면 안 되는 이유의 safety net.
    #[tokio::test]
    async fn test_update_repo_forge_meta_preserves_bindings() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let db = Db::open(tmp.path()).await.unwrap();

        let ws = db.create_workspace("회사", None).await.unwrap();

        // forge 메타 비운 채 등록 (임포트 실패 상황 재현).
        let r = db
            .add_repo(
                "/tmp/heal-target",
                Some(ws.id),
                Some("내 레포"),
                None,
                None,
                ForgeKindLite::Unknown,
                None,
                None,
            )
            .await
            .unwrap();

        // 사용자 바인딩 부여: pin + profile(pinned) + forge_account.
        db.set_repo_pinned(r.id, true).await.unwrap();
        let profile = crate::profiles::create(
            &db.pool,
            crate::profiles::ProfileInput {
                name: "개인".to_string(),
                git_user_name: None,
                git_user_email: None,
                signing_key: None,
                ssh_key_path: None,
                default_forge_account_id: None,
            },
        )
        .await
        .unwrap();
        db.set_repo_profile(r.id, Some(profile.id), true)
            .await
            .unwrap();
        let acc_id: i64 = sqlx::query(
            "INSERT INTO forge_accounts (forge_kind, base_url, username, keychain_ref) \
             VALUES ('gitea','https://git.dev.opnd.io','tgkim','ref') RETURNING id",
        )
        .fetch_one(&db.pool)
        .await
        .unwrap()
        .try_get::<i64, _>("id")
        .unwrap();
        db.set_repo_forge_account(r.id, Some(acc_id)).await.unwrap();

        // forge 메타 self-heal.
        let healed = db
            .update_repo_forge_meta(
                r.id,
                Some("main"),
                Some("origin"),
                ForgeKindLite::Gitea,
                Some("opnd-frontend"),
                Some("ankentrip"),
            )
            .await
            .unwrap();

        // forge 메타는 갱신.
        assert_eq!(healed.forge_owner.as_deref(), Some("opnd-frontend"));
        assert_eq!(healed.forge_repo.as_deref(), Some("ankentrip"));
        assert_eq!(healed.forge_kind, "gitea");
        assert_eq!(healed.default_remote.as_deref(), Some("origin"));
        assert_eq!(healed.default_branch.as_deref(), Some("main"));

        // 사용자 바인딩은 보존.
        assert_eq!(healed.name, "내 레포", "name 보존");
        assert_eq!(healed.workspace_id, Some(ws.id), "workspace 보존");
        assert!(healed.is_pinned, "pin 보존");
        assert_eq!(healed.profile_id, Some(profile.id), "profile 보존");
        assert!(healed.profile_pinned, "profile_pinned 보존");
        assert_eq!(healed.forge_account_id, Some(acc_id), "forge_account 보존");
    }

    /// Sprint 2026-06-04 (Codex R2) — `update_repo_forge_meta` 는 detect_meta 가 더 빈약한
    /// 결과(None/unknown)를 내도 기존 present 값을 덮어쓰지 않는다(clobber 방지). 새 값이
    /// Some/known 이면 정상 덮어쓰기.
    #[tokio::test]
    async fn test_update_repo_forge_meta_no_clobber_with_none() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let db = Db::open(tmp.path()).await.unwrap();

        // full good 메타로 등록.
        let r = db
            .add_repo(
                "/tmp/good-meta",
                None,
                Some("good"),
                Some("main"),
                Some("origin"),
                ForgeKindLite::Github,
                Some("tgkim"),
                Some("git-fried"),
            )
            .await
            .unwrap();

        // 빈약한 재탐지 결과(None/unknown)로 update — 기존 값 전부 보존되어야.
        let after = db
            .update_repo_forge_meta(r.id, None, None, ForgeKindLite::Unknown, None, None)
            .await
            .unwrap();
        assert_eq!(after.forge_owner.as_deref(), Some("tgkim"), "owner 보존");
        assert_eq!(after.forge_repo.as_deref(), Some("git-fried"), "repo 보존");
        assert_eq!(after.forge_kind, "github", "kind 보존");
        assert_eq!(
            after.default_remote.as_deref(),
            Some("origin"),
            "remote 보존"
        );
        assert_eq!(after.default_branch.as_deref(), Some("main"), "branch 보존");

        // 새 값이 Some/known 이면 그 필드만 덮어쓰고, None 인 필드는 기존 보존.
        let after2 = db
            .update_repo_forge_meta(
                r.id,
                Some("dev"),
                None,
                ForgeKindLite::Gitea,
                Some("opnd"),
                None,
            )
            .await
            .unwrap();
        assert_eq!(
            after2.forge_owner.as_deref(),
            Some("opnd"),
            "owner 덮어쓰기"
        );
        assert_eq!(after2.forge_kind, "gitea", "kind 덮어쓰기");
        assert_eq!(
            after2.default_branch.as_deref(),
            Some("dev"),
            "branch 덮어쓰기"
        );
        assert_eq!(after2.forge_repo.as_deref(), Some("git-fried"), "repo 보존");
        assert_eq!(
            after2.default_remote.as_deref(),
            Some("origin"),
            "remote 보존"
        );
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

    // plan/43 P1 — repo↔profile 바인딩 helper + 공용 프로필 삭제 가드 + FK SET NULL.
    #[tokio::test]
    async fn test_repo_profile_binding_and_default_guard() {
        use crate::profiles::{activate, create, delete, ProfileInput};
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let db = Db::open(tmp.path()).await.unwrap();

        let mk = |name: &str| ProfileInput {
            name: name.to_string(),
            git_user_name: None,
            git_user_email: None,
            signing_key: None,
            ssh_key_path: None,
            default_forge_account_id: None,
        };
        let p_default = create(&db.pool, mk("공용")).await.unwrap();
        let p_other = create(&db.pool, mk("기타")).await.unwrap();
        // activate → p_default 가 is_default (activate 가 is_active + is_default 일원화 토글).
        activate(&db.pool, p_default.id).await.unwrap();

        // 공용(is_default) 프로필 삭제 거부 (F-06).
        assert!(delete(&db.pool, p_default.id).await.is_err());

        // 바인딩 helper — 신규 repo 는 profile_id None / pinned false.
        let repo = db
            .add_repo(
                "/tmp/pb",
                None,
                Some("pb"),
                None,
                None,
                ForgeKindLite::Gitea,
                None,
                None,
            )
            .await
            .unwrap();
        assert_eq!(repo.profile_id, None);
        assert!(!repo.profile_pinned);

        // set_repo_profile(Some, pinned=true) — 수동 지정.
        let bound = db
            .set_repo_profile(repo.id, Some(p_other.id), true)
            .await
            .unwrap();
        assert_eq!(bound.profile_id, Some(p_other.id));
        assert!(bound.profile_pinned);

        // reset_profile_bindings — pinned 만 0, profile_id 는 보존.
        db.reset_profile_bindings(p_other.id).await.unwrap();
        let after_reset = db.get_repo(repo.id).await.unwrap();
        assert!(!after_reset.profile_pinned);
        assert_eq!(after_reset.profile_id, Some(p_other.id));

        // 재바인딩(pinned=true) 후 비-default 프로필 삭제 →
        // delete 핸들러가 pinned 리셋 + FK ON DELETE SET NULL 이 profile_id NULL.
        db.set_repo_profile(repo.id, Some(p_other.id), true)
            .await
            .unwrap();
        delete(&db.pool, p_other.id).await.unwrap();
        let after_del = db.get_repo(repo.id).await.unwrap();
        assert_eq!(after_del.profile_id, None);
        assert!(!after_del.profile_pinned);
    }
}
