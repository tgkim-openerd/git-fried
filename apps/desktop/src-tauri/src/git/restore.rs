// `git restore` 의미론 wrapper — Sprint c38 / plan/29 E1 (Restore Center).
//
// 기존 `stage::discard_paths` (= `git checkout --`) 는 워킹트리 폐기만 처리.
// 본 모듈은 `git restore` 의 3개 축 (--worktree / --staged / --source) 을
// 명시적으로 노출 → 사용자가 "되돌리는 대상" 과 "원본" 을 분리 인지 가능.
//
// 분리된 의미론:
//   1. WT discard         : --worktree              (default source = index)
//   2. Unstage             : --staged                (default source = HEAD)
//   3. Both from HEAD      : --staged --worktree --source=HEAD
//   4. From commit         : --staged --worktree --source=<sha>  (또는 worktree-only)
//
// 한글 경로 안전: git_run 표준 spawn (core.quotepath=false + UTF-8 강제).

use crate::error::{AppError, AppResult};
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// `git restore` 옵션 조합. 4개 분리 의미론을 단일 struct 로 표현.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreOpts {
    /// `--worktree` — working tree 만 복원.
    pub worktree: bool,
    /// `--staged` — index 만 복원 (= unstage).
    pub staged: bool,
    /// `--source=<rev>` — 원본 커밋. None 이면 git 기본값 (worktree=index, staged=HEAD).
    pub source: Option<String>,
}

impl RestoreOpts {
    pub fn worktree_only() -> Self {
        Self {
            worktree: true,
            staged: false,
            source: None,
        }
    }
    pub fn staged_only() -> Self {
        Self {
            worktree: false,
            staged: true,
            source: None,
        }
    }
    pub fn both_from_head() -> Self {
        Self {
            worktree: true,
            staged: true,
            source: Some("HEAD".to_string()),
        }
    }
    pub fn both_from_source<S: Into<String>>(source: S) -> Self {
        Self {
            worktree: true,
            staged: true,
            source: Some(source.into()),
        }
    }
}

/// 1개 이상 path 를 `git restore` 의미론으로 복원.
///
/// `paths` 비어있으면 즉시 Ok (no-op). `--worktree` 와 `--staged` 둘 다 false 면
/// validation error — "복원 대상 미선택" 으로 거부.
pub async fn restore_paths(repo: &Path, paths: &[String], opts: &RestoreOpts) -> AppResult<()> {
    if paths.is_empty() {
        return Ok(());
    }
    if !opts.worktree && !opts.staged {
        return Err(AppError::validation(
            "restore: --worktree / --staged 중 최소 하나는 true 여야 합니다.",
        ));
    }
    let started = std::time::Instant::now();
    tracing::debug!(
        target: "git_fried_lib::restore",
        repo = %repo.display(),
        path_count = paths.len(),
        worktree = opts.worktree,
        staged = opts.staged,
        has_source = opts.source.is_some(),
        "restore_paths 시작"
    );

    // args 빌드 — `git restore [--worktree] [--staged] [--source=<rev>] -- <paths...>`.
    // 동적 String 을 args 에 섞어야 하므로 Vec<String> 으로 빌드.
    let mut args: Vec<String> = vec!["restore".to_string()];
    if opts.worktree {
        args.push("--worktree".to_string());
    }
    if opts.staged {
        args.push("--staged".to_string());
    }
    if let Some(src) = opts.source.as_ref() {
        let trimmed = src.trim();
        if trimmed.is_empty() {
            return Err(AppError::validation("restore: source 값이 비었습니다."));
        }
        args.push(format!("--source={trimmed}"));
    }
    args.push("--".to_string());
    for p in paths {
        args.push(p.clone());
    }

    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let result = git_run(repo, &arg_refs, &GitRunOpts::default())
        .await?
        .into_ok();
    let elapsed_ms = started.elapsed().as_millis() as u64;
    match &result {
        Ok(_) => {
            tracing::info!(target: "git_fried_lib::restore", repo = %repo.display(), path_count = paths.len(), elapsed_ms, "restore_paths 완료")
        }
        Err(e) => {
            tracing::warn!(target: "git_fried_lib::restore", repo = %repo.display(), path_count = paths.len(), elapsed_ms, error = %e, "restore_paths 실패")
        }
    }
    result?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// RestoreOpts serde — camelCase 필드 + None source 처리.
    #[test]
    fn test_restore_opts_serde_camel_case() {
        let o = RestoreOpts {
            worktree: true,
            staged: true,
            source: Some("HEAD~3".to_string()),
        };
        let json = serde_json::to_string(&o).unwrap();
        assert!(json.contains("\"worktree\":true"));
        assert!(json.contains("\"staged\":true"));
        assert!(json.contains("\"source\":\"HEAD~3\""));
    }

    /// builder 4종 — 의미론별 필드 검증.
    #[test]
    fn test_restore_opts_builders() {
        let wt = RestoreOpts::worktree_only();
        assert!(wt.worktree && !wt.staged && wt.source.is_none());

        let st = RestoreOpts::staged_only();
        assert!(!st.worktree && st.staged && st.source.is_none());

        let both = RestoreOpts::both_from_head();
        assert!(both.worktree && both.staged);
        assert_eq!(both.source.as_deref(), Some("HEAD"));

        let from = RestoreOpts::both_from_source("abc1234");
        assert_eq!(from.source.as_deref(), Some("abc1234"));
    }

    /// 빈 paths → no-op (Ok 즉시 반환). git 호출 자체 안 됨.
    #[tokio::test]
    async fn test_restore_paths_empty_is_noop() {
        let tmp = tempfile::TempDir::new().unwrap();
        let result = restore_paths(tmp.path(), &[], &RestoreOpts::worktree_only()).await;
        assert!(result.is_ok());
    }

    /// worktree=false + staged=false → validation 에러 (대상 미선택).
    #[tokio::test]
    async fn test_restore_paths_no_target_errors() {
        let tmp = tempfile::TempDir::new().unwrap();
        let opts = RestoreOpts {
            worktree: false,
            staged: false,
            source: None,
        };
        let err = restore_paths(tmp.path(), &["a.txt".to_string()], &opts)
            .await
            .unwrap_err();
        assert_eq!(err.kind(), "validation");
    }

    /// source 가 whitespace-only → validation 에러.
    #[tokio::test]
    async fn test_restore_paths_whitespace_source_errors() {
        let tmp = tempfile::TempDir::new().unwrap();
        let opts = RestoreOpts {
            worktree: true,
            staged: false,
            source: Some("   ".to_string()),
        };
        let err = restore_paths(tmp.path(), &["a.txt".to_string()], &opts)
            .await
            .unwrap_err();
        assert_eq!(err.kind(), "validation");
    }

    /// 한글 경로 round-trip — 실제 git restore 호출까지 검증.
    /// 시나리오: init → 한글 파일 commit → 수정 → restore --worktree → 원복 확인.
    #[tokio::test]
    async fn test_restore_paths_korean_filename_round_trip() {
        use std::fs;
        let tmp = tempfile::TempDir::new().unwrap();
        let path = tmp.path();

        // init + identity
        git_run(path, &["init", "-q", "-b", "main"], &GitRunOpts::default())
            .await
            .unwrap()
            .into_ok()
            .unwrap();
        git_run(
            path,
            &["config", "user.name", "테스트사용자"],
            &GitRunOpts::default(),
        )
        .await
        .unwrap()
        .into_ok()
        .unwrap();
        git_run(
            path,
            &["config", "user.email", "test@example.com"],
            &GitRunOpts::default(),
        )
        .await
        .unwrap()
        .into_ok()
        .unwrap();
        // 글로벌 commit.gpgsign=true 환경에서 테스트가 깨지지 않도록 강제 OFF.
        git_run(
            path,
            &["config", "commit.gpgsign", "false"],
            &GitRunOpts::default(),
        )
        .await
        .unwrap()
        .into_ok()
        .unwrap();

        // 한글 파일명 + 한글 내용 commit
        let kfile = path.join("한글파일.txt");
        fs::write(&kfile, "원본 내용\n").unwrap();
        git_run(path, &["add", "한글파일.txt"], &GitRunOpts::default())
            .await
            .unwrap()
            .into_ok()
            .unwrap();
        crate::git::runner::commit_with_message(path, "feat: 한글 파일 추가")
            .await
            .unwrap()
            .into_ok()
            .unwrap();

        // 수정 (워킹트리 dirty)
        fs::write(&kfile, "수정된 내용\n").unwrap();
        let after_modify = fs::read_to_string(&kfile).unwrap();
        assert_eq!(after_modify, "수정된 내용\n");

        // restore --worktree → index (= HEAD) 기준 워킹트리 복원
        restore_paths(
            path,
            &["한글파일.txt".to_string()],
            &RestoreOpts::worktree_only(),
        )
        .await
        .unwrap();

        let after_restore = fs::read_to_string(&kfile).unwrap();
        assert_eq!(
            after_restore, "원본 내용\n",
            "restore 후 원본으로 복원되어야 함"
        );
    }
}
