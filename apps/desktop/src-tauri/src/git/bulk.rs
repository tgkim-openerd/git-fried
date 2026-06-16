// 멀티 레포 일괄 작업 — fetch / pull / status (parallel via tokio).
//
// 사용자가 워크스페이스의 모든 레포를 한 번에 fetch 하고 싶을 때 사용.
// 각 작업은 tokio::spawn 으로 병렬 실행, 결과는 `BulkResult<T>` (success/data/error)
// 로 wrapping 하여 부분 실패를 허용. 함수 시그니처는 모두 `Result<_, AppError>` 로
// 통일 (legacy Result<_, String> 잔재 없음, 2026-05-05 /analyze 후속 정리).

use crate::auth;
use crate::error::AppError;
use crate::forge::{gitea::GiteaClient, github::GithubClient, ForgeClient, PrState, PullRequest};
use crate::git::{status as git_status, sync as git_sync};
use crate::storage::{Db, DbExt};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Semaphore;

/// Sprint c45 BE-1 — 네트워크 의존 bulk 작업 동시성 제한.
/// 시스템 리소스 / git CLI 동시 실행 / forge API rate-limit 안정화.
/// 50+ repo 워크스페이스에서도 안전하게 동작.
const BULK_NETWORK_CONCURRENCY: usize = 8;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkResult<T> {
    pub repo_id: i64,
    pub repo_name: String,
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

/// 워크스페이스(또는 전체) 의 모든 레포 fetch.
/// Sprint c45 BE-1 — Semaphore 로 동시 fetch 8개 제한 (50+ repo 안정성).
pub async fn bulk_fetch(
    db: &Db,
    workspace_id: Option<i64>,
) -> Result<Vec<BulkResult<git_sync::SyncResult>>, AppError> {
    let started = std::time::Instant::now();
    let repos = db.list_repos(workspace_id).await?;
    let total = repos.len();
    tracing::info!(
        target: "git_fried_lib::bulk",
        workspace_id = ?workspace_id,
        total,
        concurrency = BULK_NETWORK_CONCURRENCY,
        "bulk_fetch 시작"
    );
    let sem = Arc::new(Semaphore::new(BULK_NETWORK_CONCURRENCY));
    let mut handles = Vec::with_capacity(repos.len());

    // Sprint 2026-05-26 HIGH-F — SSH key per-repo resolve (spawn 전에).
    // resolve 자체는 DB 질의 — spawn 안에서 호출하면 동시성 만큼 DB connection 점유.
    // pre-resolve 후 (path, ssh_key) 페어로 spawn 시 SSH key wire 보장.
    for r in repos {
        let id = r.id;
        let name = r.name.clone();
        let path = PathBuf::from(r.local_path.clone());
        let ssh = crate::profiles::resolve_ssh_key_for_repo(&db.pool, &r)
            .await
            .ok()
            .flatten();
        let sem = sem.clone();
        handles.push(tokio::spawn(async move {
            let _permit = match sem.acquire_owned().await {
                Ok(p) => p,
                // semaphore 는 현재 close 되지 않지만, 향후 shutdown/cancel 도입 시 panic 대신
                // 이 repo 를 실패로 표기하고 graceful 종료 (Codex SEMAPHORE 하드닝).
                Err(_) => {
                    return BulkResult {
                        repo_id: id,
                        repo_name: name,
                        success: false,
                        data: None,
                        error: Some("semaphore closed".to_string()),
                    };
                }
            };
            let res = git_sync::fetch_all(&path, ssh.as_deref()).await;
            BulkResult {
                repo_id: id,
                repo_name: name,
                success: res.as_ref().map(|s| s.success).unwrap_or(false),
                data: res.as_ref().ok().cloned(),
                error: res
                    .err()
                    .map(|e| crate::secret_mask::mask_secrets(&e.to_string())),
            }
        }));
    }

    let mut out = Vec::with_capacity(handles.len());
    for h in handles {
        match h.await {
            Ok(r) => out.push(r),
            Err(e) => out.push(BulkResult {
                repo_id: -1,
                repo_name: "(join error)".to_string(),
                success: false,
                data: None,
                error: Some(crate::secret_mask::mask_secrets(&e.to_string())),
            }),
        }
    }
    let elapsed_ms = started.elapsed().as_millis() as u64;
    let succeeded = out.iter().filter(|r| r.success).count();
    let failed = total - succeeded;
    tracing::info!(
        target: "git_fried_lib::bulk",
        workspace_id = ?workspace_id,
        total,
        succeeded,
        failed,
        elapsed_ms,
        "bulk_fetch 완료"
    );
    Ok(out)
}

/// 워크스페이스 모든 레포의 PR 목록 병렬 조회 (Launchpad).
///
/// forge_kind 가 unknown 이거나 forge_owner/repo 가 없는 레포는 skip.
/// forge_account 가 없는 forge_kind 도 skip (인증 필요).
pub async fn bulk_list_prs(
    db: &Db,
    workspace_id: Option<i64>,
    state_filter: Option<PrState>,
) -> Result<Vec<BulkResult<Vec<PullRequest>>>, AppError> {
    let repos = db.list_repos(workspace_id).await?;

    // forge_kind 별로 토큰 / base_url 미리 조회 (DB 질의 줄임).
    let mut accounts: std::collections::HashMap<String, (String, String)> =
        std::collections::HashMap::new();
    let rows =
        sqlx::query("SELECT forge_kind, base_url, keychain_ref FROM forge_accounts ORDER BY id")
            .fetch_all(&db.pool)
            .await
            .map_err(AppError::Db)?;
    for r in rows {
        let kind: String = r.try_get("forge_kind")?;
        if accounts.contains_key(&kind) {
            continue;
        }
        let base: String = r.try_get("base_url")?;
        let key: String = r.try_get("keychain_ref")?;
        if let Ok(Some(token)) = auth::load_token(&key) {
            accounts.insert(kind, (base, token));
        }
    }

    // Sprint c45 BE-1 — forge API rate-limit 안정성 위해 동시 PR 조회 8개 제한.
    let sem = Arc::new(Semaphore::new(BULK_NETWORK_CONCURRENCY));
    let mut handles = Vec::with_capacity(repos.len());
    for r in repos {
        if r.forge_kind == "unknown" {
            continue;
        }
        let owner = match r.forge_owner.clone() {
            Some(s) => s,
            None => continue,
        };
        let repo_name = match r.forge_repo.clone() {
            Some(s) => s,
            None => continue,
        };
        let account = match accounts.get(&r.forge_kind).cloned() {
            Some(a) => a,
            None => continue, // 토큰 미등록 → skip
        };

        let id = r.id;
        let name = r.name;
        let kind = r.forge_kind;
        let sem = sem.clone();
        handles.push(tokio::spawn(async move {
            let _permit = match sem.acquire_owned().await {
                Ok(p) => p,
                // semaphore 는 현재 close 되지 않지만, 향후 shutdown/cancel 도입 시 panic 대신
                // 이 repo 를 실패로 표기하고 graceful 종료 (Codex SEMAPHORE 하드닝).
                Err(_) => {
                    return BulkResult {
                        repo_id: id,
                        repo_name: name,
                        success: false,
                        data: None,
                        error: Some("semaphore closed".to_string()),
                    };
                }
            };
            let client_res: Result<Box<dyn ForgeClient>, AppError> = match kind.as_str() {
                "gitea" => GiteaClient::new(&account.0, &account.1).map(|c| Box::new(c) as _),
                "github" => {
                    GithubClient::new(Some(&account.0), &account.1).map(|c| Box::new(c) as _)
                }
                _ => Err(AppError::validation(format!("미지원 forge: {kind}"))),
            };
            let res = match client_res {
                Ok(c) => c.list_pull_requests(&owner, &repo_name, state_filter).await,
                Err(e) => Err(e),
            };
            BulkResult {
                repo_id: id,
                repo_name: name,
                success: res.is_ok(),
                data: res.as_ref().ok().cloned(),
                error: res
                    .err()
                    .map(|e| crate::secret_mask::mask_secrets(&e.to_string())),
            }
        }));
    }

    let mut out = Vec::with_capacity(handles.len());
    for h in handles {
        match h.await {
            Ok(r) => out.push(r),
            Err(e) => out.push(BulkResult {
                repo_id: -1,
                repo_name: "(join error)".into(),
                success: false,
                data: None,
                error: Some(crate::secret_mask::mask_secrets(&e.to_string())),
            }),
        }
    }
    Ok(out)
}

/// 워크스페이스 모든 레포의 quick status (branch + upstream + ahead/behind only).
/// Sprint 22-11 F-P3 — Sidebar 50+ repo "어느 레포 작업할까" preview 용.
/// bulk_status 대비 ~50× 빠름 (file walk 생략).
pub async fn bulk_quick_status(
    db: &Db,
    workspace_id: Option<i64>,
) -> Result<Vec<BulkResult<git_status::QuickStatus>>, AppError> {
    let repos = db.list_repos(workspace_id).await?;
    let mut handles = Vec::with_capacity(repos.len());

    for r in repos {
        let path = PathBuf::from(r.local_path);
        let id = r.id;
        let name = r.name;
        handles.push(tokio::task::spawn_blocking(move || {
            let res = git_status::read_quick_status(&path);
            BulkResult {
                repo_id: id,
                repo_name: name,
                success: res.is_ok(),
                data: res.as_ref().ok().cloned(),
                error: res
                    .err()
                    .map(|e| crate::secret_mask::mask_secrets(&e.to_string())),
            }
        }));
    }

    let mut out = Vec::with_capacity(handles.len());
    for h in handles {
        match h.await {
            Ok(r) => out.push(r),
            Err(e) => out.push(BulkResult {
                repo_id: -1,
                repo_name: "(join error)".into(),
                success: false,
                data: None,
                error: Some(crate::secret_mask::mask_secrets(&e.to_string())),
            }),
        }
    }
    Ok(out)
}

/// 워크스페이스 모든 레포의 status 조회 (대시보드용).
pub async fn bulk_status(
    db: &Db,
    workspace_id: Option<i64>,
) -> Result<Vec<BulkResult<git_status::RepoStatus>>, AppError> {
    let repos = db.list_repos(workspace_id).await?;
    let mut handles = Vec::with_capacity(repos.len());

    for r in repos {
        let path = PathBuf::from(r.local_path);
        let id = r.id;
        let name = r.name;
        // status 는 동기 (libgit2) — spawn_blocking 으로 격리
        handles.push(tokio::task::spawn_blocking(move || {
            let res = git_status::read_status(&path);
            BulkResult {
                repo_id: id,
                repo_name: name,
                success: res.is_ok(),
                data: res.as_ref().ok().cloned(),
                error: res
                    .err()
                    .map(|e| crate::secret_mask::mask_secrets(&e.to_string())),
            }
        }));
    }

    let mut out = Vec::with_capacity(handles.len());
    for h in handles {
        match h.await {
            Ok(r) => out.push(r),
            Err(e) => out.push(BulkResult {
                repo_id: -1,
                repo_name: "(join error)".into(),
                success: false,
                data: None,
                error: Some(crate::secret_mask::mask_secrets(&e.to_string())),
            }),
        }
    }
    Ok(out)
}
