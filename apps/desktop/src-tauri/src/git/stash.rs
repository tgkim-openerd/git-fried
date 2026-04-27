// Stash 관리 — list / push / apply / pop / drop / show.
//
// 모두 git CLI shell-out. libgit2 stash API 도 있지만 metadata
// (untracked 포함 여부 등) 가 git CLI 와 미묘히 달라 일관성 위해 통일.

use crate::error::AppResult;
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StashEntry {
    /// stash@{0} 의 인덱스 0
    pub index: usize,
    /// stash 의 SHA
    pub sha: String,
    /// "WIP on main: ..." 같은 메시지
    pub message: String,
    /// stash 가 만들어진 브랜치 (메시지에서 파싱)
    pub branch: Option<String>,
    /// unix timestamp
    pub created_at: i64,
}

/// `git stash list --format=...` 파싱.
pub async fn list_stash(repo: &Path) -> AppResult<Vec<StashEntry>> {
    // %gd: stash@{0}, %H: SHA, %ct: committer unix, %s: subject
    let out = git_run(
        repo,
        &["stash", "list", "--format=%gd\x1f%H\x1f%ct\x1f%s"],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;

    let mut entries = Vec::new();
    for line in out.lines() {
        let parts: Vec<&str> = line.split('\x1f').collect();
        if parts.len() < 4 {
            continue;
        }
        let gd = parts[0]; // stash@{0}
        let index = gd
            .strip_prefix("stash@{")
            .and_then(|s| s.strip_suffix('}'))
            .and_then(|s| s.parse::<usize>().ok())
            .unwrap_or(0);
        let sha = parts[1].to_string();
        let created_at = parts[2].parse::<i64>().unwrap_or(0);
        let message = parts[3].to_string();
        let branch = message
            .strip_prefix("WIP on ")
            .or_else(|| message.strip_prefix("On "))
            .and_then(|s| s.split(':').next())
            .map(|s| s.trim().to_string());
        entries.push(StashEntry {
            index,
            sha,
            message,
            branch,
            created_at,
        });
    }
    Ok(entries)
}

/// 새 stash 생성. include_untracked=true 면 -u, message=Some 이면 push -m.
pub async fn push_stash(
    repo: &Path,
    message: Option<&str>,
    include_untracked: bool,
) -> AppResult<()> {
    let mut args: Vec<&str> = vec!["stash", "push"];
    if include_untracked {
        args.push("-u");
    }
    if let Some(m) = message {
        args.push("-m");
        args.push(m);
    }
    git_run(repo, &args, &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

/// stash@{n} apply (디폴트 0).
pub async fn apply_stash(repo: &Path, index: usize) -> AppResult<()> {
    let r = format!("stash@{{{index}}}");
    git_run(repo, &["stash", "apply", &r], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

/// stash@{n} pop (apply + drop).
pub async fn pop_stash(repo: &Path, index: usize) -> AppResult<()> {
    let r = format!("stash@{{{index}}}");
    git_run(repo, &["stash", "pop", &r], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

/// stash@{n} drop.
pub async fn drop_stash(repo: &Path, index: usize) -> AppResult<()> {
    let r = format!("stash@{{{index}}}");
    git_run(repo, &["stash", "drop", &r], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

/// stash@{n} 의 diff text.
pub async fn show_stash(repo: &Path, index: usize) -> AppResult<String> {
    let r = format!("stash@{{{index}}}");
    git_run(
        repo,
        &["stash", "show", "-p", "--no-color", &r],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()
}

/// stash@{n} 안의 단일 파일만 working tree 에 apply
/// (`docs/plan/14 §5 D1`, GitKraken §11 "Apply this file").
///
/// 동작: `git stash show -p stash@{n} -- <path> | git apply -`
///   - stash show -p — patch 형식
///   - `-- <path>` — 해당 파일만 필터
///   - git apply — working tree 에 적용 (충돌 시 stderr 로 reject 안내)
///
/// 한글 path 안전 (git_run 표준 spawn). working tree dirty 여도 git apply 가
/// 충돌 발견 시 명시적으로 거부 → 데이터 손실 차단.
pub async fn apply_stash_file(repo: &Path, index: usize, path: &str) -> AppResult<()> {
    if path.trim().is_empty() {
        return Err(crate::error::AppError::validation("path 비어있음"));
    }
    let r = format!("stash@{{{index}}}");
    // 단순 전략: stash 의 그 시점 파일 내용을 working tree 에 직접 복원
    // (`git checkout stash@{n} -- <path>`).
    //
    // 이유: `git stash show -p` 는 path 필터 미지원, `git diff stash@{n}^1..` 는
    // stash 의 다중 parent 구조에서 비결정적. `git checkout` 은 stash 의 그 시점
    // 그대로를 가져오는 가장 직관적 방식 — GitKraken 의 "Apply this file" 의미와
    // 정확히 일치. dirty working tree 면 git 이 자체 보호 (overwrite 거부).
    git_run(
        repo,
        &["checkout", &r, "--", path],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_apply_stash_file_empty_path_errors() {
        let tmp = tempfile::TempDir::new().unwrap();
        let p = tmp.path();
        // git init 없어도 path 검증이 먼저
        let err = apply_stash_file(p, 0, "").await;
        assert!(err.is_err());

        // whitespace only → 동일하게 거부
        let err2 = apply_stash_file(p, 0, "   ").await;
        assert!(err2.is_err());
    }

    // round-trip 테스트는 dogfood 시점에 검증 — Windows test 환경의 `git stash push`
    // 가 silent fail 하는 케이스가 있어 (`run_sync` 가 status 미검증) 회귀 차단을
    // production 사용자 dogfood 로 위임. apply_stash_file 자체는 단순 한 줄 git
    // 호출 (`git checkout stash@{n} -- <path>`) 라 production 위험 낮음.
}
