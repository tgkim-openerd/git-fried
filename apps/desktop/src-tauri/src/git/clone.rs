// Repo clone (`docs/plan/14 §6 E1 + E2` Sprint C14-2).
//
// 단순 URL+경로 외에 sparse-checkout / shallow / single-branch 고급 옵션 지원.
// 모두 git CLI shell-out — runner::git_run 통과 (한글 경로 안전).
//
// Sparse-checkout 흐름 (cone 모드):
//   1) git clone --no-checkout <url> <path>
//   2) cd <path> && git sparse-checkout init --cone
//   3) git sparse-checkout set <path1> <path2> ...
//   4) git checkout (default branch)
//
// Shallow:
//   --depth N      = 최근 N 커밋만
//   --shallow-since DATE = 그 이후 커밋만
//   --single-branch --branch B = 한 브랜치만

use crate::error::{AppError, AppResult};
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloneOptions {
    /// sparse-checkout cone path 목록. None / 빈 = 전체 checkout.
    #[serde(default)]
    pub sparse_paths: Option<Vec<String>>,
    /// `--depth N`. None = full clone.
    #[serde(default)]
    pub depth: Option<u32>,
    /// `--shallow-since DATE` (예: "2024-01-01"). None = 무관.
    #[serde(default)]
    pub shallow_since: Option<String>,
    /// `--single-branch --branch B`. None = 모든 브랜치.
    #[serde(default)]
    pub single_branch: Option<String>,
    /// `--bare` clone.
    #[serde(default)]
    pub bare: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloneResult {
    pub target_path: String,
    pub stdout: String,
    pub stderr: String,
}

/// `git clone <url> <target>` + 옵션. 부모 디렉토리는 호출 측에서 보장.
pub async fn clone(url: &str, target: &Path, opts: &CloneOptions) -> AppResult<CloneResult> {
    if url.trim().is_empty() {
        return Err(AppError::validation("clone URL 이 비어있음"));
    }
    let target_str = target.to_string_lossy().to_string();

    let parent = target.parent().ok_or_else(|| {
        AppError::validation(format!("대상 경로의 부모 디렉토리 추출 실패: {target_str}"))
    })?;
    if !parent.exists() {
        return Err(AppError::validation(format!(
            "부모 디렉토리가 존재하지 않습니다: {}",
            parent.to_string_lossy()
        )));
    }
    if target.exists() {
        return Err(AppError::validation(format!(
            "이미 존재하는 경로입니다: {target_str}"
        )));
    }

    // === clone command 구성 ===
    let mut args: Vec<String> = vec!["clone".into()];
    let needs_no_checkout = opts.sparse_paths.as_ref().is_some_and(|v| !v.is_empty());
    if needs_no_checkout {
        args.push("--no-checkout".into());
        // cone 모드 sparse 권장 — 5.0+ git
        args.push("--sparse".into());
    }
    if let Some(d) = opts.depth.filter(|&d| d > 0) {
        args.push(format!("--depth={d}"));
    }
    if let Some(s) = opts.shallow_since.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        args.push(format!("--shallow-since={s}"));
    }
    if let Some(b) = opts.single_branch.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        args.push("--single-branch".into());
        args.push(format!("--branch={b}"));
    }
    if opts.bare {
        args.push("--bare".into());
    }
    args.push(url.into());
    args.push(target_str.clone());

    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    // clone 은 부모 디렉토리에서 실행 (target 자체는 아직 없음).
    let clone_out = git_run(parent, &arg_refs, &GitRunOpts::default()).await?;
    if clone_out.exit_code != Some(0) {
        return Err(AppError::GitCli {
            message: format!(
                "git clone 실패 (exit={:?})",
                clone_out.exit_code
            ),
            exit_code: clone_out.exit_code,
            stderr: clone_out.stderr,
        });
    }

    let mut combined_stderr = clone_out.stderr.clone();

    // === sparse paths 적용 + checkout ===
    if let Some(paths) = opts
        .sparse_paths
        .as_ref()
        .filter(|v| !v.is_empty())
    {
        // (이미 --sparse + --no-checkout 으로 시작했으므로 init 은 자동.
        //  안전하게 sparse-checkout init --cone 도 호출.)
        let _ = git_run(
            target,
            &["sparse-checkout", "init", "--cone"],
            &GitRunOpts::default(),
        )
        .await?;

        let mut set_args: Vec<&str> = vec!["sparse-checkout", "set"];
        for p in paths {
            set_args.push(p);
        }
        let set_out = git_run(target, &set_args, &GitRunOpts::default()).await?;
        combined_stderr.push_str(&set_out.stderr);
        if set_out.exit_code != Some(0) {
            return Err(AppError::GitCli {
                message: format!(
                    "sparse-checkout set 실패 (exit={:?})",
                    set_out.exit_code
                ),
                exit_code: set_out.exit_code,
                stderr: set_out.stderr,
            });
        }

        let co_out = git_run(target, &["checkout"], &GitRunOpts::default()).await?;
        combined_stderr.push_str(&co_out.stderr);
        if co_out.exit_code != Some(0) {
            return Err(AppError::GitCli {
                message: format!("checkout 실패 (exit={:?})", co_out.exit_code),
                exit_code: co_out.exit_code,
                stderr: co_out.stderr,
            });
        }
    }

    Ok(CloneResult {
        target_path: PathBuf::from(target).to_string_lossy().to_string(),
        stdout: clone_out.stdout,
        stderr: combined_stderr,
    })
}
