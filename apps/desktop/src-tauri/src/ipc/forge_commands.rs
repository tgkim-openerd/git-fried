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
    gitea::GiteaClient, github::GithubClient, CreatePullRequestReq, ForgeClient, Issue,
    MergeMethod, PrComment, PrFile, PrState, PullRequest, Release, ReviewVerdict,
};
use crate::git::repository as repo;
use crate::storage::{DbExt, Repo};
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

    let account = ForgeAccount {
        id: row.try_get("id")?,
        forge_kind: row.try_get("forge_kind")?,
        base_url: row.try_get("base_url")?,
        username: row.try_get("username")?,
        keychain_ref: row.try_get("keychain_ref")?,
    };

    // plan/43 P2.5 — forge 계정 추가/변경(upsert) 후 자동 매칭 재평가.
    crate::git::profile_match::reevaluate_after_forge_change(&state.db).await?;
    Ok(account)
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
    // keychain ref 미리 조회 — 실제 token 삭제는 DB 삭제 성공 후 (iter8 F8-2 순서).
    let keychain_ref: Option<String> =
        sqlx::query("SELECT keychain_ref FROM forge_accounts WHERE id = ?")
            .bind(id)
            .fetch_optional(&state.db.pool)
            .await
            .map_err(AppError::Db)?
            .map(|r| r.try_get::<String, _>("keychain_ref"))
            .transpose()?;

    // plan/43 iter7 F7-1 — forge_accounts(id) 참조 FK 둘(profiles/repos)을 DELETE 전 선해제.
    // 둘 다 RESTRICT 라 참조 중이면 DELETE 가 FK violation 으로 차단됨. 단일 transaction.
    let mut tx = state.db.pool.begin().await.map_err(AppError::Db)?;
    sqlx::query(
        "UPDATE profiles SET default_forge_account_id = NULL WHERE default_forge_account_id = ?",
    )
    .bind(id)
    .execute(&mut *tx)
    .await
    .map_err(AppError::Db)?;
    sqlx::query("UPDATE repos SET forge_account_id = NULL WHERE forge_account_id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Db)?;
    sqlx::query("DELETE FROM forge_accounts WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Db)?;
    tx.commit().await.map_err(AppError::Db)?;

    // iter8 F8-2 — DB 삭제 성공 후 keychain token 삭제 (DB delete 실패 시 token 유실 방지).
    if let Some(key) = keychain_ref {
        let _ = auth::delete_token(&key);
    }

    // plan/43 P2.5 — forge 계정 삭제로 자동 매칭이 어긋난 레포 재평가.
    crate::git::profile_match::reevaluate_after_forge_change(&state.db).await?;
    Ok(())
}

// ====== Forge client 생성 헬퍼 ======

/// Sprint 2026-06-04 — forge 메타(owner/repo/default_remote) 가 비어있으면 레포의
/// `local_path` 에서 1회 재탐지해 self-heal 한다. GitKraken 대량 임포트 당시 미클론 등으로
/// 메타가 비어 forge(PR/Issue/Release) 기능이 막힌 레포를 클릭 시 자동 복구한다.
///
/// `detect_meta` 는 sync(libgit2) 라 `spawn_blocking` 으로 async hot path 차단을 회피하고,
/// repo_lock 을 잡지 않은 채 실행한다(lock 보유 중 git fn 호출 금지 불변식 준수). 실제 DB
/// write 구간만 repo_lock 으로 직렬화 + double-check 해 동시 heal 의 중복 write 를 막는다.
/// 재탐지 실패(경로 없음/비 git)는 raw git2 메시지 대신 actionable validation 에러로 변환한다.
async fn ensure_forge_meta(state: &Arc<AppState>, repo_id: i64) -> AppResult<Repo> {
    let r = state.db.get_repo(repo_id).await?;
    if r.forge_owner.is_some() && r.forge_repo.is_some() && r.default_remote.is_some() {
        return Ok(r);
    }

    // detect_meta 는 repo_lock 을 잡지 않은 채 실행한다. lib.rs 의 repo_lock 불변식상
    // lock 보유 중 git 모듈 fn 호출은 금지(직렬화 latency·재진입 위험). 동시에 같은 레포의
    // 두 forge IPC 가 진입하면 detect 가 중복 실행될 수 있으나 idempotent 하며, 실제 write 는
    // 아래 lock 구간의 double-check 로 1회만 반영된다.
    let local_path = r.local_path.clone();
    let path = std::path::PathBuf::from(&local_path);
    let meta = match tokio::task::spawn_blocking(move || repo::detect_meta(&path)).await {
        Ok(Ok(m)) => m,
        Ok(Err(e)) => {
            return Err(AppError::validation(format!(
                "레포 메타 재탐지 실패 — 로컬 경로를 열 수 없습니다 ({local_path}): {e}. \
                 레포가 이동/삭제되었을 수 있습니다."
            )))
        }
        Err(e) => {
            return Err(AppError::internal(format!(
                "forge 메타 재탐지 task 실패: {e}"
            )))
        }
    };

    // write 구간만 직렬화 — 동시 heal double-write 방지 + lock 대기 중 선행 heal 반영 확인.
    let lock = state.repo_lock(repo_id);
    let _guard = lock.lock().await;
    let r = state.db.get_repo(repo_id).await?;
    if r.forge_owner.is_some() && r.forge_repo.is_some() && r.default_remote.is_some() {
        return Ok(r);
    }
    state
        .db
        .update_repo_forge_meta(
            repo_id,
            meta.default_branch.as_deref(),
            meta.default_remote.as_deref(),
            meta.forge_kind,
            meta.forge_owner.as_deref(),
            meta.forge_repo.as_deref(),
        )
        .await
}

/// repo_id 로부터 적절한 ForgeClient 만든다.
///
/// Resolution chain (plan/43 P3 — R2-F2/F13 반영):
///   1. repos.forge_account_id (per-repo 명시 override)
///   2. 레포 바인딩 프로필(repos.profile_id)의 default_forge_account_id
///   3. 공용(is_default) 프로필의 default_forge_account_id (F-04 — active 폐기, is_default 일원화)
///   4. forge_kind first-match (fallback, 기존 호환)
async fn forge_client_for_repo(
    state: &Arc<AppState>,
    repo_id: i64,
) -> AppResult<(Box<dyn ForgeClient>, String, String)> {
    // forge 메타가 비면 local_path 에서 1회 재탐지(self-heal) 후 진행.
    let r = ensure_forge_meta(state, repo_id).await?;
    let kind = r.forge_kind.clone();
    let owner = r.forge_owner.clone().ok_or_else(|| {
        AppError::validation(
            "이 레포의 forge owner 를 인식하지 못했습니다. origin remote 가 없거나 \
             remote URL 에서 owner/repo 를 추출할 수 없습니다.",
        )
    })?;
    let repo = r.forge_repo.clone().ok_or_else(|| {
        AppError::validation(
            "이 레포의 forge repo 를 인식하지 못했습니다. origin remote URL 을 확인하세요.",
        )
    })?;

    // Resolution chain — 1: per-repo override → 2: 바인딩 프로필 → 3: 공용 프로필 → 4: kind 매칭
    let explicit_account_id = match r.forge_account_id {
        Some(id) => Some(id),
        None => match bound_profile_default_account_id(state, r.profile_id).await? {
            Some(id) => Some(id),
            None => default_profile_default_account_id(state).await?,
        },
    };

    let (client, _account) = if let Some(id) = explicit_account_id {
        build_client_by_id(state, id).await?
    } else {
        build_client(state, &kind, &owner, &repo).await?
    };
    Ok((client, owner, repo))
}

/// 레포에 바인딩된 프로필(repos.profile_id)의 default_forge_account_id 조회 (plan/43 P3 chain 2단계).
async fn bound_profile_default_account_id(
    state: &Arc<AppState>,
    profile_id: Option<i64>,
) -> AppResult<Option<i64>> {
    let Some(pid) = profile_id else {
        return Ok(None);
    };
    let row = sqlx::query("SELECT default_forge_account_id FROM profiles WHERE id = ?")
        .bind(pid)
        .fetch_optional(&state.db.pool)
        .await
        .map_err(AppError::Db)?;
    Ok(row.and_then(|r| {
        r.try_get::<Option<i64>, _>("default_forge_account_id")
            .ok()
            .flatten()
    }))
}

/// 공용(is_default) 프로필의 default_forge_account_id 조회 (plan/43 P3 chain 3단계).
/// F-04 — active 가 아니라 is_default (레포 바인딩 없을 때의 fallback SoT) 기준.
async fn default_profile_default_account_id(state: &Arc<AppState>) -> AppResult<Option<i64>> {
    let row =
        sqlx::query("SELECT default_forge_account_id FROM profiles WHERE is_default = 1 LIMIT 1")
            .fetch_optional(&state.db.pool)
            .await
            .map_err(AppError::Db)?;
    Ok(row.and_then(|r| {
        r.try_get::<Option<i64>, _>("default_forge_account_id")
            .ok()
            .flatten()
    }))
}

/// 명시 account_id 로 ForgeClient 생성. v0.4 #1 — per-repo / Profile 의 명시 계정 사용 경로.
async fn build_client_by_id(
    state: &Arc<AppState>,
    account_id: i64,
) -> AppResult<(Box<dyn ForgeClient>, ForgeAccount)> {
    let row = sqlx::query(
        "SELECT id, forge_kind, base_url, username, keychain_ref FROM forge_accounts WHERE id = ?",
    )
    .bind(account_id)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(AppError::Db)?
    .ok_or_else(|| {
        AppError::validation(format!(
            "지정된 forge_account_id={account_id} 가 forge_accounts 에 없습니다 (삭제됨?). \
             Settings → Profile / 저장소 별 설정 에서 다시 선택하세요."
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

// ====== v0.4 #1 — per-repo forge account override IPC ======

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetRepoForgeAccountArgs {
    pub repo_id: i64,
    /// None → fallback chain (active Profile default → forge_kind 매칭) 사용.
    /// Some(id) → 본 저장소만 명시 계정 사용 (Profile 토글에 영향 받지 않음).
    pub account_id: Option<i64>,
}

/// v0.4 #1 — 저장소 별 forge account 명시 지정 / 해제.
///
/// UI: Settings → Repository-Specific Form 의 "Forge 계정" 드롭다운.
/// Cascade 정책 (UltraPlan §9 Q2): Profile 변경 시 본 override 보존
/// (사용자 명시 결정이 silent 변경되지 않도록 Error Prevention).
#[tauri::command]
pub async fn set_repo_forge_account(
    args: SetRepoForgeAccountArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<crate::storage::Repo> {
    tracing::info!(
        target: "git_fried_lib::ipc",
        repo_id = args.repo_id,
        account_id = ?args.account_id,
        "set_repo_forge_account"
    );
    state
        .db
        .set_repo_forge_account(args.repo_id, args.account_id)
        .await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetRepoSshKeyArgs {
    pub repo_id: i64,
    /// None → 바인딩 프로필 ssh_key_path fallback. Some(path) → per-repo override.
    pub path: Option<String>,
}

/// plan/43 P3 (F-13) — 저장소 별 SSH 키 경로 명시 지정 / 해제.
///
/// DB helper(set_repo_ssh_key_path)는 0007 migration 이후 존재했으나 IPC 미연결.
/// 본 커맨드로 RepoSpecificForm UI 와 연결. 경로는 db helper 가 validate_ssh_key_path 검증.
#[tauri::command]
pub async fn set_repo_ssh_key_path(
    args: SetRepoSshKeyArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<crate::storage::Repo> {
    tracing::info!(
        target: "git_fried_lib::ipc",
        repo_id = args.repo_id,
        "set_repo_ssh_key_path"
    );
    state
        .db
        .set_repo_ssh_key_path(args.repo_id, args.path.as_deref())
        .await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetRepoCredentialArgs {
    pub repo_id: i64,
    /// credential URL context (예: https://github.com). https 스킴 필수.
    pub url: String,
    /// 이 URL 에 쓸 username. None → 해당 키 unset.
    pub username: Option<String>,
}

/// plan/43 P3 (3a) — 레포 `.git/config --local` 에 `credential.<url>.username` 기입.
///
/// **PAT/password 는 절대 쓰지 않음** — username 만 (외부 helper 의 multi-account 힌트).
/// 동적 키라 config_local KEYS allowlist 를 우회하므로 IPC 자체에서 url/username 검증 (iter2 #6).
#[tauri::command]
pub async fn set_repo_credential_identity(
    args: SetRepoCredentialArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    use crate::git::path::reject_dash_prefix;
    use crate::git::runner::{git_run, GitRunOpts};

    // URL 검증 — https 스킴 + 제어문자/공백/quote 차단.
    let url = args.url.trim();
    if !url.starts_with("https://") {
        return Err(AppError::validation(
            "credential URL 은 https:// 스킴이어야 합니다.",
        ));
    }
    if url.chars().any(|c| c.is_control() || c == ' ' || c == '"') {
        return Err(AppError::validation(
            "credential URL 에 허용되지 않는 문자가 있습니다.",
        ));
    }
    reject_dash_prefix(url, "credential url")?;

    // F (plan #45) — apply_repo_config / profile_apply 와 동일하게 per-repo mutation
    // guard 직렬화. 같은 repo `.git/config` 에 동시 쓰는 다른 writer 와의 race window
    // 제거 (이전엔 본 command 만 유일하게 unguarded 였음).
    let _guard = state.repo_mutation_guard(args.repo_id).await;

    let repo = state.db.get_repo(args.repo_id).await?;
    let path = std::path::Path::new(&repo.local_path);
    let key = format!("credential.{url}.username");
    let opts = GitRunOpts::default();

    match args
        .username
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(username) => {
            if username.chars().any(|c| c.is_control() || c == '"') {
                return Err(AppError::validation(
                    "username 에 허용되지 않는 문자가 있습니다.",
                ));
            }
            reject_dash_prefix(username, "credential username")?;
            git_run(
                path,
                &["config", "--local", "--end-of-options", &key, username],
                &opts,
            )
            .await?
            .into_ok()?;
        }
        None => {
            // unset — 미존재 시 exit 5, 무시.
            let _ = git_run(
                path,
                &["config", "--local", "--unset", "--end-of-options", &key],
                &opts,
            )
            .await?;
        }
    }
    tracing::info!(
        target: "git_fried_lib::ipc",
        repo_id = args.repo_id,
        "set_repo_credential_identity"
    );
    Ok(())
}

async fn build_client(
    state: &Arc<AppState>,
    kind: &str,
    _owner: &str,
    _repo: &str,
) -> AppResult<(Box<dyn ForgeClient>, ForgeAccount)> {
    // Sprint 2026-06-04 — kind=unknown(커스텀/IP Gitea 등 미인식 호스트) 는 first-match
    // fallback 으로 풀 수 없다. self-heal 로 owner/repo 는 채워져도 forge 종류를 모르면
    // 어느 계정 API 를 쓸지 알 수 없으므로 actionable 안내. (per-repo 계정 바인딩으로 해소)
    if !matches!(kind, "gitea" | "github") {
        return Err(AppError::validation(format!(
            "이 레포의 forge 종류를 자동 인식하지 못했습니다(kind={kind}). \
             커스텀/IP 호스트일 수 있습니다 — Settings 에서 forge 계정을 등록한 뒤 \
             이 레포에 바인딩하세요."
        )));
    }
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
    client
        .list_pull_requests(&owner, &repo, args.state_filter)
        .await
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
pub struct AddReviewCommentArgs {
    pub repo_id: i64,
    pub number: u64,
    /// PR head SHA. None 이면 GitHub 가 PR detail 에서 자동 조회.
    #[serde(default)]
    pub commit_id: Option<String>,
    pub path: String,
    /// 1-based file line 번호 (RIGHT side).
    pub line: u32,
    /// 호출자가 ` ```suggestion `wrap 까지 포함해서 보낼 것.
    pub body: String,
}

/// PR diff line-level suggestion 코멘트 추가 (`docs/plan/14 §7 F1`).
#[tauri::command]
pub async fn add_review_comment(
    args: AddReviewCommentArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let (client, owner, repo) = forge_client_for_repo(&state, args.repo_id).await?;
    client
        .add_review_comment(
            &owner,
            &repo,
            args.number,
            args.commit_id.as_deref(),
            &args.path,
            args.line,
            &args.body,
        )
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
pub async fn merge_pr(args: MergePrArgs, state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
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
pub async fn close_pr(args: GetPrArgs, state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
    let (client, owner, repo) = forge_client_for_repo(&state, args.repo_id).await?;
    client.close_pr(&owner, &repo, args.number).await
}

#[tauri::command]
pub async fn reopen_pr(args: GetPrArgs, state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
    let (client, owner, repo) = forge_client_for_repo(&state, args.repo_id).await?;
    client.reopen_pr(&owner, &repo, args.number).await
}

/// PR 변경 파일 목록 + per-file unified diff (`docs/plan/22 §3 V-2`).
///
/// 응답 row 의 `patch` 가 None 이면 forge 가 파일이 너무 커서 생략한 것.
#[tauri::command]
pub async fn list_pr_files(
    args: GetPrArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<Vec<PrFile>> {
    let (client, owner, repo) = forge_client_for_repo(&state, args.repo_id).await?;
    client.list_pr_files(&owner, &repo, args.number).await
}
