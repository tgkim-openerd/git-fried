// 레포 read 작업 (git2-rs / libgit2).
//
// 작은 / 빈도 높은 호출 (status, log, branch list, refs) 만 처리.
// clone / fetch / push / blame / interactive rebase 같은 heavy 작업은
// runner.rs 의 git_run() 사용.

use crate::error::{AppError, AppResult};
use git2::{ObjectType, Oid, Repository, Sort};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitSummary {
    pub sha: String,
    pub short_sha: String,
    pub parent_shas: Vec<String>,
    pub author_name: String,
    pub author_email: String,
    pub author_at: i64,
    pub committer_at: i64,
    pub subject: String,
    pub body: String,
    pub signed: bool,
    pub refs: Vec<String>,
}

/// 주어진 경로에서 레포 메타 정보 추출 (이름 / 기본 브랜치 / remote URL).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoMeta {
    pub name: String,
    pub default_branch: Option<String>,
    pub default_remote: Option<String>,
    pub remote_url: Option<String>,
    pub forge_kind: ForgeKindLite,
    pub forge_owner: Option<String>,
    pub forge_repo: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ForgeKindLite {
    Gitea,
    Github,
    Unknown,
}

/// 로컬 경로의 git 레포 열기. bare 레포 / submodule 도 가능.
pub fn open(path: &Path) -> AppResult<Repository> {
    Repository::open(path).map_err(AppError::Git)
}

/// HEAD 부터 최대 `limit` 개의 커밋 요약을 시간 역순으로 반환.
pub fn log(repo: &Repository, limit: usize, skip: usize) -> AppResult<Vec<CommitSummary>> {
    let mut walker = repo.revwalk().map_err(AppError::Git)?;
    walker.set_sorting(Sort::TIME).map_err(AppError::Git)?;
    walker.push_head().map_err(AppError::Git)?;

    // 참조(tag/branch) 매핑 — sha → label 리스트
    let refs_map = collect_refs_map(repo).unwrap_or_default();

    let mut out = Vec::with_capacity(limit);
    for (i, oid) in walker.enumerate() {
        if i < skip {
            continue;
        }
        if out.len() >= limit {
            break;
        }
        let oid = oid.map_err(AppError::Git)?;
        let commit = repo.find_commit(oid).map_err(AppError::Git)?;
        let author = commit.author();
        let committer = commit.committer();
        let message = commit.message().unwrap_or("");
        let (subject, body) = split_subject_body(message);

        let sha = oid.to_string();
        let refs = refs_map.get(&sha).cloned().unwrap_or_default();
        let parent_shas = (0..commit.parent_count())
            .map(|i| commit.parent_id(i).map(|x| x.to_string()).unwrap_or_default())
            .collect();
        let signed = commit.header_field_bytes("gpgsig").map(|b| !b.is_empty()).unwrap_or(false);

        out.push(CommitSummary {
            short_sha: sha.chars().take(7).collect(),
            sha,
            parent_shas,
            author_name: author.name().unwrap_or("").to_string(),
            author_email: author.email().unwrap_or("").to_string(),
            author_at: author.when().seconds(),
            committer_at: committer.when().seconds(),
            subject,
            body,
            signed,
            refs,
        });
    }
    Ok(out)
}

fn split_subject_body(msg: &str) -> (String, String) {
    let trimmed = msg.trim_end();
    if let Some(idx) = trimmed.find('\n') {
        let subject = trimmed[..idx].trim().to_string();
        let body = trimmed[idx..].trim_start_matches('\n').trim().to_string();
        (subject, body)
    } else {
        (trimmed.to_string(), String::new())
    }
}

fn collect_refs_map(
    repo: &Repository,
) -> AppResult<std::collections::HashMap<String, Vec<String>>> {
    use std::collections::HashMap;
    let mut map: HashMap<String, Vec<String>> = HashMap::new();
    for r in repo.references().map_err(AppError::Git)? {
        let r = match r {
            Ok(r) => r,
            Err(_) => continue,
        };
        let name = match r.shorthand() {
            Some(s) => s.to_string(),
            None => continue,
        };
        let oid: Option<Oid> = r
            .target()
            .or_else(|| r.peel(ObjectType::Commit).ok().map(|o| o.id()));
        if let Some(oid) = oid {
            map.entry(oid.to_string()).or_default().push(name);
        }
    }
    Ok(map)
}

/// 레포 디렉토리에서 메타데이터 추출.
pub fn detect_meta(path: &Path) -> AppResult<RepoMeta> {
    let repo = open(path)?;
    let name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("repo")
        .to_string();

    let default_branch = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()));

    let mut default_remote: Option<String> = None;
    let mut remote_url: Option<String> = None;
    if let Ok(remotes) = repo.remotes() {
        for r in remotes.iter().flatten() {
            if r == "origin" {
                default_remote = Some(r.to_string());
            }
            if let Ok(remote) = repo.find_remote(r) {
                if let Some(url) = remote.url() {
                    if r == "origin" || remote_url.is_none() {
                        remote_url = Some(url.to_string());
                    }
                }
            }
        }
    }

    let (forge_kind, forge_owner, forge_repo) = parse_forge(remote_url.as_deref());

    Ok(RepoMeta {
        name,
        default_branch,
        default_remote,
        remote_url,
        forge_kind,
        forge_owner,
        forge_repo,
    })
}

/// remote URL 에서 forge 종류 / owner / repo 추출.
///
/// 지원:
///   - github.com → Github
///   - git.dev.opnd.io 등 사용자 Gitea 인스턴스 → Gitea (URL 패턴 휴리스틱)
///   - 그 외 → Unknown
pub fn parse_forge(url: Option<&str>) -> (ForgeKindLite, Option<String>, Option<String>) {
    let url = match url {
        Some(u) => u,
        None => return (ForgeKindLite::Unknown, None, None),
    };
    // ssh: git@host:owner/repo.git / https: https://host/owner/repo.git
    let cleaned = url
        .trim_end_matches('/')
        .trim_end_matches(".git")
        .replace("git@", "")
        .replace("https://", "")
        .replace("http://", "")
        .replace("ssh://", "");
    // host[:port]/owner/repo OR host:owner/repo
    let parts: Vec<&str> = cleaned
        .split(['/', ':'])
        .filter(|s| !s.is_empty())
        .collect();
    if parts.len() < 3 {
        return (ForgeKindLite::Unknown, None, None);
    }
    let host = parts[0].to_lowercase();
    let owner = parts[parts.len() - 2].to_string();
    let repo = parts[parts.len() - 1].to_string();
    let kind = if host.contains("github.com") {
        ForgeKindLite::Github
    } else if host.contains("gitea") || host.contains("git.dev.opnd.io") || host.contains("opnd") {
        ForgeKindLite::Gitea
    } else {
        ForgeKindLite::Unknown
    };
    (kind, Some(owner), Some(repo))
}
