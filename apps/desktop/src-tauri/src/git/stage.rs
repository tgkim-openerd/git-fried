// 스테이징 작업 (add / reset / restore).
//
// git CLI shell-out 사용 — libgit2 의 index_add_path 도 가능하지만,
// `.gitattributes` (eol / filter / lfs) 처리가 git CLI 가 정확함.

use crate::error::AppResult;
use crate::git::runner::{git_run, GitRunOpts};
use std::path::Path;

/// 단일 또는 다수 path 를 stage 추가.
pub async fn stage_paths(repo: &Path, paths: &[String]) -> AppResult<()> {
    if paths.is_empty() {
        return Ok(());
    }
    let mut args: Vec<&str> = vec!["add", "--"];
    for p in paths {
        args.push(p.as_str());
    }
    git_run(repo, &args, &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

/// 모든 변경사항 stage (`git add -A`).
pub async fn stage_all(repo: &Path) -> AppResult<()> {
    git_run(repo, &["add", "-A"], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

/// 단일 또는 다수 path 를 unstage (= reset HEAD --).
pub async fn unstage_paths(repo: &Path, paths: &[String]) -> AppResult<()> {
    if paths.is_empty() {
        return Ok(());
    }
    let mut args: Vec<&str> = vec!["reset", "HEAD", "--"];
    for p in paths {
        args.push(p.as_str());
    }
    git_run(repo, &args, &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

/// working tree 에서 변경 폐기 (= checkout --).
/// **주의**: 되돌릴 수 없는 작업. UI 에서 두 단계 confirm 필요.
pub async fn discard_paths(repo: &Path, paths: &[String]) -> AppResult<()> {
    if paths.is_empty() {
        return Ok(());
    }
    let mut args: Vec<&str> = vec!["checkout", "--"];
    for p in paths {
        args.push(p.as_str());
    }
    git_run(repo, &args, &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

/// 청크(hunk) 단위로 stage. 입력은 `git diff` 출력 형식의 patch 텍스트.
/// `git apply --cached --unidiff-zero=false` 사용.
pub async fn stage_patch(repo: &Path, patch: &str) -> AppResult<()> {
    let opts = GitRunOpts {
        stdin: Some(patch.to_string()),
        ..Default::default()
    };
    git_run(repo, &["apply", "--cached", "-"], &opts)
        .await?
        .into_ok()?;
    Ok(())
}

/// 청크(hunk) 단위로 unstage (== reverse apply with --cached).
pub async fn unstage_patch(repo: &Path, patch: &str) -> AppResult<()> {
    let opts = GitRunOpts {
        stdin: Some(patch.to_string()),
        ..Default::default()
    };
    git_run(repo, &["apply", "--cached", "--reverse", "-"], &opts)
        .await?
        .into_ok()?;
    Ok(())
}
