// Forge 추상화 — Gitea / GitHub 통합.
//
// `docs/plan/04 §6` 참조. PR / Issue / Release 의 통합 모델.
// 호출자는 ForgeKind 만 분기, Gitea/GitHub 차이는 trait impl 에서 처리.

pub mod gitea;
pub mod github;
pub mod model;

pub use model::{
    Author, ForgeKind, Issue, IssueState, Label, MergeMethod, PrComment, PrFile, PrState,
    PullRequest, Release, ReviewVerdict,
};

use crate::error::{AppError, AppResult};
use async_trait::async_trait;
use reqwest::{Response, StatusCode};

/// Sprint c45 P0-3 — Forge HTTP 응답 status code 검증 extension trait.
///
/// 401/403 → AppError::AuthExpired (frontend AuthExpired modal trigger)
/// 429     → AppError::RateLimit { retry_after } (Retry-After 헤더 파싱, 기본 60s)
/// 그 외 4xx/5xx → reqwest::Response::error_for_status() 표준 에러 매핑
///
/// 사용:
/// ```ignore
/// let body: T = self.http.get(&url).send().await?
///     .error_for_status_forge("github")?
///     .json().await?;
/// ```
pub trait ResponseForgeExt: Sized {
    fn error_for_status_forge(self, provider: &str) -> AppResult<Self>;
}

impl ResponseForgeExt for Response {
    fn error_for_status_forge(self, provider: &str) -> AppResult<Self> {
        let status = self.status();
        let url = self.url().clone();
        match status {
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
                tracing::warn!(provider, %status, %url, "Forge auth expired");
                Err(AppError::auth_expired(provider))
            }
            StatusCode::TOO_MANY_REQUESTS => {
                let retry_after = self
                    .headers()
                    .get("Retry-After")
                    .and_then(|h| h.to_str().ok())
                    .and_then(|s| s.parse::<u64>().ok())
                    .unwrap_or(60);
                tracing::warn!(provider, retry_after, %url, "Forge rate limit");
                Err(AppError::rate_limit(provider, retry_after))
            }
            s if s.is_client_error() || s.is_server_error() => {
                tracing::error!(provider, %status, %url, "Forge HTTP error");
                self.error_for_status().map_err(AppError::Http)
            }
            _ => {
                tracing::debug!(provider, %status, %url, "Forge response OK");
                Ok(self)
            }
        }
    }
}

/// Forge 클라이언트 공통 인터페이스.
#[async_trait]
pub trait ForgeClient: Send + Sync {
    fn kind(&self) -> ForgeKind;
    fn base_url(&self) -> &str;

    async fn list_pull_requests(
        &self,
        owner: &str,
        repo: &str,
        state_filter: Option<PrState>,
    ) -> AppResult<Vec<PullRequest>>;

    async fn get_pull_request(
        &self,
        owner: &str,
        repo: &str,
        number: u64,
    ) -> AppResult<PullRequest>;

    async fn create_pull_request(
        &self,
        owner: &str,
        repo: &str,
        req: CreatePullRequestReq,
    ) -> AppResult<PullRequest>;

    async fn list_issues(&self, owner: &str, repo: &str) -> AppResult<Vec<Issue>>;

    async fn list_releases(&self, owner: &str, repo: &str) -> AppResult<Vec<Release>>;

    async fn whoami(&self) -> AppResult<Author>;

    /// PR 의 일반 issue-comment 목록.
    async fn list_pr_comments(
        &self,
        owner: &str,
        repo: &str,
        number: u64,
    ) -> AppResult<Vec<PrComment>>;

    /// PR 에 일반 코멘트 추가.
    async fn add_pr_comment(
        &self,
        owner: &str,
        repo: &str,
        number: u64,
        body: &str,
    ) -> AppResult<PrComment>;

    /// PR diff 의 특정 라인에 review-comment 추가 (`docs/plan/14 §7 F1`).
    /// - `body` 는 호출자가 ` ```suggestion ` wrap 까지 완성해서 전달.
    /// - `commit_id` 는 PR head SHA. None 이면 forge 가 자동 (GitHub 는 필수).
    /// - `line` 은 RIGHT side (PR 의 새 코드) 의 1-based file line 번호.
    async fn add_review_comment(
        &self,
        owner: &str,
        repo: &str,
        number: u64,
        commit_id: Option<&str>,
        path: &str,
        line: u32,
        body: &str,
    ) -> AppResult<()>;

    /// PR review 제출 (Approve / RequestChanges / Comment + 본문).
    async fn submit_pr_review(
        &self,
        owner: &str,
        repo: &str,
        number: u64,
        verdict: ReviewVerdict,
        body: &str,
    ) -> AppResult<()>;

    /// PR 머지 (method 선택).
    async fn merge_pr(
        &self,
        owner: &str,
        repo: &str,
        number: u64,
        method: MergeMethod,
        title: Option<&str>,
        message: Option<&str>,
    ) -> AppResult<()>;

    /// PR 닫기 (머지 안 함).
    async fn close_pr(&self, owner: &str, repo: &str, number: u64) -> AppResult<()>;

    /// PR 다시 열기.
    async fn reopen_pr(&self, owner: &str, repo: &str, number: u64) -> AppResult<()>;

    /// PR 의 변경 파일 목록 (Sprint 22-3 V-2 — `docs/plan/22 §3 V-2`).
    ///
    /// GitHub : `GET /repos/{o}/{r}/pulls/{n}/files` (per_page 100, 필요 시 페이지네이션).
    /// Gitea  : 동일 endpoint, 동일 스키마.
    /// 응답에는 file 별 unified diff `patch` 포함 (대용량은 None 가능).
    async fn list_pr_files(&self, owner: &str, repo: &str, number: u64) -> AppResult<Vec<PrFile>>;
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePullRequestReq {
    pub title: String,
    pub body: String,
    pub head: String,
    pub base: String,
    pub draft: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use httpmock::Method::GET;
    use httpmock::MockServer;

    // Sprint c89-B Phase 1.2 (plan/36 §2.1.2) — Forge API fault injection.
    // ResponseForgeExt::error_for_status_forge 의 status → AppError 매핑 매트릭스.
    // 4 case: 401 / 403 / 429+Retry-After / 200 OK pass-through.

    #[tokio::test]
    async fn forge_401_maps_to_auth_expired() {
        let server = MockServer::start_async().await;
        server
            .mock_async(|when, then| {
                when.method(GET).path("/api/v1/user");
                then.status(401);
            })
            .await;

        let res = reqwest::get(server.url("/api/v1/user")).await.unwrap();
        let err = res.error_for_status_forge("gitea").unwrap_err();
        match err {
            AppError::AuthExpired { provider } => assert_eq!(provider, "gitea"),
            other => panic!("expected AuthExpired, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn forge_403_maps_to_auth_expired() {
        let server = MockServer::start_async().await;
        server
            .mock_async(|when, then| {
                when.method(GET).path("/repos/o/r");
                then.status(403);
            })
            .await;

        let res = reqwest::get(server.url("/repos/o/r")).await.unwrap();
        let err = res.error_for_status_forge("github").unwrap_err();
        match err {
            AppError::AuthExpired { provider } => assert_eq!(provider, "github"),
            other => panic!("expected AuthExpired, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn forge_429_with_retry_after_maps_to_rate_limit() {
        let server = MockServer::start_async().await;
        server
            .mock_async(|when, then| {
                when.method(GET).path("/api/v3/repos");
                then.status(429).header("Retry-After", "120");
            })
            .await;

        let res = reqwest::get(server.url("/api/v3/repos")).await.unwrap();
        let err = res.error_for_status_forge("github").unwrap_err();
        match err {
            AppError::RateLimit {
                provider,
                retry_after,
            } => {
                assert_eq!(provider, "github");
                assert_eq!(retry_after, 120);
            }
            other => panic!("expected RateLimit, got {other:?}"),
        }
    }

    /// 429 응답에 Retry-After 헤더 부재 시 default 60s.
    #[tokio::test]
    async fn forge_429_without_retry_after_defaults_to_60s() {
        let server = MockServer::start_async().await;
        server
            .mock_async(|when, then| {
                when.method(GET).path("/api/v1/repos");
                then.status(429);
            })
            .await;

        let res = reqwest::get(server.url("/api/v1/repos")).await.unwrap();
        let err = res.error_for_status_forge("gitea").unwrap_err();
        match err {
            AppError::RateLimit { retry_after, .. } => assert_eq!(retry_after, 60),
            other => panic!("expected RateLimit with default retry_after, got {other:?}"),
        }
    }

    /// 429 + 잘못된 Retry-After (non-integer) 도 default 60s (안전 fallback).
    #[tokio::test]
    async fn forge_429_invalid_retry_after_defaults_to_60s() {
        let server = MockServer::start_async().await;
        server
            .mock_async(|when, then| {
                when.method(GET).path("/api/v1/repos");
                then.status(429)
                    .header("Retry-After", "Wed, 21 Oct 2027 07:28:00 GMT");
            })
            .await;

        let res = reqwest::get(server.url("/api/v1/repos")).await.unwrap();
        let err = res.error_for_status_forge("gitea").unwrap_err();
        match err {
            AppError::RateLimit { retry_after, .. } => assert_eq!(retry_after, 60),
            other => panic!("expected RateLimit fallback, got {other:?}"),
        }
    }

    /// 200 OK 응답은 통과 — body 포함 Response 반환.
    #[tokio::test]
    async fn forge_200_passes_through() {
        let server = MockServer::start_async().await;
        server
            .mock_async(|when, then| {
                when.method(GET).path("/ok");
                then.status(200).body("hello");
            })
            .await;

        let res = reqwest::get(server.url("/ok")).await.unwrap();
        let res = res
            .error_for_status_forge("gitea")
            .expect("200 should pass");
        let body = res.text().await.unwrap();
        assert_eq!(body, "hello");
    }

    /// 500 server error 는 reqwest::Error 로 매핑 (AppError::Http).
    #[tokio::test]
    async fn forge_500_maps_to_http_error() {
        let server = MockServer::start_async().await;
        server
            .mock_async(|when, then| {
                when.method(GET).path("/boom");
                then.status(500);
            })
            .await;

        let res = reqwest::get(server.url("/boom")).await.unwrap();
        let err = res.error_for_status_forge("gitea").unwrap_err();
        assert_eq!(err.kind(), "http");
    }
}
