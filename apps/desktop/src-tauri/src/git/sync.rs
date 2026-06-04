// Push / Pull / Fetch (네트워크 작업).
//
// 모두 git CLI shell-out — libgit2 는 인증 핸들링이 까다롭고 (SSH agent /
// credential manager 우회), 사용자 시스템 git 의 credential helper 를
// 그대로 활용하는 게 안전 + 일관.
//
// Sprint 2026-05-26 — HIGH-A 해소:
// remote / branch 는 IPC 입력 직접 → reject_dash_prefix + --end-of-options
// 양단 가드 (CWE-88). git 2.24+ `--end-of-options` 사용.

use crate::error::AppResult;
use crate::git::path::reject_dash_prefix;
use crate::git::runner::{git_run, GitOutput, GitRunOpts, GIT_NETWORK_TIMEOUT};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

impl From<GitOutput> for SyncResult {
    fn from(o: GitOutput) -> Self {
        Self {
            success: o.exit_code == Some(0),
            stdout: o.stdout,
            stderr: o.stderr,
            exit_code: o.exit_code,
        }
    }
}

/// `Option<&str>` SSH 키 → `GitRunOpts` 빌더.
///
/// Sprint 2026-05-26 — HIGH-F 해소: plan/43 의 SSH 키 binding 이
/// fetch/pull/push 시 GIT_SSH_COMMAND 에 적용되도록 wire.
fn opts_with_ssh(ssh_key_path: Option<&str>) -> GitRunOpts {
    GitRunOpts {
        ssh_key_path: ssh_key_path.map(String::from),
        // Codex review 2026-06-04 (F3) — network op 무제한 hang 방지. pull 은 repo_mutation_guard
        // 를 보유하므로 hang 시 같은 repo 의 모든 mutation 이 starvation. GIT_NETWORK_TIMEOUT(600s)
        // + git_run orphan-kill(F14) 연동으로 timeout 시 child kill → guard 해제.
        timeout: Some(GIT_NETWORK_TIMEOUT),
        ..GitRunOpts::default()
    }
}

/// 모든 remote 에서 fetch. `ssh_key_path` Some 시 GIT_SSH_COMMAND 적용.
pub async fn fetch_all(repo: &Path, ssh_key_path: Option<&str>) -> AppResult<SyncResult> {
    let started = std::time::Instant::now();
    tracing::debug!(target: "git_fried_lib::sync", repo = %repo.display(), ssh_key = ssh_key_path.is_some(), "fetch_all 시작");
    let out = git_run(
        repo,
        &["fetch", "--all", "--prune", "--tags"],
        &opts_with_ssh(ssh_key_path),
    )
    .await?;
    let elapsed_ms = started.elapsed().as_millis() as u64;
    if out.exit_code == Some(0) {
        tracing::info!(target: "git_fried_lib::sync", repo = %repo.display(), elapsed_ms, "fetch_all 완료");
    } else {
        tracing::warn!(target: "git_fried_lib::sync", repo = %repo.display(), elapsed_ms, exit_code = ?out.exit_code, "fetch_all 실패");
    }
    Ok(out.into())
}

/// 특정 remote 에서 fetch. `ssh_key_path` Some 시 GIT_SSH_COMMAND 적용.
pub async fn fetch(repo: &Path, remote: &str, ssh_key_path: Option<&str>) -> AppResult<SyncResult> {
    let remote = reject_dash_prefix(remote, "remote")?;
    let out = git_run(
        repo,
        &["fetch", "--prune", "--tags", "--end-of-options", remote],
        &opts_with_ssh(ssh_key_path),
    )
    .await?;
    Ok(out.into())
}

/// pull 전략 옵션 (Phase 12-3 — GitKraken Pull dropdown).
/// 모두 false → `git pull` (사용자 `pull.rebase` 설정 따름).
#[derive(Debug, Default, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PullOpts {
    /// `--rebase` (사용자 commits 재생성).
    pub rebase: bool,
    /// `--ff-only` (non-fast-forward 거부).
    pub ff_only: bool,
    /// `--no-rebase` (명시적 merge — pull.rebase=true 사용자 환경에서 강제 merge).
    pub no_rebase: bool,
}

/// pull (== fetch + merge | rebase). 디폴트는 사용자 `pull.rebase` 설정 따름.
/// `ssh_key_path` Some 시 GIT_SSH_COMMAND 적용.
pub async fn pull(
    repo: &Path,
    remote: Option<&str>,
    branch: Option<&str>,
    opts: PullOpts,
    ssh_key_path: Option<&str>,
) -> AppResult<SyncResult> {
    let started = std::time::Instant::now();
    let strategy = if opts.rebase {
        "rebase"
    } else if opts.ff_only {
        "ff_only"
    } else if opts.no_rebase {
        "no_rebase"
    } else {
        "default"
    };
    tracing::debug!(
        target: "git_fried_lib::sync",
        repo = %repo.display(),
        remote = ?remote,
        branch = ?branch,
        strategy,
        "pull 시작"
    );
    let mut args: Vec<&str> = vec!["pull"];
    // 옵션 mutually exclusive — rebase > ff_only > no_rebase 순.
    if opts.rebase {
        args.push("--rebase");
    } else if opts.ff_only {
        args.push("--ff-only");
    } else if opts.no_rebase {
        args.push("--no-rebase");
    }
    // Sprint 2026-05-26 HIGH-A — CWE-88 가드: positional 인자 분리 + dash prefix 거부.
    let remote_safe: Option<&str> = remote
        .map(|r| reject_dash_prefix(r, "remote"))
        .transpose()?;
    let branch_safe: Option<&str> = branch
        .map(|b| reject_dash_prefix(b, "branch"))
        .transpose()?;
    if let Some(r) = remote_safe {
        args.push("--end-of-options");
        args.push(r);
        if let Some(b) = branch_safe {
            args.push(b);
        }
    }
    let out = git_run(repo, &args, &opts_with_ssh(ssh_key_path)).await?;
    let elapsed_ms = started.elapsed().as_millis() as u64;
    if out.exit_code == Some(0) {
        tracing::info!(target: "git_fried_lib::sync", repo = %repo.display(), strategy, elapsed_ms, "pull 완료");
    } else {
        tracing::warn!(target: "git_fried_lib::sync", repo = %repo.display(), strategy, elapsed_ms, exit_code = ?out.exit_code, "pull 실패");
    }
    Ok(out.into())
}

/// push 옵션.
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PushOpts {
    /// `--force-with-lease` 사용 여부. 디폴트는 false (안전).
    pub force_with_lease: bool,
    /// `-u` 으로 upstream 설정.
    pub set_upstream: bool,
    /// `--tags` 도 같이.
    pub tags: bool,
}

pub async fn push(
    repo: &Path,
    remote: Option<&str>,
    branch: Option<&str>,
    opts: PushOpts,
    ssh_key_path: Option<&str>,
) -> AppResult<SyncResult> {
    let started = std::time::Instant::now();
    tracing::debug!(
        target: "git_fried_lib::sync",
        repo = %repo.display(),
        remote = ?remote,
        branch = ?branch,
        force_with_lease = opts.force_with_lease,
        set_upstream = opts.set_upstream,
        tags = opts.tags,
        "push 시작"
    );
    let mut args: Vec<&str> = vec!["push"];
    if opts.set_upstream {
        args.push("-u");
    }
    if opts.tags {
        args.push("--tags");
    }
    if opts.force_with_lease {
        args.push("--force-with-lease");
    }
    // Sprint 2026-05-26 HIGH-A — CWE-88 가드: positional 인자 분리 + dash prefix 거부.
    let remote_safe: Option<&str> = remote
        .map(|r| reject_dash_prefix(r, "remote"))
        .transpose()?;
    let branch_safe: Option<&str> = branch
        .map(|b| reject_dash_prefix(b, "branch"))
        .transpose()?;
    if let Some(r) = remote_safe {
        args.push("--end-of-options");
        args.push(r);
        if let Some(b) = branch_safe {
            args.push(b);
        }
    }
    let out = git_run(repo, &args, &opts_with_ssh(ssh_key_path)).await?;
    let elapsed_ms = started.elapsed().as_millis() as u64;
    if out.exit_code == Some(0) {
        tracing::info!(target: "git_fried_lib::sync", repo = %repo.display(), elapsed_ms, "push 완료");
    } else {
        tracing::warn!(target: "git_fried_lib::sync", repo = %repo.display(), elapsed_ms, exit_code = ?out.exit_code, "push 실패");
    }
    Ok(out.into())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Sprint 2026-05-26 — HIGH-A 회귀 가드 (sync.rs CWE-88).

    #[tokio::test]
    async fn fetch_rejects_dash_remote() {
        let result = fetch(Path::new("/tmp"), "--upload-pack=evil", None).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("remote"));
    }

    #[tokio::test]
    async fn pull_rejects_dash_remote() {
        let result = pull(
            Path::new("/tmp"),
            Some("--upload-pack=evil"),
            None,
            PullOpts::default(),
            None,
        )
        .await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("remote"));
    }

    #[tokio::test]
    async fn pull_rejects_dash_branch() {
        let result = pull(
            Path::new("/tmp"),
            Some("origin"),
            Some("--force"),
            PullOpts::default(),
            None,
        )
        .await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("branch"));
    }

    #[tokio::test]
    async fn push_rejects_dash_remote() {
        let result = push(
            Path::new("/tmp"),
            Some("-D"),
            None,
            PushOpts::default(),
            None,
        )
        .await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("remote"));
    }

    #[tokio::test]
    async fn push_rejects_dash_branch() {
        let result = push(
            Path::new("/tmp"),
            Some("origin"),
            Some("--force"),
            PushOpts::default(),
            None,
        )
        .await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("branch"));
    }

    // Sprint 2026-05-26 — HIGH-F 회귀 가드 (SSH 키 wire).
    #[test]
    fn opts_with_ssh_passes_through() {
        let opts = opts_with_ssh(Some("/home/me/.ssh/id_ed25519"));
        assert_eq!(
            opts.ssh_key_path.as_deref(),
            Some("/home/me/.ssh/id_ed25519")
        );
    }

    #[test]
    fn opts_with_ssh_none_is_default() {
        let opts = opts_with_ssh(None);
        assert!(opts.ssh_key_path.is_none());
    }
}
