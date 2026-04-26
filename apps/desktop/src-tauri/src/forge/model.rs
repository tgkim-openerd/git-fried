// Forge 통합 데이터 모델 — Gitea/GitHub 간 호환되도록 정의.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ForgeKind {
    Gitea,
    Github,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PrState {
    Open,
    Closed,
    Merged,
    Draft,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum IssueState {
    Open,
    Closed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Author {
    pub username: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Label {
    pub name: String,
    pub color: String, // hex (with or without #)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PullRequest {
    pub forge_kind: ForgeKind,
    pub owner: String,
    pub repo: String,
    pub number: u64,
    pub title: String,
    pub body_md: String,
    pub state: PrState,
    pub head_branch: String,
    pub base_branch: String,
    pub head_sha: Option<String>,
    pub author: Author,
    pub created_at: i64,
    pub updated_at: i64,
    pub merged: bool,
    pub mergeable: Option<bool>,
    pub draft: bool,
    pub labels: Vec<Label>,
    pub comments: u64,
    pub additions: Option<u64>,
    pub deletions: Option<u64>,
    pub html_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Issue {
    pub forge_kind: ForgeKind,
    pub owner: String,
    pub repo: String,
    pub number: u64,
    pub title: String,
    pub body_md: String,
    pub state: IssueState,
    pub author: Author,
    pub labels: Vec<Label>,
    pub created_at: i64,
    pub updated_at: i64,
    pub comments: u64,
    pub html_url: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReviewVerdict {
    /// 단순 코멘트만 — Approve / RequestChanges 안 함.
    Comment,
    Approve,
    RequestChanges,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrComment {
    pub id: u64,
    pub author: Author,
    pub body_md: String,
    pub created_at: i64,
    pub html_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MergeMethod {
    Merge,
    Squash,
    Rebase,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Release {
    pub forge_kind: ForgeKind,
    pub owner: String,
    pub repo: String,
    pub tag: String,
    pub name: String,
    pub body_md: String,
    pub draft: bool,
    pub prerelease: bool,
    pub created_at: i64,
    pub html_url: String,
}
