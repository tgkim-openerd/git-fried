// Remote 관리 (`docs/plan/14 §4` Sprint B14-1: C1+C2+C3).
//
// list / add / remove / rename / set-url. 모두 git CLI shell-out — sync.rs 와
// 동일 정책 (인증 / credential helper / 한글 안전 spawn 통합).

use crate::error::AppResult;
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteInfo {
    pub name: String,
    pub fetch_url: Option<String>,
    pub push_url: Option<String>,
}

/// `git remote -v` 결과 파싱. 같은 remote 의 fetch / push URL 분리.
pub async fn list_remotes(repo: &Path) -> AppResult<Vec<RemoteInfo>> {
    let out = git_run(repo, &["remote", "-v"], &GitRunOpts::default()).await?;
    Ok(parse_remote_v(&out.stdout))
}

fn parse_remote_v(s: &str) -> Vec<RemoteInfo> {
    let mut by_name: std::collections::BTreeMap<String, (Option<String>, Option<String>)> =
        std::collections::BTreeMap::new();
    for line in s.lines() {
        // 형식: "<name>\t<url> (fetch|push)"
        let trimmed = line.trim_end();
        if trimmed.is_empty() {
            continue;
        }
        let mut parts = trimmed.splitn(2, '\t');
        let name = match parts.next() {
            Some(n) => n.trim().to_string(),
            None => continue,
        };
        let rest = match parts.next() {
            Some(r) => r,
            None => continue,
        };
        // rest = "<url> (fetch)" 또는 "<url> (push)"
        let (url, kind) = match rest.rfind(" (") {
            Some(i) => (rest[..i].trim().to_string(), &rest[i + 2..]),
            None => (rest.trim().to_string(), ""),
        };
        let entry = by_name.entry(name).or_insert((None, None));
        if kind.starts_with("fetch") {
            entry.0 = Some(url);
        } else if kind.starts_with("push") {
            entry.1 = Some(url);
        } else {
            // 형식 깨짐 — fetch 로 흡수
            if entry.0.is_none() {
                entry.0 = Some(url);
            }
        }
    }
    by_name
        .into_iter()
        .map(|(name, (fetch_url, push_url))| RemoteInfo {
            name,
            fetch_url,
            push_url,
        })
        .collect()
}

pub async fn add_remote(repo: &Path, name: &str, url: &str) -> AppResult<()> {
    git_run(repo, &["remote", "add", name, url], &GitRunOpts::default()).await?;
    Ok(())
}

pub async fn remove_remote(repo: &Path, name: &str) -> AppResult<()> {
    git_run(repo, &["remote", "remove", name], &GitRunOpts::default()).await?;
    Ok(())
}

pub async fn rename_remote(repo: &Path, old_name: &str, new_name: &str) -> AppResult<()> {
    git_run(
        repo,
        &["remote", "rename", old_name, new_name],
        &GitRunOpts::default(),
    )
    .await?;
    Ok(())
}

pub async fn set_remote_url(repo: &Path, name: &str, url: &str) -> AppResult<()> {
    git_run(
        repo,
        &["remote", "set-url", name, url],
        &GitRunOpts::default(),
    )
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_remote_v_combines_fetch_push() {
        let raw = "origin\thttps://example.com/a.git (fetch)\norigin\thttps://example.com/a.git (push)\nupstream\thttps://example.com/b.git (fetch)\nupstream\tssh://git@host/b.git (push)\n";
        let v = parse_remote_v(raw);
        assert_eq!(v.len(), 2);
        assert_eq!(v[0].name, "origin");
        assert_eq!(v[0].fetch_url.as_deref(), Some("https://example.com/a.git"));
        assert_eq!(v[0].push_url.as_deref(), Some("https://example.com/a.git"));
        assert_eq!(v[1].name, "upstream");
        assert_eq!(v[1].fetch_url.as_deref(), Some("https://example.com/b.git"));
        assert_eq!(v[1].push_url.as_deref(), Some("ssh://git@host/b.git"));
    }

    #[test]
    fn parse_remote_v_empty() {
        assert!(parse_remote_v("").is_empty());
        assert!(parse_remote_v("\n\n").is_empty());
    }

    #[test]
    fn parse_remote_v_handles_weird_format() {
        // 가짜 라인 (탭 없음)
        let v = parse_remote_v("origin only-this-token\n");
        assert!(v.is_empty(), "탭 없는 라인은 skip");
    }

    /// RemoteInfo serde — camelCase (fetchUrl / pushUrl).
    #[test]
    fn test_remote_info_serde() {
        let r = RemoteInfo {
            name: "origin".to_string(),
            fetch_url: Some("https://git.dev.opnd.io/openerd-web/한글레포.git".to_string()),
            push_url: Some("https://git.dev.opnd.io/openerd-web/한글레포.git".to_string()),
        };
        let json = serde_json::to_string(&r).unwrap();
        assert!(json.contains("\"fetchUrl\""));
        assert!(json.contains("\"pushUrl\""));
        assert!(!json.contains("fetch_url"));
        // 한글 path 그대로.
        assert!(json.contains("한글레포"));
    }
}
