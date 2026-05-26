// Remote 관리 (`docs/plan/14 §4` Sprint B14-1: C1+C2+C3).
//
// list / add / remove / rename / set-url. 모두 git CLI shell-out — sync.rs 와
// 동일 정책 (인증 / credential helper / 한글 안전 spawn 통합).

use crate::error::AppResult;
use crate::git::path::reject_dash_prefix;
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

/// Sprint 2026-05-26 R3 — Codex audit MED: URL protocol allowlist.
///
/// git remote URL 은 다양한 transport 지원 — 일부는 임의 명령 실행 위험:
/// - `ext::<cmd>` — arbitrary command execution (git-remote-ext)
/// - `local::<path>` — 로컬 path 의 임의 hook 실행
/// - `transport-helper::<name>` — 임의 helper binary 호출
///
/// 허용 protocol: `https://`, `http://`, `git://`, `ssh://`, `git@`(SCP-like), file 경로
/// (Windows drive 또는 POSIX `/`로 시작) — 정상 git 사용 모두 cover.
fn validate_remote_url(url: &str) -> AppResult<()> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err(crate::error::AppError::validation(
            "remote url 이 비었습니다.",
        ));
    }
    // 위험 protocol 명시 차단.
    let lower = trimmed.to_lowercase();
    let blocked_schemes = ["ext::", "local::", "transport-helper::"];
    for scheme in blocked_schemes {
        if lower.starts_with(scheme) {
            return Err(crate::error::AppError::validation(format!(
                "위험한 remote protocol: {scheme} — 허용 protocol (https/http/git/ssh/git@/file path) 사용",
            )));
        }
    }
    // 허용 protocol 화이트리스트.
    let is_known_scheme = lower.starts_with("https://")
        || lower.starts_with("http://")
        || lower.starts_with("git://")
        || lower.starts_with("ssh://")
        || lower.starts_with("git@") // scp-like (git@host:owner/repo.git)
        || lower.starts_with("file://")
        // 로컬 path 허용 (POSIX `/`, Windows `C:\` 또는 `C:/`).
        || trimmed.starts_with('/')
        || (trimmed.len() >= 3
            && trimmed.chars().nth(1) == Some(':')
            && matches!(trimmed.chars().nth(2), Some('/') | Some('\\')));
    if !is_known_scheme {
        return Err(crate::error::AppError::validation(format!(
            "알 수 없는 remote URL scheme: {trimmed} — https/http/git/ssh/git@host/file path 만 허용",
        )));
    }
    Ok(())
}

/// **보안**: name / url dash-prefix 거부 + protocol allowlist + `--end-of-options`.
/// CVE-2017-1000117 패턴 (`ssh://-oProxyCommand=...` URL) + git-remote-ext 차단.
pub async fn add_remote(repo: &Path, name: &str, url: &str) -> AppResult<()> {
    let safe_name = reject_dash_prefix(name, "remote name")?;
    let safe_url = reject_dash_prefix(url, "remote url")?;
    validate_remote_url(safe_url)?;
    git_run(
        repo,
        &["remote", "add", "--end-of-options", safe_name, safe_url],
        &GitRunOpts::default(),
    )
    .await?;
    Ok(())
}

pub async fn remove_remote(repo: &Path, name: &str) -> AppResult<()> {
    let safe = reject_dash_prefix(name, "remote name")?;
    git_run(
        repo,
        &["remote", "remove", "--end-of-options", safe],
        &GitRunOpts::default(),
    )
    .await?;
    Ok(())
}

pub async fn rename_remote(repo: &Path, old_name: &str, new_name: &str) -> AppResult<()> {
    let safe_old = reject_dash_prefix(old_name, "old remote name")?;
    let safe_new = reject_dash_prefix(new_name, "new remote name")?;
    git_run(
        repo,
        &["remote", "rename", "--end-of-options", safe_old, safe_new],
        &GitRunOpts::default(),
    )
    .await?;
    Ok(())
}

pub async fn set_remote_url(repo: &Path, name: &str, url: &str) -> AppResult<()> {
    let safe_name = reject_dash_prefix(name, "remote name")?;
    let safe_url = reject_dash_prefix(url, "remote url")?;
    validate_remote_url(safe_url)?;
    git_run(
        repo,
        &["remote", "set-url", "--end-of-options", safe_name, safe_url],
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
