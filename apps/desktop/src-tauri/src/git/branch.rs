// 브랜치 관리 — list / switch / create / delete / rename / set-upstream.
//
// list 는 git2-rs (빠름), 변경 작업은 git CLI (hooks / safety / 정확함).

use crate::error::{AppError, AppResult};
use crate::git::runner::{git_run, GitRunOpts};
use git2::{BranchType, Repository};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchInfo {
    pub name: String,
    pub kind: BranchKindLite, // local | remote
    pub is_head: bool,
    pub upstream: Option<String>,
    pub last_commit_sha: Option<String>,
    pub last_commit_subject: Option<String>,
    pub ahead: usize,
    pub behind: usize,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BranchKindLite {
    Local,
    Remote,
}

pub fn list_branches(path: &Path) -> AppResult<Vec<BranchInfo>> {
    let repo = Repository::open(path).map_err(AppError::Git)?;
    let head_ref = repo
        .head()
        .ok()
        .and_then(|r| r.shorthand().map(|s| s.to_string()));

    let mut out = Vec::new();
    for kind in &[BranchType::Local, BranchType::Remote] {
        for entry in repo.branches(Some(*kind)).map_err(AppError::Git)? {
            let (branch, _) = match entry {
                Ok(x) => x,
                Err(_) => continue,
            };
            let name = match branch.name().ok().flatten() {
                Some(n) => n.to_string(),
                None => continue,
            };
            let target = branch.get().target();
            let upstream = branch
                .upstream()
                .ok()
                .and_then(|b| b.name().ok().flatten().map(|s| s.to_string()));

            let (subject, ahead, behind) = match target {
                Some(oid) => {
                    let subj = repo
                        .find_commit(oid)
                        .ok()
                        .and_then(|c| c.summary().map(|s| s.to_string()));
                    let (a, b) = if let Some(up_oid) = branch
                        .upstream()
                        .ok()
                        .and_then(|b| b.get().target())
                    {
                        repo.graph_ahead_behind(oid, up_oid).unwrap_or((0, 0))
                    } else {
                        (0, 0)
                    };
                    (subj, a, b)
                }
                None => (None, 0, 0),
            };

            out.push(BranchInfo {
                kind: match kind {
                    BranchType::Local => BranchKindLite::Local,
                    BranchType::Remote => BranchKindLite::Remote,
                },
                is_head: head_ref.as_deref() == Some(name.as_str()) && *kind == BranchType::Local,
                last_commit_sha: target.map(|o| o.to_string()),
                last_commit_subject: subject,
                upstream,
                ahead,
                behind,
                name,
            });
        }
    }

    // 정렬: HEAD → local → remote, 알파벳
    out.sort_by(|a, b| {
        let ka = (a.is_head, matches!(a.kind, BranchKindLite::Remote), a.name.clone());
        let kb = (b.is_head, matches!(b.kind, BranchKindLite::Remote), b.name.clone());
        // HEAD true 가 위 → reverse
        kb.0.cmp(&ka.0)
            .then(ka.1.cmp(&kb.1))
            .then(ka.2.cmp(&kb.2))
    });
    Ok(out)
}

/// `git switch <name>` (또는 `-c` 로 새 브랜치 생성 후 전환).
pub async fn switch_branch(path: &Path, name: &str, create: bool) -> AppResult<()> {
    let mut args: Vec<&str> = vec!["switch"];
    if create {
        args.push("-c");
    }
    args.push(name);
    git_run(path, &args, &GitRunOpts::default()).await?.into_ok()?;
    Ok(())
}

/// 새 브랜치 생성 (전환 없이). `git branch <name> [<start_point>]`.
pub async fn create_branch(path: &Path, name: &str, start: Option<&str>) -> AppResult<()> {
    let mut args: Vec<&str> = vec!["branch", name];
    if let Some(s) = start {
        args.push(s);
    }
    git_run(path, &args, &GitRunOpts::default()).await?.into_ok()?;
    Ok(())
}

/// 브랜치 삭제. force=false 면 머지 안 됐을 시 거부.
pub async fn delete_branch(path: &Path, name: &str, force: bool) -> AppResult<()> {
    let flag = if force { "-D" } else { "-d" };
    git_run(path, &["branch", flag, name], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

/// 브랜치 이름 변경.
pub async fn rename_branch(path: &Path, old: &str, new: &str) -> AppResult<()> {
    git_run(path, &["branch", "-m", old, new], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}
