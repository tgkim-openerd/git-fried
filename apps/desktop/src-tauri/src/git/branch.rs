// 브랜치 관리 — list / switch / create / delete / rename / set-upstream.
//
// list 는 git2-rs (빠름), 변경 작업은 git CLI (hooks / safety / 정확함).

use crate::error::{AppError, AppResult};
use crate::git::path::reject_dash_prefix;
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
                    let (a, b) = if let Some(up_oid) =
                        branch.upstream().ok().and_then(|b| b.get().target())
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
        let ka = (
            a.is_head,
            matches!(a.kind, BranchKindLite::Remote),
            a.name.clone(),
        );
        let kb = (
            b.is_head,
            matches!(b.kind, BranchKindLite::Remote),
            b.name.clone(),
        );
        // HEAD true 가 위 → reverse
        kb.0.cmp(&ka.0).then(ka.1.cmp(&kb.1)).then(ka.2.cmp(&kb.2))
    });
    Ok(out)
}

/// `git switch <name>` (또는 `-c` 로 새 브랜치 생성 후 전환).
///
/// **보안**: branch 이름이 `-` 로 시작하면 거부 + `--end-of-options` 로 추가 방어
/// (CWE-88 argument injection).
pub async fn switch_branch(path: &Path, name: &str, create: bool) -> AppResult<()> {
    let safe = reject_dash_prefix(name, "branch")?;
    let mut args: Vec<&str> = vec!["switch"];
    if create {
        args.push("-c");
    }
    args.push("--end-of-options");
    args.push(safe);
    git_run(path, &args, &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

/// 새 브랜치 생성 (전환 없이). `git branch <name> [<start_point>]`.
///
/// **보안**: branch / start_point 모두 dash-prefix 거부 + `--end-of-options`.
pub async fn create_branch(path: &Path, name: &str, start: Option<&str>) -> AppResult<()> {
    let safe_name = reject_dash_prefix(name, "branch")?;
    let safe_start = start
        .map(|s| reject_dash_prefix(s, "start_point"))
        .transpose()?;
    let mut args: Vec<&str> = vec!["branch", "--end-of-options", safe_name];
    if let Some(s) = safe_start {
        args.push(s);
    }
    git_run(path, &args, &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

/// 브랜치 삭제. force=false 면 머지 안 됐을 시 거부.
///
/// **보안**: branch name dash-prefix 거부 + `--end-of-options`.
pub async fn delete_branch(path: &Path, name: &str, force: bool) -> AppResult<()> {
    let safe = reject_dash_prefix(name, "branch")?;
    let flag = if force { "-D" } else { "-d" };
    git_run(
        path,
        &["branch", flag, "--end-of-options", safe],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;
    Ok(())
}

/// 브랜치 이름 변경.
///
/// **보안**: 양쪽 이름 dash-prefix 거부 + `--end-of-options`.
pub async fn rename_branch(path: &Path, old: &str, new: &str) -> AppResult<()> {
    let safe_old = reject_dash_prefix(old, "old branch")?;
    let safe_new = reject_dash_prefix(new, "new branch")?;
    git_run(
        path,
        &["branch", "-m", "--end-of-options", safe_old, safe_new],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;
    Ok(())
}

/// 머지 결과 (Sprint B8 — drag-drop branch onto branch).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeResult {
    pub success: bool,
    pub conflicted: bool,
    pub stdout: String,
    pub stderr: String,
}

/// `git merge <source>` (현재 HEAD 위에 source 머지). conflict 시 abort 안 함 —
/// 호출자가 결과 보고 처리.
pub async fn merge_into_head(
    path: &Path,
    source: &str,
    no_ff: bool,
    no_commit: bool,
) -> AppResult<MergeResult> {
    if source.trim().is_empty() {
        return Err(AppError::validation("source 비어있음"));
    }
    let started = std::time::Instant::now();
    tracing::debug!(
        target: "git_fried_lib::merge",
        repo = %path.display(),
        source,
        no_ff,
        no_commit,
        "merge_into_head 시작"
    );
    // 보안: source 가 `-` 로 시작하면 거부 (CWE-88) + `--end-of-options`.
    let safe_source = reject_dash_prefix(source, "source ref")?;
    let mut args: Vec<String> = vec!["merge".into()];
    if no_ff {
        args.push("--no-ff".into());
    }
    if no_commit {
        args.push("--no-commit".into());
    }
    args.push("--end-of-options".into());
    args.push(safe_source.into());
    let refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    let out = git_run(
        path,
        &refs,
        &GitRunOpts {
            envs: vec![("GIT_EDITOR".into(), "true".into())],
            ..Default::default()
        },
    )
    .await?;
    let conflicted = out.exit_code == Some(1)
        && (out.stdout.contains("CONFLICT") || out.stderr.contains("CONFLICT"));
    let elapsed_ms = started.elapsed().as_millis() as u64;
    if out.exit_code == Some(0) {
        tracing::info!(target: "git_fried_lib::merge", repo = %path.display(), source, elapsed_ms, "merge_into_head 완료");
    } else if conflicted {
        tracing::warn!(target: "git_fried_lib::merge", repo = %path.display(), source, elapsed_ms, "merge_into_head conflict — 호출자 처리");
    } else {
        tracing::warn!(target: "git_fried_lib::merge", repo = %path.display(), source, exit_code = ?out.exit_code, elapsed_ms, "merge_into_head 실패");
    }
    Ok(MergeResult {
        success: out.exit_code == Some(0),
        conflicted,
        stdout: out.stdout,
        stderr: out.stderr,
    })
}

/// `git rebase <upstream>` — onto 옵션 미사용, 단순 위에 rebase.
///
/// **보안**: upstream dash-prefix 거부 + `--end-of-options`.
pub async fn rebase_onto(path: &Path, upstream: &str) -> AppResult<MergeResult> {
    if upstream.trim().is_empty() {
        return Err(AppError::validation("upstream 비어있음"));
    }
    let safe_upstream = reject_dash_prefix(upstream, "upstream ref")?;
    let out = git_run(
        path,
        &["rebase", "--end-of-options", safe_upstream],
        &GitRunOpts {
            envs: vec![("GIT_EDITOR".into(), "true".into())],
            ..Default::default()
        },
    )
    .await?;
    let conflicted = out.exit_code != Some(0)
        && (out.stdout.contains("CONFLICT") || out.stderr.contains("CONFLICT"));
    Ok(MergeResult {
        success: out.exit_code == Some(0),
        conflicted,
        stdout: out.stdout,
        stderr: out.stderr,
    })
}

/// 단일 sha cherry-pick (Sprint B8 — drag-drop commit onto branch).
///
/// `target_branch` 가 None 이면 현재 HEAD 에 cherry-pick. 지정 시 그 브랜치로
/// switch 후 cherry-pick → 원래 브랜치로 복귀.
pub async fn cherry_pick_sha(
    path: &Path,
    sha: &str,
    target_branch: Option<&str>,
) -> AppResult<MergeResult> {
    if sha.trim().is_empty() {
        return Err(AppError::validation("sha 비어있음"));
    }
    // 보안: sha / target_branch 모두 dash-prefix 거부.
    let safe_sha = reject_dash_prefix(sha, "sha")?;
    let safe_target = target_branch
        .map(|tb| reject_dash_prefix(tb, "target branch"))
        .transpose()?;
    let restore: Option<String> = if let Some(tb) = safe_target {
        // 현재 HEAD 저장 후 target 으로 switch.
        let head = git_run(
            path,
            &["symbolic-ref", "--short", "HEAD"],
            &GitRunOpts::default(),
        )
        .await?
        .into_ok()
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
        git_run(
            path,
            &["switch", "--end-of-options", tb],
            &GitRunOpts::default(),
        )
        .await?
        .into_ok()?;
        head
    } else {
        None
    };

    let out = git_run(
        path,
        &["cherry-pick", "--end-of-options", safe_sha],
        &GitRunOpts {
            envs: vec![("GIT_EDITOR".into(), "true".into())],
            ..Default::default()
        },
    )
    .await?;
    let conflicted = out.exit_code != Some(0)
        && (out.stdout.contains("CONFLICT") || out.stderr.contains("CONFLICT"));
    let result = MergeResult {
        success: out.exit_code == Some(0),
        conflicted,
        stdout: out.stdout,
        stderr: out.stderr,
    };

    // target_branch 가 지정되었으면 원래 브랜치로 복귀.
    // conflict 발생 시에는 그대로 (사용자가 해결 또는 abort).
    if let Some(orig) = restore {
        if !result.conflicted {
            // orig 는 git 자체에서 받은 HEAD short-ref 라 dash-prefix 가능성 거의 없으나
            // defense-in-depth 로 `--end-of-options` 일관 적용.
            let _ = git_run(
                path,
                &["switch", "--end-of-options", &orig],
                &GitRunOpts::default(),
            )
            .await;
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// BranchKindLite serde — lowercase mapping (frontend 의 union 'local'|'remote' 와 일치).
    #[test]
    fn test_branch_kind_lite_serde_lowercase() {
        let local = serde_json::to_string(&BranchKindLite::Local).unwrap();
        let remote = serde_json::to_string(&BranchKindLite::Remote).unwrap();
        assert_eq!(local, "\"local\"");
        assert_eq!(remote, "\"remote\"");
    }

    /// BranchInfo serde — camelCase (lastCommitSha / lastCommitSubject).
    #[test]
    fn test_branch_info_serde_camel_case() {
        let b = BranchInfo {
            name: "main".to_string(),
            kind: BranchKindLite::Local,
            is_head: true,
            upstream: Some("origin/main".to_string()),
            last_commit_sha: Some("abc1234".to_string()),
            last_commit_subject: Some("feat: init".to_string()),
            ahead: 3,
            behind: 1,
        };
        let json = serde_json::to_string(&b).unwrap();
        assert!(json.contains("\"isHead\""));
        assert!(json.contains("\"lastCommitSha\""));
        assert!(json.contains("\"lastCommitSubject\""));
        assert!(!json.contains("is_head"));
        assert!(!json.contains("last_commit_sha"));
    }

    /// 한글 브랜치명 + upstream 직렬화 (한글 안전).
    #[test]
    fn test_branch_info_korean_name() {
        let b = BranchInfo {
            name: "feature/한글-브랜치".to_string(),
            kind: BranchKindLite::Local,
            is_head: false,
            upstream: Some("origin/feature/한글-브랜치".to_string()),
            last_commit_sha: None,
            last_commit_subject: Some("feat: 한글 커밋".to_string()),
            ahead: 0,
            behind: 0,
        };
        let json = serde_json::to_string(&b).unwrap();
        // 한글 그대로 — escape 없음.
        assert!(json.contains("한글-브랜치"));
        assert!(json.contains("한글 커밋"));
    }

    /// 빈 path 는 list_branches 가 git2 Git error 반환.
    #[test]
    fn test_list_branches_invalid_path() {
        let tmp = tempfile::TempDir::new().unwrap();
        // git init 안 한 빈 디렉토리.
        let res = list_branches(tmp.path());
        assert!(res.is_err());
    }
}
