// 스테이징 작업 (add / reset / restore).
//
// git CLI shell-out 사용 — libgit2 의 index_add_path 도 가능하지만,
// `.gitattributes` (eol / filter / lfs) 처리가 git CLI 가 정확함.

use crate::error::AppResult;
use crate::git::path::validate_repo_relative_path;
use crate::git::runner::{git_run, GitRunOpts};
use std::path::Path;

/// Sprint 2026-06-04 (/analyze F11/F16) — stage/unstage/discard path 정책 통일.
///
/// read_file.rs / merge.rs 와 동일하게 `validate_repo_relative_path` 4단 가드 적용
/// (empty / `..` traversal / 절대경로 / 루트 접두 + 존재 시 canonicalize prefix 확인).
/// `--` 구분자가 이미 옵션 인젝션을 막지만, defense-in-depth 로 repo 외부 경로를
/// git CLI 에 넘기기 전에 차단한다. 반환 absolute path 는 버리고 검증만 수행.
fn validate_paths(repo: &Path, paths: &[String]) -> AppResult<()> {
    for p in paths {
        validate_repo_relative_path(repo, p)?;
    }
    Ok(())
}

/// 단일 또는 다수 path 를 stage 추가.
pub async fn stage_paths(repo: &Path, paths: &[String]) -> AppResult<()> {
    if paths.is_empty() {
        return Ok(());
    }
    validate_paths(repo, paths)?;
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
    validate_paths(repo, paths)?;
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
    validate_paths(repo, paths)?;
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

/// Sprint c38 / plan/29 E1 후속 — hunk 단위 워킹트리 복원 (= discard hunk).
///
/// `git apply --reverse` (캐시 미사용) — 인덱스는 건드리지 않고 워킹트리만
/// patch 되돌리기. `unstage_patch` 와의 차이: cached 플래그 없음 → 워킹트리에 적용.
///
/// 사용 시나리오: HunkStageModal staged=false 모드에서 특정 hunk 를 워킹트리에서
/// 완전히 제거 (= 변경 폐기). 인덱스에 stage 된 다른 hunk 는 보존됨.
pub async fn restore_worktree_patch(repo: &Path, patch: &str) -> AppResult<()> {
    let opts = GitRunOpts {
        stdin: Some(patch.to_string()),
        ..Default::default()
    };
    git_run(repo, &["apply", "--reverse", "-"], &opts)
        .await?
        .into_ok()?;
    Ok(())
}
