// Gitea API 클라이언트.
//
// Swagger v1 (`{base}/api/v1/...`) 사용. 인증은 PAT 헤더 `Authorization: token <PAT>`.
// 사용자 회사 인스턴스: https://git.dev.opnd.io

use super::model::{
    Author, ForgeKind, Issue, IssueState, Label, PrState, PullRequest, Release,
};
use super::{CreatePullRequestReq, ForgeClient};
use crate::error::{AppError, AppResult};
use async_trait::async_trait;
use chrono::DateTime;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, USER_AGENT};
use reqwest::Client;
use serde::Deserialize;

#[derive(Clone)]
pub struct GiteaClient {
    base_url: String,
    http: Client,
}

impl GiteaClient {
    pub fn new(base_url: &str, token: &str) -> AppResult<Self> {
        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("token {token}"))
                .map_err(|_| AppError::validation("Gitea PAT 형식 오류"))?,
        );
        headers.insert(ACCEPT, HeaderValue::from_static("application/json"));
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static("git-fried/0.0 (+https://git-fried)"),
        );
        let http = Client::builder()
            .default_headers(headers)
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(AppError::Http)?;
        Ok(Self {
            base_url: normalize_base(base_url),
            http,
        })
    }

    fn url(&self, path: &str) -> String {
        format!("{}/api/v1{path}", self.base_url)
    }
}

fn normalize_base(s: &str) -> String {
    s.trim_end_matches('/').to_string()
}

fn parse_iso(s: &str) -> i64 {
    DateTime::parse_from_rfc3339(s)
        .map(|d| d.timestamp())
        .unwrap_or(0)
}

#[async_trait]
impl ForgeClient for GiteaClient {
    fn kind(&self) -> ForgeKind {
        ForgeKind::Gitea
    }
    fn base_url(&self) -> &str {
        &self.base_url
    }

    async fn list_pull_requests(
        &self,
        owner: &str,
        repo: &str,
        state_filter: Option<PrState>,
    ) -> AppResult<Vec<PullRequest>> {
        let state = match state_filter {
            Some(PrState::Closed) | Some(PrState::Merged) => "closed",
            Some(PrState::Open) | Some(PrState::Draft) => "open",
            _ => "all",
        };
        let url = self.url(&format!(
            "/repos/{owner}/{repo}/pulls?state={state}&limit=50&page=1"
        ));
        let res: Vec<RawPr> = self.http.get(&url).send().await?.error_for_status()?.json().await?;
        Ok(res.into_iter().map(|r| r.into_pr(owner, repo)).collect())
    }

    async fn get_pull_request(
        &self,
        owner: &str,
        repo: &str,
        number: u64,
    ) -> AppResult<PullRequest> {
        let url = self.url(&format!("/repos/{owner}/{repo}/pulls/{number}"));
        let r: RawPr = self.http.get(&url).send().await?.error_for_status()?.json().await?;
        Ok(r.into_pr(owner, repo))
    }

    async fn create_pull_request(
        &self,
        owner: &str,
        repo: &str,
        req: CreatePullRequestReq,
    ) -> AppResult<PullRequest> {
        let url = self.url(&format!("/repos/{owner}/{repo}/pulls"));
        let body = serde_json::json!({
            "title": req.title,
            "body": req.body,
            "head": req.head,
            "base": req.base,
            // Gitea 는 별도 draft 필드 없음 — 제목 prefix [WIP] 로 관리.
            // 사용자 결정에 따라 필요시 추후 추가.
        });
        let r: RawPr = self
            .http
            .post(&url)
            .json(&body)
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;
        Ok(r.into_pr(owner, repo))
    }

    async fn list_issues(&self, owner: &str, repo: &str) -> AppResult<Vec<Issue>> {
        let url = self.url(&format!(
            "/repos/{owner}/{repo}/issues?state=open&type=issues&limit=50"
        ));
        let res: Vec<RawIssue> = self.http.get(&url).send().await?.error_for_status()?.json().await?;
        Ok(res.into_iter().map(|r| r.into_issue(owner, repo)).collect())
    }

    async fn list_releases(&self, owner: &str, repo: &str) -> AppResult<Vec<Release>> {
        let url = self.url(&format!("/repos/{owner}/{repo}/releases?limit=50"));
        let res: Vec<RawRelease> = self.http.get(&url).send().await?.error_for_status()?.json().await?;
        Ok(res.into_iter().map(|r| r.into_release(owner, repo)).collect())
    }

    async fn whoami(&self) -> AppResult<Author> {
        let url = self.url("/user");
        let r: RawUser = self.http.get(&url).send().await?.error_for_status()?.json().await?;
        Ok(r.into_author())
    }
}

// === Gitea raw response 모델 ===

#[derive(Debug, Deserialize)]
struct RawPr {
    number: u64,
    title: String,
    #[serde(default)]
    body: String,
    state: String,
    #[serde(default)]
    merged: bool,
    head: RawRef,
    base: RawRef,
    user: RawUser,
    #[serde(default)]
    labels: Vec<RawLabel>,
    created_at: String,
    updated_at: String,
    html_url: String,
    #[serde(default)]
    comments: u64,
    #[serde(default)]
    additions: Option<u64>,
    #[serde(default)]
    deletions: Option<u64>,
    #[serde(default)]
    mergeable: Option<bool>,
    #[serde(default)]
    draft: bool,
}

impl RawPr {
    fn into_pr(self, owner: &str, repo: &str) -> PullRequest {
        let state = if self.merged {
            PrState::Merged
        } else if self.draft && self.state == "open" {
            PrState::Draft
        } else if self.state == "open" {
            PrState::Open
        } else {
            PrState::Closed
        };
        PullRequest {
            forge_kind: ForgeKind::Gitea,
            owner: owner.to_string(),
            repo: repo.to_string(),
            number: self.number,
            title: self.title,
            body_md: self.body,
            state,
            head_branch: self.head.r#ref,
            base_branch: self.base.r#ref,
            head_sha: Some(self.head.sha),
            author: self.user.into_author(),
            created_at: parse_iso(&self.created_at),
            updated_at: parse_iso(&self.updated_at),
            merged: self.merged,
            mergeable: self.mergeable,
            draft: self.draft,
            labels: self.labels.into_iter().map(|l| l.into_label()).collect(),
            comments: self.comments,
            additions: self.additions,
            deletions: self.deletions,
            html_url: self.html_url,
        }
    }
}

#[derive(Debug, Deserialize)]
struct RawRef {
    r#ref: String,
    sha: String,
}

#[derive(Debug, Deserialize)]
struct RawUser {
    login: String,
    #[serde(default)]
    full_name: Option<String>,
    #[serde(default)]
    avatar_url: Option<String>,
}

impl RawUser {
    fn into_author(self) -> Author {
        Author {
            username: self.login,
            display_name: self.full_name,
            avatar_url: self.avatar_url,
        }
    }
}

#[derive(Debug, Deserialize)]
struct RawLabel {
    name: String,
    #[serde(default)]
    color: String,
}

impl RawLabel {
    fn into_label(self) -> Label {
        Label {
            name: self.name,
            color: if self.color.starts_with('#') {
                self.color
            } else {
                format!("#{}", self.color)
            },
        }
    }
}

#[derive(Debug, Deserialize)]
struct RawIssue {
    number: u64,
    title: String,
    #[serde(default)]
    body: String,
    state: String,
    user: RawUser,
    #[serde(default)]
    labels: Vec<RawLabel>,
    created_at: String,
    updated_at: String,
    html_url: String,
    #[serde(default)]
    comments: u64,
}

impl RawIssue {
    fn into_issue(self, owner: &str, repo: &str) -> Issue {
        let state = if self.state == "open" {
            IssueState::Open
        } else {
            IssueState::Closed
        };
        Issue {
            forge_kind: ForgeKind::Gitea,
            owner: owner.into(),
            repo: repo.into(),
            number: self.number,
            title: self.title,
            body_md: self.body,
            state,
            author: self.user.into_author(),
            labels: self.labels.into_iter().map(|l| l.into_label()).collect(),
            created_at: parse_iso(&self.created_at),
            updated_at: parse_iso(&self.updated_at),
            comments: self.comments,
            html_url: self.html_url,
        }
    }
}

#[derive(Debug, Deserialize)]
struct RawRelease {
    tag_name: String,
    name: String,
    #[serde(default)]
    body: String,
    #[serde(default)]
    draft: bool,
    #[serde(default)]
    prerelease: bool,
    created_at: String,
    html_url: String,
}

impl RawRelease {
    fn into_release(self, owner: &str, repo: &str) -> Release {
        Release {
            forge_kind: ForgeKind::Gitea,
            owner: owner.into(),
            repo: repo.into(),
            tag: self.tag_name,
            name: self.name,
            body_md: self.body,
            draft: self.draft,
            prerelease: self.prerelease,
            created_at: parse_iso(&self.created_at),
            html_url: self.html_url,
        }
    }
}
