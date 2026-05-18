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

/// SB-017 (UltraPlan v0.4 sidebar microgap Phase 4, 2026-05-18) — PR head_sha 의 combined
/// CI 상태. Gitea `/repos/{o}/{r}/statuses/{sha}` 의 state 또는 GitHub `/repos/{o}/{r}/
/// commits/{sha}/status` 의 state 매핑.
///
/// Frontend 4 아이콘 매핑:
///   - PR.draft=true → ⚫ gray D (CI status 무관, 최우선)
///   - Success → 🟢 green check
///   - Pending → 🟡 yellow dot
///   - Failure → 🔴 red X
///   - None (no CI run) → 표시 없음
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CiStatus {
    Success,
    Pending,
    Failure,
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
    /// SB-017 — head_sha 의 combined CI 상태 (별도 API 호출로 채움).
    /// 미호출 / CI 없는 sha 는 None.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ci_status: Option<CiStatus>,
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

    // 2026-05-05 c41 — forge/model 추가 가드 (`auth_expired/rate_limit` mock 대신
    // serde 계약 정합성 강화). GitHub API 응답 변경 시 silent break 방지.

    #[test]
    fn review_verdict_serde_snake_case_request_changes() {
        // GitHub PR review state: APPROVED/COMMENTED/CHANGES_REQUESTED 와 별개로
        // 우리 ReviewVerdict 는 snake_case 통일 (`request_changes`).
        for (kind, expected) in [
            (ReviewVerdict::Comment, "\"comment\""),
            (ReviewVerdict::Approve, "\"approve\""),
            (ReviewVerdict::RequestChanges, "\"request_changes\""),
        ] {
            assert_eq!(serde_json::to_string(&kind).unwrap(), expected);
        }
        // round-trip
        let back: ReviewVerdict = serde_json::from_str("\"request_changes\"").unwrap();
        assert_eq!(back, ReviewVerdict::RequestChanges);
    }

    #[test]
    fn merge_method_serde_lowercase_three_methods() {
        for (kind, expected) in [
            (MergeMethod::Merge, "\"merge\""),
            (MergeMethod::Squash, "\"squash\""),
            (MergeMethod::Rebase, "\"rebase\""),
        ] {
            assert_eq!(serde_json::to_string(&kind).unwrap(), expected);
        }
    }

    #[test]
    fn ci_status_serde_snake_case_three_variants() {
        // SB-017 (Phase 4, 2026-05-18) — Gitea/GitHub combined CI state mapping.
        for (kind, expected) in [
            (CiStatus::Success, "\"success\""),
            (CiStatus::Pending, "\"pending\""),
            (CiStatus::Failure, "\"failure\""),
        ] {
            assert_eq!(serde_json::to_string(&kind).unwrap(), expected);
        }
        // round-trip
        let back: CiStatus = serde_json::from_str("\"pending\"").unwrap();
        assert_eq!(back, CiStatus::Pending);
    }

    #[test]
    fn pull_request_ci_status_optional_default_none() {
        // SB-017 — 기존 PR 응답 (ci_status 필드 없음) backward-compat.
        let json = r#"{
            "forgeKind":"github",
            "owner":"tgkim","repo":"git-fried","number":1,
            "title":"feat: x","bodyMd":"",
            "state":"open","headBranch":"feat/x","baseBranch":"main",
            "headSha":"abc","author":{"username":"tgkim"},
            "createdAt":0,"updatedAt":0,"merged":false,
            "draft":false,"labels":[],"comments":0,
            "htmlUrl":"https://github.com/tgkim/git-fried/pull/1"
        }"#;
        let pr: PullRequest = serde_json::from_str(json).unwrap();
        assert!(pr.ci_status.is_none());

        // ci_status 채워진 케이스.
        let json2 = r#"{
            "forgeKind":"gitea",
            "owner":"tgkim","repo":"git-fried","number":2,
            "title":"feat: y","bodyMd":"",
            "state":"open","headBranch":"feat/y","baseBranch":"main",
            "headSha":"def","author":{"username":"tgkim"},
            "createdAt":0,"updatedAt":0,"merged":false,
            "draft":false,"labels":[],"comments":0,
            "htmlUrl":"https://git.dev.opnd.io/tgkim/git-fried/pulls/2",
            "ciStatus":"success"
        }"#;
        let pr2: PullRequest = serde_json::from_str(json2).unwrap();
        assert_eq!(pr2.ci_status, Some(CiStatus::Success));
    }

    #[test]
    fn pr_file_serde_camel_case_with_optional_previous_path() {
        // GitHub PR files 응답 (rename 시 previousPath 존재).
        let json = r#"{
            "path":"src/foo.rs",
            "previousPath":"src/old.rs",
            "status":"renamed",
            "additions":3,
            "deletions":1,
            "changes":4,
            "patch":"@@ ..."
        }"#;
        let f: PrFile = serde_json::from_str(json).unwrap();
        assert_eq!(f.path, "src/foo.rs");
        assert_eq!(f.previous_path.as_deref(), Some("src/old.rs"));
        assert_eq!(f.status, "renamed");
        assert_eq!(f.additions, 3);
        assert_eq!(f.deletions, 1);

        // patch 가 누락된 케이스 (forge 가 큰 파일 시 None 반환).
        let json2 = r#"{
            "path":"big.bin",
            "status":"modified",
            "additions":0,
            "deletions":0,
            "changes":0
        }"#;
        let f2: PrFile = serde_json::from_str(json2).unwrap();
        assert!(f2.previous_path.is_none());
        assert!(f2.patch.is_none());
    }

    #[test]
    fn release_serde_camel_case_draft_prerelease() {
        let json = r#"{
            "forgeKind":"github",
            "owner":"tgkim",
            "repo":"git-fried",
            "tag":"v0.3.0",
            "name":"0.3.0",
            "bodyMd":"changelog body",
            "draft":false,
            "prerelease":true,
            "createdAt":1714521600,
            "htmlUrl":"https://github.com/tgkim/git-fried/releases/tag/v0.3.0"
        }"#;
        let r: Release = serde_json::from_str(json).unwrap();
        assert_eq!(r.tag, "v0.3.0");
        assert!(!r.draft);
        assert!(r.prerelease);
        assert_eq!(r.body_md, "changelog body");
    }
}
