// Commit 작업.
//
// 한글 안전성을 위해 메시지는 항상 임시 파일 경유 (`-F`).
// Conventional Commits 빌더는 프론트(`CommitMessageInput.vue`) 에서 조립한
// 최종 메시지를 그대로 받는다. 본 모듈은 git 호출만 담당.

use crate::error::{AppError, AppResult};
use crate::git::runner::{git_run, GitOutput, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::Path;

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitOpts {
    /// `--amend` (마지막 커밋 수정).
    pub amend: bool,
    /// `--allow-empty`.
    pub allow_empty: bool,
    /// `--no-verify` (pre-commit hook 우회). 디폴트 false.
    pub no_verify: bool,
    /// `--signoff` (Signed-off-by trailer).
    pub signoff: bool,
    /// 사용자가 명시적으로 author 변경 (예: "이름 <email>")
    pub author: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    /// 새로 생긴 commit 의 SHA (성공 시).
    pub new_sha: Option<String>,
}

/// 메시지를 임시 파일에 쓰고 `git commit -F <file>` 호출.
pub async fn commit(repo: &Path, message: &str, opts: CommitOpts) -> AppResult<CommitResult> {
    if message.trim().is_empty() {
        return Err(AppError::validation("커밋 메시지가 비었습니다."));
    }

    // 임시 파일 작성 (UTF-8, BOM 없음, LF 종결).
    let mut tmp = tempfile::NamedTempFile::new().map_err(AppError::Io)?;
    tmp.write_all(message.as_bytes()).map_err(AppError::Io)?;
    tmp.write_all(b"\n").map_err(AppError::Io)?;
    let path = tmp.path().to_string_lossy().into_owned();

    let mut args: Vec<&str> = vec!["commit", "-F", &path];
    if opts.amend {
        args.push("--amend");
    }
    if opts.allow_empty {
        args.push("--allow-empty");
    }
    if opts.no_verify {
        args.push("--no-verify");
    }
    if opts.signoff {
        args.push("--signoff");
    }
    let author_arg;
    if let Some(a) = &opts.author {
        author_arg = format!("--author={a}");
        args.push(&author_arg);
    }

    let out = git_run(repo, &args, &GitRunOpts::default()).await?;

    let new_sha = if out.exit_code == Some(0) {
        // HEAD 의 SHA 조회
        let sha = git_run(repo, &["rev-parse", "HEAD"], &GitRunOpts::default())
            .await?
            .into_ok()
            .ok()
            .map(|s| s.trim().to_string());
        sha
    } else {
        None
    };

    Ok(CommitResult {
        success: out.exit_code == Some(0),
        stdout: out.stdout,
        stderr: out.stderr,
        exit_code: out.exit_code,
        new_sha,
    })
}

/// 빠른 도우미 — 옵션 없이 메시지만으로 커밋.
pub async fn commit_simple(repo: &Path, message: &str) -> AppResult<CommitResult> {
    commit(repo, message, CommitOpts::default()).await
}

/// 마지막 커밋 메시지 조회 (amend UI 의 기본값).
pub async fn last_commit_message(repo: &Path) -> AppResult<String> {
    let out = git_run(repo, &["log", "-1", "--pretty=%B"], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(out.trim_end().to_string())
}

#[allow(dead_code)]
fn _gitoutput_marker(_: &GitOutput) {}
