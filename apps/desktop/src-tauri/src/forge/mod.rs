// Forge 추상화 — Gitea / GitHub 통합.
//
// `docs/plan/04 §6` 참조. PR / Issue / Release 의 통합 모델.
// 호출자는 ForgeKind 만 분기, Gitea/GitHub 차이는 trait impl 에서 처리.

pub mod gitea;
pub mod github;
pub mod model;

pub use model::{
    Author, ForgeKind, Issue, IssueState, Label, PrState, PullRequest, Release,
};

use crate::error::AppResult;
use async_trait::async_trait;

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
