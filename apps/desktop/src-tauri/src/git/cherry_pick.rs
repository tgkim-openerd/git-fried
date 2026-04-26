// Cherry-pick 단일 / 다중 sha + 다중 레포 동시 적용.
//
// `docs/plan/02 §3 W3` 의 sync-template 패턴 — 회사 핵심 운영 워크플로우.
// 27.template_work-dir → N개 회사 레포로 cherry-pick 전파.

use crate::error::AppResult;
use crate::git::runner::{git_run, GitRunOpts};
use crate::storage::{Db, DbExt};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CherryPickStrategy {
    /// 머지 그대로 (`-m` 미사용).
    Default,
    /// 머지 commit 의 parent index 1 (mainline) 사용.
    MainlineParent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CherryPickResult {
    pub repo_id: i64,
    pub repo_name: String,
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub conflicted: bool,
}

/// 단일 sha 를 N개 레포에 동시 cherry-pick (병렬).
pub async fn bulk_cherry_pick(
    db: &Db,
    repo_ids: &[i64],
    sha: &str,
    strategy: CherryPickStrategy,
    no_commit: bool,
) -> AppResult<Vec<CherryPickResult>> {
    let mut handles = Vec::with_capacity(repo_ids.len());
    for id in repo_ids {
        let r = match db.get_repo(*id).await {
            Ok(r) => r,
            Err(_) => continue,
        };
        let path = PathBuf::from(r.local_path);
        let id = r.id;
        let name = r.name;
        let sha = sha.to_string();
        handles.push(tokio::spawn(async move {
            cherry_pick_one(&path, &sha, strategy, no_commit, id, name).await
        }));
    }

    let mut out = Vec::with_capacity(handles.len());
    for h in handles {
        match h.await {
            Ok(r) => out.push(r),
            Err(e) => out.push(CherryPickResult {
                repo_id: -1,
                repo_name: format!("(join error)"),
                success: false,
                stdout: String::new(),
                stderr: e.to_string(),
                conflicted: false,
            }),
        }
    }
    Ok(out)
}

async fn cherry_pick_one(
    path: &Path,
    sha: &str,
    strategy: CherryPickStrategy,
    no_commit: bool,
    repo_id: i64,
    repo_name: String,
) -> CherryPickResult {
    let mut args: Vec<String> = vec!["cherry-pick".into()];
    match strategy {
        CherryPickStrategy::Default => {}
        CherryPickStrategy::MainlineParent => {
            args.push("-m".into());
            args.push("1".into());
        }
    }
    if no_commit {
        args.push("-n".into());
    }
    args.push(sha.to_string());

    let argr: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let out = match git_run(path, &argr, &GitRunOpts::default()).await {
        Ok(o) => o,
        Err(e) => {
            return CherryPickResult {
                repo_id,
                repo_name,
                success: false,
                stdout: String::new(),
                stderr: e.to_string(),
                conflicted: false,
            }
        }
    };

    let conflicted = out.stderr.contains("CONFLICT") || out.stderr.contains("conflict");
    CherryPickResult {
        repo_id,
        repo_name,
        success: out.exit_code == Some(0),
        stdout: out.stdout,
        stderr: out.stderr,
        conflicted,
    }
}
