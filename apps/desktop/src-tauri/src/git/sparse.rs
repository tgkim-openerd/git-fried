// Plan #42 M-2 (Sprint c100+) — Sparse Checkout repo manager
//
// clone-time sparse-checkout 은 clone.rs 에서 처리. 본 모듈 = clone 이후 ongoing
// 변경 (list / set / init / disable / reapply / add).
//
// git 의 sparse-checkout cone mode 우선 (cone 외 광범위 패턴은 git 공식 권고 X).

use crate::error::{AppError, AppResult};
use crate::git::path::reject_dash_prefix;
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SparseStatus {
    /// sparse-checkout 활성 여부 (`.git/info/sparse-checkout` 존재 OR `core.sparseCheckout=true`).
    pub enabled: bool,
    /// cone mode 인지 (`core.sparseCheckoutCone=true`).
    pub cone: bool,
    /// 활성 sparse paths (cone mode 시 디렉토리 단위, list mode 시 패턴).
    pub paths: Vec<String>,
}

/// `git sparse-checkout list` + config 조회.
pub async fn sparse_status(repo_path: &Path) -> AppResult<SparseStatus> {
    tracing::debug!(
        target: "git_fried_lib::sparse",
        repo = %repo_path.display(),
        "sparse_status 시작"
    );

    // 1. core.sparseCheckout / core.sparseCheckoutCone 조회 (실패 = false)
    let enabled_out = git_run(
        repo_path,
        &["config", "--get", "core.sparseCheckout"],
        &GitRunOpts::default(),
    )
    .await
    .ok();
    let enabled = enabled_out
        .as_ref()
        .map(|o| o.stdout.trim() == "true")
        .unwrap_or(false);

    let cone_out = git_run(
        repo_path,
        &["config", "--get", "core.sparseCheckoutCone"],
        &GitRunOpts::default(),
    )
    .await
    .ok();
    let cone = cone_out
        .as_ref()
        .map(|o| o.stdout.trim() == "true")
        .unwrap_or(false);

    // 2. git sparse-checkout list — 비활성 또는 미설정 시 stdout 비어있음
    let list_out = git_run(
        repo_path,
        &["sparse-checkout", "list"],
        &GitRunOpts::default(),
    )
    .await
    .ok();
    let paths: Vec<String> = list_out
        .as_ref()
        .map(|o| {
            o.stdout
                .lines()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default();

    tracing::info!(
        target: "git_fried_lib::sparse",
        repo = %repo_path.display(),
        enabled,
        cone,
        path_count = paths.len(),
        "sparse_status 완료"
    );

    Ok(SparseStatus {
        enabled,
        cone,
        paths,
    })
}

/// `git sparse-checkout init --cone` — sparse-checkout 활성 + cone mode.
pub async fn sparse_init_cone(repo_path: &Path) -> AppResult<()> {
    let out = git_run(
        repo_path,
        &["sparse-checkout", "init", "--cone"],
        &GitRunOpts::default(),
    )
    .await?;
    if out.exit_code == Some(0) {
        tracing::info!(
            target: "git_fried_lib::sparse",
            repo = %repo_path.display(),
            "sparse_init_cone 완료"
        );
        Ok(())
    } else {
        Err(AppError::internal(format!(
            "sparse-checkout init --cone failed: {}",
            out.stderr
        )))
    }
}

/// `git sparse-checkout set <path1> <path2> ...` — cone mode 의 path 적용.
/// 빈 paths 는 거부 (사용자 의도 명시 — disable 별도 호출).
pub async fn sparse_set(repo_path: &Path, paths: &[String]) -> AppResult<()> {
    if paths.is_empty() {
        return Err(AppError::validation(
            "sparse paths 가 비어있음 — disable 사용",
        ));
    }
    // 보안: 각 path 가 `-` 로 시작 거부 (CWE-88).
    let safe_paths: Vec<&str> = paths
        .iter()
        .map(|s| reject_dash_prefix(s, "sparse path"))
        .collect::<AppResult<Vec<_>>>()?;
    let mut args: Vec<&str> = vec!["sparse-checkout", "set", "--end-of-options"];
    args.extend(safe_paths.iter().copied());
    let out = git_run(repo_path, &args, &GitRunOpts::default()).await?;
    if out.exit_code == Some(0) {
        tracing::info!(
            target: "git_fried_lib::sparse",
            repo = %repo_path.display(),
            path_count = paths.len(),
            "sparse_set 완료"
        );
        Ok(())
    } else {
        Err(AppError::internal(format!(
            "sparse-checkout set failed: {}",
            out.stderr
        )))
    }
}

/// `git sparse-checkout disable` — sparse-checkout 비활성 (전체 working tree 복원).
pub async fn sparse_disable(repo_path: &Path) -> AppResult<()> {
    let out = git_run(
        repo_path,
        &["sparse-checkout", "disable"],
        &GitRunOpts::default(),
    )
    .await?;
    if out.exit_code == Some(0) {
        tracing::info!(
            target: "git_fried_lib::sparse",
            repo = %repo_path.display(),
            "sparse_disable 완료"
        );
        Ok(())
    } else {
        Err(AppError::internal(format!(
            "sparse-checkout disable failed: {}",
            out.stderr
        )))
    }
}

/// `git sparse-checkout reapply` — 현재 sparse 설정 재적용 (HEAD 변경 후 재동기).
pub async fn sparse_reapply(repo_path: &Path) -> AppResult<()> {
    let out = git_run(
        repo_path,
        &["sparse-checkout", "reapply"],
        &GitRunOpts::default(),
    )
    .await?;
    if out.exit_code == Some(0) {
        tracing::info!(
            target: "git_fried_lib::sparse",
            repo = %repo_path.display(),
            "sparse_reapply 완료"
        );
        Ok(())
    } else {
        Err(AppError::internal(format!(
            "sparse-checkout reapply failed: {}",
            out.stderr
        )))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use tokio::process::Command;

    async fn make_test_repo() -> TempDir {
        let tmp = TempDir::new().unwrap();
        Command::new("git")
            .args(["init", "--quiet"])
            .current_dir(tmp.path())
            .status()
            .await
            .unwrap();
        Command::new("git")
            .args(["config", "user.email", "test@example.com"])
            .current_dir(tmp.path())
            .status()
            .await
            .unwrap();
        Command::new("git")
            .args(["config", "user.name", "Test"])
            .current_dir(tmp.path())
            .status()
            .await
            .unwrap();
        // 디렉토리 + 파일 생성
        std::fs::create_dir_all(tmp.path().join("src")).unwrap();
        std::fs::write(tmp.path().join("src/main.rs"), "fn main() {}").unwrap();
        std::fs::create_dir_all(tmp.path().join("docs")).unwrap();
        std::fs::write(tmp.path().join("docs/readme.md"), "docs").unwrap();
        Command::new("git")
            .args(["add", "."])
            .current_dir(tmp.path())
            .status()
            .await
            .unwrap();
        Command::new("git")
            .args(["commit", "-m", "init", "--quiet"])
            .current_dir(tmp.path())
            .status()
            .await
            .unwrap();
        tmp
    }

    #[tokio::test]
    async fn test_sparse_status_default_disabled() {
        let tmp = make_test_repo().await;
        let s = sparse_status(tmp.path()).await.unwrap();
        assert!(!s.enabled);
        assert!(s.paths.is_empty());
    }

    #[tokio::test]
    async fn test_sparse_init_cone_then_set() {
        let tmp = make_test_repo().await;
        sparse_init_cone(tmp.path()).await.unwrap();
        sparse_set(tmp.path(), &["src".to_string()]).await.unwrap();
        let s = sparse_status(tmp.path()).await.unwrap();
        assert!(s.enabled);
        assert!(s.cone);
        assert!(s.paths.iter().any(|p| p == "src"));
    }

    #[tokio::test]
    async fn test_sparse_disable_after_set() {
        let tmp = make_test_repo().await;
        sparse_init_cone(tmp.path()).await.unwrap();
        sparse_set(tmp.path(), &["docs".to_string()]).await.unwrap();
        sparse_disable(tmp.path()).await.unwrap();
        let s = sparse_status(tmp.path()).await.unwrap();
        assert!(!s.enabled);
    }

    #[tokio::test]
    async fn test_sparse_set_rejects_empty_paths() {
        let tmp = make_test_repo().await;
        sparse_init_cone(tmp.path()).await.unwrap();
        let result = sparse_set(tmp.path(), &[]).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_sparse_set_rejects_dash_prefix() {
        let tmp = make_test_repo().await;
        sparse_init_cone(tmp.path()).await.unwrap();
        let result = sparse_set(tmp.path(), &["-rf".to_string()]).await;
        assert!(result.is_err());
    }
}
