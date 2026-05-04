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

/// PR 의 변경 파일 (Sprint 22-3 V-2 — `docs/plan/22 §3 V-2`).
///
/// GitHub: `GET /repos/{o}/{r}/pulls/{n}/files` 응답 매핑.
/// Gitea : 동일 endpoint 동일 스키마.
///
/// `patch` 는 unified diff (header 포함). 큰 파일은 forge 가 None 반환할 수 있음.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrFile {
    pub path: String,
    pub previous_path: Option<String>,
    pub status: String, // "added" | "modified" | "removed" | "renamed" | "copied" | "changed"
    pub additions: u32,
    pub deletions: u32,
    pub changes: u32,
    pub patch: Option<String>,
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

// 2026-05-04 /analyze 후속 — forge/model serde round-trip 가드.
// (이전 sub-agent grep 에서 forge 모듈 #[test] 0개로 검출 — 직렬화/역직렬화
//  계약은 Gitea/GitHub API 응답 파싱의 핵심이므로 enum lowercase / camelCase
//  rename_all 이 변하지 않도록 최소 가드.)
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn forge_kind_serde_lowercase() {
        let s = serde_json::to_string(&ForgeKind::Github).unwrap();
        assert_eq!(s, "\"github\"");
        let back: ForgeKind = serde_json::from_str("\"gitea\"").unwrap();
        assert_eq!(back, ForgeKind::Gitea);
    }

    #[test]
    fn pr_state_serde_lowercase_includes_draft() {
        for (kind, expected) in [
            (PrState::Open, "\"open\""),
            (PrState::Closed, "\"closed\""),
            (PrState::Merged, "\"merged\""),
            (PrState::Draft, "\"draft\""),
        ] {
            assert_eq!(serde_json::to_string(&kind).unwrap(), expected);
        }
    }

    #[test]
    fn issue_state_serde_lowercase_open_closed_only() {
        assert_eq!(
            serde_json::to_string(&IssueState::Open).unwrap(),
            "\"open\""
        );
        assert_eq!(
            serde_json::to_string(&IssueState::Closed).unwrap(),
            "\"closed\""
        );
    }

    #[test]
    fn author_serde_camel_case_optional_fields() {
        // displayName / avatarUrl 미존재 케이스 (Gitea 일부 응답에서 누락됨).
        let json = r#"{"username":"tgkim"}"#;
        let a: Author = serde_json::from_str(json).unwrap();
        assert_eq!(a.username, "tgkim");
        assert!(a.display_name.is_none());
        assert!(a.avatar_url.is_none());

        // 채워진 케이스.
        let json2 = r#"{"username":"tgkim","displayName":"태기","avatarUrl":"https://x"}"#;
        let a2: Author = serde_json::from_str(json2).unwrap();
        assert_eq!(a2.display_name.as_deref(), Some("태기"));
    }
}
