// Tag 관리 (`docs/plan/14 §8 G1` Sprint C14).
//
// list / create (lightweight or annotated) / delete (local + remote) / push.
// 모두 git CLI shell-out — runner::git_run (한글 안전).
//
// Release (Forge API 기반) 는 별도 — ReleasesPanel + forge module. Tag 는 순수 git 객체.

use crate::error::{AppError, AppResult};
use crate::git::path::reject_dash_prefix;
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagInfo {
    /// short name (예: v0.3.0)
    pub name: String,
    /// 가리키는 commit SHA (annotated 면 dereferenced)
    pub commit_sha: Option<String>,
    /// annotated tag 면 tagger name, lightweight 면 None
    pub tagger_name: Option<String>,
    /// annotated tag 의 tagger date (unix). lightweight 면 None
    pub tagger_at: Option<i64>,
    /// tag 의 subject (annotated 의 첫 줄 / lightweight 면 commit subject)
    pub subject: Option<String>,
    /// annotated 여부 (tagger 정보 존재 = annotated)
    pub annotated: bool,
}

/// `git tag --list --format=...` → 파싱.
pub async fn list_tags(repo: &Path) -> AppResult<Vec<TagInfo>> {
    // %(refname:short) %(objectname) %(*objectname) %(taggername) %(taggerdate:unix) %(subject)
    // %(*objectname) = annotated tag 가 가리키는 commit (lightweight 면 빈 값)
    let fmt = "%(refname:short)\x1f%(objectname)\x1f%(*objectname)\x1f%(taggername)\x1f%(taggerdate:unix)\x1f%(subject)";
    let out = git_run(
        repo,
        &["tag", "--list", &format!("--format={fmt}")],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;

    let mut tags = Vec::new();
    for line in out.lines() {
        let parts: Vec<&str> = line.split('\x1f').collect();
        if parts.is_empty() || parts[0].is_empty() {
            continue;
        }
        let name = parts[0].to_string();
        let object_sha = parts.get(1).map(|s| s.trim()).unwrap_or("");
        let deref_sha = parts.get(2).map(|s| s.trim()).unwrap_or("");
        // annotated 면 deref_sha 가 commit, lightweight 면 object_sha 가 이미 commit
        let commit_sha = if !deref_sha.is_empty() {
            Some(deref_sha.to_string())
        } else if !object_sha.is_empty() {
            Some(object_sha.to_string())
        } else {
            None
        };
        let tagger_name = parts
            .get(3)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        let tagger_at = parts
            .get(4)
            .and_then(|s| s.trim().parse::<i64>().ok())
            .filter(|&n| n > 0);
        let subject = parts
            .get(5)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        let annotated = tagger_name.is_some();
        tags.push(TagInfo {
            name,
            commit_sha,
            tagger_name,
            tagger_at,
            subject,
            annotated,
        });
    }
    // 최신 순 정렬 (tagger_at desc, 없으면 name 역순)
    tags.sort_by(|a, b| match (a.tagger_at, b.tagger_at) {
        (Some(x), Some(y)) => y.cmp(&x),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => b.name.cmp(&a.name),
    });
    Ok(tags)
}

/// tag 생성. message=Some → annotated (`-a -m`), message=None → lightweight.
/// target=None → HEAD.
pub async fn create_tag(
    repo: &Path,
    name: &str,
    target: Option<&str>,
    message: Option<&str>,
) -> AppResult<()> {
    if name.trim().is_empty() {
        return Err(AppError::validation("tag 이름 비어있음"));
    }
    // 보안 (SEC-HIGH / CDX-005) — name/target argument injection 방어
    // (bisect.rs / branch.rs 와 동일 패턴: reject_dash_prefix + --end-of-options).
    let safe_name = reject_dash_prefix(name, "tag name")?;
    let safe_target = target
        .filter(|s| !s.trim().is_empty())
        .map(|t| reject_dash_prefix(t, "tag target"))
        .transpose()?;
    let mut args: Vec<&str> = vec!["tag"];
    if let Some(m) = message.filter(|s| !s.trim().is_empty()) {
        args.push("-a");
        args.push("-m");
        args.push(m);
    }
    args.push("--end-of-options");
    args.push(safe_name);
    if let Some(t) = safe_target {
        args.push(t);
    }
    git_run(repo, &args, &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

/// SB-033 (UltraPlan v0.4 sidebar microgap Sprint c95, 2026-05-18) — 기존 tag 를
/// annotated 로 upgrade (GitKraken parity S5: tag context menu "Annotate tag").
/// `git tag -af <name> <commit_sha> -m <msg>` — force replace, 동일 commit 위치 보존.
///
/// - lightweight → annotated: 첫 message 추가
/// - annotated → annotated: 기존 message 덮어쓰기
pub async fn annotate_existing_tag(
    repo: &Path,
    name: &str,
    commit_sha: &str,
    message: &str,
) -> AppResult<()> {
    if name.trim().is_empty() {
        return Err(AppError::validation("tag 이름 비어있음"));
    }
    if commit_sha.trim().is_empty() {
        return Err(AppError::validation("commit SHA 비어있음"));
    }
    if message.trim().is_empty() {
        return Err(AppError::validation("annotation message 비어있음"));
    }
    // 보안 (SEC-HIGH) — name/commit_sha argument injection 방어.
    let safe_name = reject_dash_prefix(name, "tag name")?;
    let safe_sha = reject_dash_prefix(commit_sha, "commit SHA")?;
    git_run(
        repo,
        &[
            "tag",
            "-af",
            "-m",
            message,
            "--end-of-options",
            safe_name,
            safe_sha,
        ],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;
    Ok(())
}

/// 로컬 tag 삭제. 원격은 별도 push_tag(--delete) 또는 delete_remote_tag.
///
/// Sprint 2026-05-26 R4 — Codex audit HIGH: name 가 IPC 입력 직접 → CWE-88 가드.
/// create_tag / annotate_existing_tag 는 이미 가드 적용 — destructive path 도 동등.
pub async fn delete_tag(repo: &Path, name: &str) -> AppResult<()> {
    let safe_name = reject_dash_prefix(name, "tag name")?;
    git_run(
        repo,
        &["tag", "-d", "--end-of-options", safe_name],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;
    Ok(())
}

/// `git push <remote> <name>` — 단일 tag push.
///
/// Sprint 2026-05-26 R4 — Codex audit HIGH: remote + name CWE-88 가드.
pub async fn push_tag(repo: &Path, remote: &str, name: &str) -> AppResult<()> {
    let safe_remote = reject_dash_prefix(remote, "remote")?;
    let safe_name = reject_dash_prefix(name, "tag name")?;
    git_run(
        repo,
        &[
            "push",
            "--end-of-options",
            safe_remote,
            &format!("refs/tags/{safe_name}"),
        ],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;
    Ok(())
}

/// `git push <remote> --delete <name>` — 원격 tag 삭제.
///
/// Sprint 2026-05-26 R4 — Codex audit HIGH: remote + name CWE-88 가드.
pub async fn delete_remote_tag(repo: &Path, remote: &str, name: &str) -> AppResult<()> {
    let safe_remote = reject_dash_prefix(remote, "remote")?;
    let safe_name = reject_dash_prefix(name, "tag name")?;
    git_run(
        repo,
        &[
            "push",
            "--delete",
            "--end-of-options",
            safe_remote,
            &format!("refs/tags/{safe_name}"),
        ],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;
    Ok(())
}
