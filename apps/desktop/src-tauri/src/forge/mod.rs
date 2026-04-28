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
