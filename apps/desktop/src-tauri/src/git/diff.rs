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
pub async fn diff_commit(repo: &Path, sha: &str) -> AppResult<String> {
    git_run(
        repo,
        &["show", "--patch-with-stat", "--no-color", sha],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()
}
