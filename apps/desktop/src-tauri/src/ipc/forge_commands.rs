// Forge (Gitea / GitHub) IPC 핸들러.
//
// 인증 흐름:
//   1) `forge_save_token` — PAT 저장 (keyring + DB forge_accounts)
//   2) `forge_list_accounts` — 등록된 계정 목록
//   3) `forge_whoami` — 현재 토큰의 사용자 확인 (검증)
//
// 데이터 흐름:
//   - 레포 행에서 forge_kind/forge_owner/forge_repo 가 자동 채워짐
//   - PR 작업 시 그 메타로 forge_account 매칭 (base_url 기준)

use crate::auth;
use crate::error::{AppError, AppResult};
use crate::forge::{
    gitea::GiteaClient, github::GithubClient, CreatePullRequestReq, ForgeClient, ForgeKind,
    Issue, MergeMethod, PrComment, PrState, PullRequest, Release, ReviewVerdict,
};
use crate::storage::{Db, DbExt};
use crate::AppState;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForgeAccount {
    pub id: i64,
    pub forge_kind: String,
    pub base_url: String,
    pub username: Option<String>,
    pub keychain_ref: String,
}

// ====== Account 관리 ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveTokenArgs {
    pub forge_kind: String, // "gitea" | "github"
    pub base_url: String,
    pub username: Option<String>,
    pub token: String,
}

#[tauri::command]
pub async fn forge_save_token(
    args: SaveTokenArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<ForgeAccount> {
    if args.token.trim().is_empty() {
        return Err(AppError::validation("PAT 가 비었습니다."));
    }
    if !["gitea", "github"].contains(&args.forge_kind.as_str()) {
        return Err(AppError::validation(format!(
            "지원하지 않는 forge: {}",
            args.forge_kind
        )));
    }

    let key = auth::make_key(&args.forge_kind, &args.base_url, args.username.as_deref());
    auth::save_token(&key, args.token.trim())?;

    // DB 등록 (UPSERT)
    let row = sqlx::query(
        "INSERT INTO forge_accounts (forge_kind, base_url, username, keychain_ref) \
         VALUES (?, ?, ?, ?) \
         ON CONFLICT(forge_kind, base_url, username) DO UPDATE SET keychain_ref=excluded.keychain_ref \
         RETURNING id, forge_kind, base_url, username, keychain_ref",
    )
    .bind(&args.forge_kind)
    .bind(&args.base_url)
    .bind(&args.username)
    .bind(&key)
    .fetch_one(&state.db.pool)
    .await
    .map_err(AppError::Db)?;

    Ok(ForgeAccount {
        id: row.try_get("id")?,
        forge_kind: row.try_get("forge_kind")?,
        base_url: row.try_get("base_url")?,
        username: row.try_get("username")?,
        keychain_ref: row.try_get("keychain_ref")?,
    })
}

#[tauri::command]
pub async fn forge_list_accounts(
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<ForgeAccount>> {
    let rows = sqlx::query(
        "SELECT id, forge_kind, base_url, username, keychain_ref FROM forge_accounts ORDER BY forge_kind, base_url",
    )
    .fetch_all(&state.db.pool)
    .await
    .map_err(AppError::Db)?;
    let mut out = Vec::with_capacity(rows.len());
    for r in rows {
        out.push(ForgeAccount {
            id: r.try_get("id")?,
            forge_kind: r.try_get("forge_kind")?,
            base_url: r.try_get("base_url")?,
            username: r.try_get("username")?,
            keychain_ref: r.try_get("keychain_ref")?,
        });
    }
    Ok(out)
}

#[tauri::command]
pub async fn forge_delete_account(
    id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    // 먼저 keychain ref 조회 후 삭제
    if let Some(row) = sqlx::query("SELECT keychain_ref FROM forge_accounts WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.db.pool)
        .await
        .map_err(AppError::Db)?
    {
        let key: String = row.try_get("keychain_ref")?;
        let _ = auth::delete_token(&key);
    }
    sqlx::query("DELETE FROM forge_accounts WHERE id = ?")
        .bind(id)
        .execute(&state.db.pool)
        .await
        .map_err(AppError::Db)?;
    Ok(())
}

// ====== Forge client 생성 헬퍼 ======

/// repo_id 로부터 적절한 ForgeClient 만든다.
/// 매칭 우선순위: forge_owner+forge_repo → forge_accounts 의 base_url 추측 → 토큰 조회.
async fn forge_client_for_repo(
    state: &Arc<AppState>,
    repo_id: i64,
) -> AppResult<(Box<dyn ForgeClient>, String, String)> {
    let r = state.db.get_repo(repo_id).await?;
    let kind = r.forge_kind.clone();
    let owner = r
        .forge_owner
        .clone()
        .ok_or_else(|| AppError::validation("이 레포는 forge owner 가 없습니다."))?;
    let repo = r
        .forge_repo
        .clone()
        .ok_or_else(|| AppError::validation("이 레포는 forge repo 가 없습니다."))?;

    let (client, _account) = build_client(state, &kind, &owner, &repo).await?;
    Ok((client, owner, repo))
}

async fn build_client(
    state: &Arc<AppState>,
    kind: &str,
    _owner: &str,
    _repo: &str,
) -> AppResult<(Box<dyn ForgeClient>, ForgeAccount)> {
    // forge_accounts 에서 first match (kind 동일) 사용.
    // v0.2 에서 base_url 정확 매칭으로 개선.
    let row = sqlx::query(
        "SELECT id, forge_kind, base_url, username, keychain_ref FROM forge_accounts WHERE forge_kind = ? LIMIT 1",
    )
    .bind(kind)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(AppError::Db)?
    .ok_or_else(|| {
        AppError::validation(format!(
            "{} 계정이 등록되어 있지 않습니다. 먼저 PAT 등록.",
            kind
        ))
    })?;

    let account = ForgeAccount {
        id: row.try_get("id")?,
        forge_kind: row.try_get("forge_kind")?,
        base_url: row.try_get("base_url")?,
        username: row.try_get("username")?,
        keychain_ref: row.try_get("keychain_ref")?,
    };

    let token = auth::load_token(&account.keychain_ref)?
        .ok_or_else(|| AppError::validation("keychain 에 토큰이 없습니다. 다시 등록하세요."))?;

    let client: Box<dyn ForgeClient> = match account.forge_kind.as_str() {
        "gitea" => Box::new(GiteaClient::new(&account.base_url, &token)?),
        "github" => Box::new(GithubClient::new(Some(&account.base_url), &token)?),
        other => {
            return Err(AppError::validation(format!(
                "지원하지 않는 forge: {other}"
            )))
        }
    };
    Ok((client, account))
}

// ====== whoami (검증) ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WhoamiArgs {
    pub forge_kind: String,
    pub base_url: String,
    pub token: String,
}

#[tauri::command]
pub async fn forge_whoami(args: WhoamiArgs) -> AppResult<crate::forge::Author> {
    let client: Box<dyn ForgeClient> = match args.forge_kind.as_str() {
        "gitea" => Box::new(GiteaClient::new(&args.base_url, &args.token)?),
        "github" => Box::new(GithubClient::new(Some(&args.base_url), &args.token)?),
        other => {
            return Err(AppError::validation(format!(
                "지원하지 않는 forge: {other}"
            )))
        }
    };
    client.whoami().await
}

// ====== PR ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListPrArgs {
    pub repo_id: i64,
    pub state_filter: Option<PrState>,
}

#[tauri::command]
pub async fn list_pull_requests(
    args: ListPrArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<PullRequest>> {
    let (client, owner, repo) = forge_client_for_repo(&state, args.repo_id).await?;
    client.list_pull_requests(&owner, &repo, args.state_filter).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetPrArgs {
    pub repo_id: i64,
    pub number: u64,
}

#[tauri::command]
pub async fn get_pull_request(
    args: GetPrArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<PullRequest> {
    let (client, owner, repo) = forge_client_for_repo(&state, args.repo_id).await?;
    client.get_pull_request(&owner, &repo, args.number).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePrArgs {
    pub repo_id: i64,
    pub title: String,
    pub body: String,
    pub head: String,
    pub base: String,
    #[serde(default)]
    pub draft: bool,
}

#[tauri::command]
pub async fn create_pull_request(
    args: CreatePrArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<PullRequest> {
    let (client, owner, repo) = forge_client_for_repo(&state, args.repo_id).await?;
    client
        .create_pull_request(
            &owner,
            &repo,
            CreatePullRequestReq {
                title: args.title,
                body: args.body,
                head: args.head,
                base: args.base,
                draft: args.draft,
            },
        )
        .await
}

// ====== Issues / Releases ======

#[tauri::command]
pub async fn list_issues(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<Issue>> {
    let (client, owner, repo) = forge_client_for_repo(&state, repo_id).await?;
    client.list_issues(&owner, &repo).await
}

#[tauri::command]
pub async fn list_releases(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<Release>> {
    let (client, owner, repo) = forge_client_for_repo(&state, repo_id).await?;
    client.list_releases(&owner, &repo).await
}

// ====== PR Review / Comments / Merge / Close / Reopen ======

#[tauri::command]
pub async fn list_pr_comments(
    args: GetPrArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<PrComment>> {
    let (client, owner, repo) = forge_client_for_repo(&state, args.repo_id).await?;
    client.list_pr_comments(&owner, &repo, args.number).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddPrCommentArgs {
    pub repo_id: i64,
    pub number: u64,
    pub body: String,
}

#[tauri::command]
pub async fn add_pr_comment(
    args: AddPrCommentArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<PrComment> {
    let (client, owner, repo) = forge_client_for_repo(&state, args.repo_id).await?;
    client
        .add_pr_comment(&owner, &repo, args.number, &args.body)
        .await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitReviewArgs {
    pub repo_id: i64,
    pub number: u64,
    pub verdict: ReviewVerdict,
    pub body: String,
}

#[tauri::command]
pub async fn submit_pr_review(
    args: SubmitReviewArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let (client, owner, repo) = forge_client_for_repo(&state, args.repo_id).await?;
    client
        .submit_pr_review(&owner, &repo, args.number, args.verdict, &args.body)
        .await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergePrArgs {
    pub repo_id: i64,
    pub number: u64,
    pub method: MergeMethod,
    pub title: Option<String>,
    pub message: Option<String>,
}

#[tauri::command]
pub async fn merge_pr(
    args: MergePrArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let (client, owner, repo) = forge_client_for_repo(&state, args.repo_id).await?;
    client
        .merge_pr(
            &owner,
            &repo,
            args.number,
            args.method,
            args.title.as_deref(),
            args.message.as_deref(),
        )
        .await
}

#[tauri::command]
pub async fn close_pr(
    args: GetPrArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let (client, owner, repo) = forge_client_for_repo(&state, args.repo_id).await?;
    client.close_pr(&owner, &repo, args.number).await
}

#[tauri::command]
pub async fn reopen_pr(
    args: GetPrArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let (client, owner, repo) = forge_client_for_repo(&state, args.repo_id).await?;
    client.reopen_pr(&owner, &repo, args.number).await
}

#[allow(dead_code)]
fn _kind_marker(_: ForgeKind) {}
#[allow(dead_code)]
fn _db_marker(_: &Db) {}
