// 멀티 레포 일괄 작업 — fetch / pull / status (parallel via tokio).
//
// 사용자가 워크스페이스의 모든 레포를 한 번에 fetch 하고 싶을 때 사용.
// 각 작업은 tokio::spawn 으로 병렬, Result<T, String> per repo 수집.

use crate::auth;
use crate::error::AppError;
use crate::forge::{gitea::GiteaClient, github::GithubClient, ForgeClient, PrState, PullRequest};
use crate::git::{status as git_status, sync as git_sync};
use crate::storage::{Db, DbExt};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::path::PathBuf;

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
pub async fn bulk_fetch(
    db: &Db,
    workspace_id: Option<i64>,
) -> Result<Vec<BulkResult<git_sync::SyncResult>>, AppError> {
    let repos = db.list_repos(workspace_id).await?;
    let mut handles = Vec::with_capacity(repos.len());

    for r in repos {
        let path = PathBuf::from(r.local_path);
        let id = r.id;
        let name = r.name;
        handles.push(tokio::spawn(async move {
            let res = git_sync::fetch_all(&path).await;
            BulkResult {
                repo_id: id,
                repo_name: name,
                success: res.as_ref().map(|s| s.success).unwrap_or(false),
                data: res.as_ref().ok().cloned(),
                error: res.err().map(|e| e.to_string()),
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
                error: Some(e.to_string()),
            }),
        }
    }
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
        handles.push(tokio::spawn(async move {
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
                error: res.err().map(|e| e.to_string()),
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
                error: Some(e.to_string()),
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
                error: res.err().map(|e| e.to_string()),
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
                error: Some(e.to_string()),
            }),
        }
    }
    Ok(out)
}
