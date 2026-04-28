// Diff 출력 (file-level / hunk-level).
//
// `git diff` plain text 출력을 그대로 사용. 프론트는 CodeMirror 6 으로 렌더.

use crate::error::AppResult;
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffArgs {
    /// staged (index vs HEAD) — true: --cached.
    pub staged: bool,
    /// 단일 파일 (없으면 전체 변경).
    pub path: Option<String>,
    /// rev (예: HEAD~1, sha) — 두 점 / 세 점 비교는 별도 함수.
    pub rev: Option<String>,
    /// context line 수 (디폴트 3).
    pub context: Option<u32>,
}

/// working/staged 의 변경 diff (text patch).
pub async fn diff(repo: &Path, args: &DiffArgs) -> AppResult<String> {
    let mut a: Vec<String> = vec!["diff".into()];
    if args.staged {
        a.push("--cached".into());
    }
    if let Some(c) = args.context {
        a.push(format!("-U{c}"));
    }
    if let Some(rev) = &args.rev {
        a.push(rev.clone());
    }
    a.push("--".into());
    if let Some(p) = &args.path {
        a.push(p.clone());
    }
    let args_ref: Vec<&str> = a.iter().map(|s| s.as_str()).collect();
    git_run(repo, &args_ref, &GitRunOpts::default())
        .await?
        .into_ok()
}

/// 두 커밋(또는 ref) 사이의 diff.
pub async fn diff_revs(repo: &Path, from: &str, to: &str) -> AppResult<String> {
    git_run(
        repo,
        &["diff", &format!("{from}..{to}"), "--"],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()
}

/// 단일 커밋의 diff (parent 와 비교).
///
/// `context` 가 None 이면 git 기본값 (3 라인). Sprint B1 의 3-mode 토글:
///   - compact: Some(0)  — 변경 라인만
///   - default: None     — 컨텍스트 3 라인
///   - context: Some(25) — 더 많은 컨텍스트
pub async fn diff_commit(repo: &Path, sha: &str, context: Option<u32>) -> AppResult<String> {
    let mut args: Vec<String> = vec![
        "show".into(),
        "--patch-with-stat".into(),
        "--no-color".into(),
    ];
    if let Some(c) = context {
        args.push(format!("-U{c}"));
    }
    args.push(sha.to_string());
    let refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    git_run(repo, &refs, &GitRunOpts::default())
        .await?
        .into_ok()
}
