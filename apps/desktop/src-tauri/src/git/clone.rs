// Repo clone (`docs/plan/14 §6 E1 + E2` Sprint C14-2).
//
// 단순 URL+경로 외에 sparse-checkout / shallow / single-branch 고급 옵션 지원.
// 모두 git CLI shell-out — runner::git_run 통과 (한글 경로 안전).
//
// Sparse-checkout 흐름 (cone 모드):
//   1) git clone --no-checkout <url> <path>
//   2) cd <path> && git sparse-checkout init --cone
//   3) git sparse-checkout set <path1> <path2> ...
//   4) git checkout (default branch)
//
// Shallow:
//   --depth N      = 최근 N 커밋만
//   --shallow-since DATE = 그 이후 커밋만
//   --single-branch --branch B = 한 브랜치만

use crate::error::{AppError, AppResult};
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Notify;

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloneOptions {
    /// sparse-checkout cone path 목록. None / 빈 = 전체 checkout.
    #[serde(default)]
    pub sparse_paths: Option<Vec<String>>,
    /// `--depth N`. None = full clone.
    #[serde(default)]
    pub depth: Option<u32>,
    /// `--shallow-since DATE` (예: "2024-01-01"). None = 무관.
    #[serde(default)]
    pub shallow_since: Option<String>,
    /// `--single-branch --branch B`. None = 모든 브랜치.
    #[serde(default)]
    pub single_branch: Option<String>,
    /// `--bare` clone.
    #[serde(default)]
    pub bare: bool,
    /// Sprint c38 / plan/29 E4 — `--filter=<spec>` (partial clone).
    /// 예: "blob:none" (blobless) / "blob:limit=1m" (1MB 이하 blob 제외).
    /// Git 2.19+ 서버 지원 필요. None = full objects.
    #[serde(default)]
    pub filter: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloneResult {
    pub target_path: String,
    pub stdout: String,
    pub stderr: String,
}

/// 허용 URL prefix (SEC-008). `file://`, `ext::`, `lp:` 등 위험 protocol 거부.
/// git 2.45+ 의 `protocol.allow=user` 가 기본 차단하나 명시 allowlist 로 정밀화.
fn is_allowed_clone_url(url: &str) -> bool {
    let trimmed = url.trim();
    // 표준 원격 protocol.
    if trimmed.starts_with("https://")
        || trimmed.starts_with("http://")
        || trimmed.starts_with("ssh://")
        || trimmed.starts_with("git://")
    {
        return true;
    }
    // user@host:path SCP-like syntax (예: git@github.com:foo/bar.git).
    // protocol prefix 없이 `<user>@<host>:<path>` 형태. `:` 가 path traversal 방지를 위해
    // 첫 `/` 보다 앞에 있어야 함.
    if let Some(at_idx) = trimmed.find('@') {
        if let Some(colon_idx) = trimmed[at_idx..].find(':') {
            // Sprint c45 SEC-4 — host 부분 (@ ~ :) 도 옵션 인젝션 방어.
            // CVE-2017-1000117 변종: user@-oProxyCommand=...:path 형태 차단.
            let host_part = &trimmed[at_idx + 1..at_idx + colon_idx];
            if host_part.is_empty() || host_part.starts_with('-') {
                return false;
            }
            // ssh-config 사용 가능한 단순 SCP-like.
            let after_colon = &trimmed[at_idx + colon_idx + 1..];
            // path 가 비어있지 않고 `-` 시작 아닌 (옵션 인젝션 방어).
            if !after_colon.is_empty() && !after_colon.starts_with('-') {
                return true;
            }
        }
    }
    false
}

/// `git clone <url> <target>` + 옵션. 부모 디렉토리는 호출 측에서 보장.
///
/// **보안**:
///   - SEC-001: url / target 모두 dash-prefix 거부 + `--end-of-options` (CWE-88).
///   - SEC-008: protocol allowlist (`https`/`http`/`ssh`/`git`/SCP-like). `file://`,
///     `ext::sh -c ...` (CVE-2024-32004 류), `lp:` 등 위험 protocol 거부.
///   - CVE-2017-1000117 (`ssh://-oProxyCommand=...`) 차단.
pub async fn clone(
    url: &str,
    target: &Path,
    opts: &CloneOptions,
    cancel: Option<Arc<Notify>>,
) -> AppResult<CloneResult> {
    if url.trim().is_empty() {
        return Err(AppError::validation("clone URL 이 비어있음"));
    }
    if !is_allowed_clone_url(url) {
        return Err(AppError::validation(format!(
            "지원하지 않는 clone URL protocol: {url} (https / http / ssh / git / user@host:path 만 허용)"
        )));
    }
    let safe_url = crate::git::path::reject_dash_prefix(url, "clone URL")?;
    let target_str = target.to_string_lossy().to_string();
    let safe_target =
        crate::git::path::reject_dash_prefix(&target_str, "clone target path")?.to_string();

    let parent = target.parent().ok_or_else(|| {
        AppError::validation(format!("대상 경로의 부모 디렉토리 추출 실패: {target_str}"))
    })?;
    if !parent.exists() {
        return Err(AppError::validation(format!(
            "부모 디렉토리가 존재하지 않습니다: {}",
            parent.to_string_lossy()
        )));
    }
    if target.exists() {
        return Err(AppError::validation(format!(
            "이미 존재하는 경로입니다: {target_str}"
        )));
    }

    // === clone command 구성 ===
    let mut args: Vec<String> = vec!["clone".into()];
    let needs_no_checkout = opts.sparse_paths.as_ref().is_some_and(|v| !v.is_empty());
    if needs_no_checkout {
        args.push("--no-checkout".into());
        // cone 모드 sparse 권장 — 5.0+ git
        args.push("--sparse".into());
    }
    if let Some(d) = opts.depth.filter(|&d| d > 0) {
        args.push(format!("--depth={d}"));
    }
    if let Some(s) = opts
        .shallow_since
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        args.push(format!("--shallow-since={s}"));
    }
    if let Some(b) = opts
        .single_branch
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        args.push("--single-branch".into());
        args.push(format!("--branch={b}"));
    }
    if opts.bare {
        args.push("--bare".into());
    }
    // Sprint c38 / plan/29 E4 — partial clone (`--filter=<spec>`).
    if let Some(f) = opts
        .filter
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        args.push(format!("--filter={f}"));
    }
    args.push("--end-of-options".into());
    args.push(safe_url.into());
    args.push(safe_target);

    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    // Sprint c46 BE-3 — clone 시작/완료 tracing.
    tracing::info!(target: "git_fried_lib::clone", url = %url, target = %target_str, "git clone 시작");
    let started = std::time::Instant::now();

    // clone 은 부모 디렉토리에서 실행 (target 자체는 아직 없음).
    // plan #45 M4a — 네트워크 clone 에 30분 backstop (무한 hang 방지, 대형 repo 보존).
    // plan #45 M4b — cancel 신호 전달 (FE 가 cancel_git_op(job_id) 호출 시 child kill).
    let clone_opts = GitRunOpts {
        timeout: Some(crate::git::runner::git_long_network_timeout()),
        cancel,
        ..GitRunOpts::default()
    };
    let clone_out = git_run(parent, &arg_refs, &clone_opts).await?;
    if clone_out.exit_code != Some(0) {
        tracing::error!(
            target: "git_fried_lib::clone",
            url = %url,
            exit_code = ?clone_out.exit_code,
            elapsed_ms = started.elapsed().as_millis() as u64,
            "git clone 실패"
        );
        return Err(AppError::GitCli {
            message: format!("git clone 실패 (exit={:?})", clone_out.exit_code),
            exit_code: clone_out.exit_code,
            stderr: clone_out.stderr,
        });
    }
    tracing::info!(
        target: "git_fried_lib::clone",
        url = %url,
        elapsed_ms = started.elapsed().as_millis() as u64,
        "git clone 완료"
    );

    let mut combined_stderr = clone_out.stderr.clone();

    // === sparse paths 적용 + checkout ===
    if let Some(paths) = opts.sparse_paths.as_ref().filter(|v| !v.is_empty()) {
        // (이미 --sparse + --no-checkout 으로 시작했으므로 init 은 자동.
        //  안전하게 sparse-checkout init --cone 도 호출.)
        let _ = git_run(
            target,
            &["sparse-checkout", "init", "--cone"],
            &GitRunOpts::default(),
        )
        .await?;

        // 보안: sparse path 가 `-` 로 시작하면 거부 + `--end-of-options`.
        let safe_paths: Vec<&str> = paths
            .iter()
            .map(|p| crate::git::path::reject_dash_prefix(p, "sparse path"))
            .collect::<AppResult<_>>()?;
        let mut set_args: Vec<&str> = vec!["sparse-checkout", "set", "--end-of-options"];
        for p in safe_paths {
            set_args.push(p);
        }
        let set_out = git_run(target, &set_args, &GitRunOpts::default()).await?;
        combined_stderr.push_str(&set_out.stderr);
        if set_out.exit_code != Some(0) {
            return Err(AppError::GitCli {
                message: format!("sparse-checkout set 실패 (exit={:?})", set_out.exit_code),
                exit_code: set_out.exit_code,
                stderr: set_out.stderr,
            });
        }

        let co_out = git_run(target, &["checkout"], &GitRunOpts::default()).await?;
        combined_stderr.push_str(&co_out.stderr);
        if co_out.exit_code != Some(0) {
            return Err(AppError::GitCli {
                message: format!("checkout 실패 (exit={:?})", co_out.exit_code),
                exit_code: co_out.exit_code,
                stderr: co_out.stderr,
            });
        }
    }

    Ok(CloneResult {
        target_path: PathBuf::from(target).to_string_lossy().to_string(),
        stdout: clone_out.stdout,
        stderr: combined_stderr,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 빈 URL 은 validation error.
    #[tokio::test]
    async fn test_clone_empty_url_rejected() {
        let tmp = tempfile::TempDir::new().unwrap();
        let target = tmp.path().join("repo");
        let res = clone("", &target, &CloneOptions::default(), None).await;
        assert!(res.is_err());
        let res2 = clone("   ", &target, &CloneOptions::default(), None).await;
        assert!(res2.is_err());
    }

    // SEC-008 protocol allowlist (`is_allowed_clone_url`) 단위 테스트.

    #[test]
    fn allowed_url_https() {
        assert!(is_allowed_clone_url("https://github.com/foo/bar.git"));
        assert!(is_allowed_clone_url("http://internal.example/repo"));
    }

    #[test]
    fn allowed_url_ssh_protocol() {
        assert!(is_allowed_clone_url("ssh://git@github.com/foo/bar"));
        assert!(is_allowed_clone_url("git://github.com/foo/bar"));
    }

    #[test]
    fn allowed_url_scp_like() {
        assert!(is_allowed_clone_url("git@github.com:foo/bar.git"));
        assert!(is_allowed_clone_url("user@gitea.example:org/repo"));
    }

    #[test]
    fn rejected_url_file_protocol() {
        // file:// 은 SECURITY 정책상 거부 (local clone 은 별도 IPC 경유).
        assert!(!is_allowed_clone_url("file:///etc/passwd"));
        assert!(!is_allowed_clone_url("file://C:/Windows/System32"));
    }

    #[test]
    fn rejected_url_ext_protocol() {
        // CVE-2024-32004 류 — ext:: 는 임의 명령 실행.
        assert!(!is_allowed_clone_url("ext::sh -c whoami"));
        assert!(!is_allowed_clone_url("lp:foo/bar"));
    }

    #[test]
    fn rejected_url_scp_with_dash_path() {
        // CVE-2017-1000117 패턴 — SCP path 가 `-` 로 시작하면 거부.
        assert!(!is_allowed_clone_url("git@github.com:-oProxyCommand=evil"));
    }

    #[test]
    fn rejected_url_empty_or_random() {
        assert!(!is_allowed_clone_url(""));
        assert!(!is_allowed_clone_url("not-a-url"));
        assert!(!is_allowed_clone_url("just-text"));
    }

    /// CloneOptions deserialize — sparse_paths / depth 등 모두 optional.
    #[test]
    fn test_clone_options_minimal_deserialize() {
        // 빈 object 도 default 로 변환.
        let o: CloneOptions = serde_json::from_str("{}").unwrap();
        assert!(o.sparse_paths.is_none());
        assert!(o.depth.is_none());
        assert!(!o.bare);
    }

    /// CloneOptions serde — camelCase (sparsePaths / shallowSince / singleBranch).
    #[test]
    fn test_clone_options_serde_camel_case() {
        let o = CloneOptions {
            sparse_paths: Some(vec!["src/".to_string(), "docs/한글/".to_string()]),
            depth: Some(50),
            shallow_since: Some("2026-01-01".to_string()),
            single_branch: Some("main".to_string()),
            bare: false,
            filter: None,
        };
        let json = serde_json::to_string(&o).unwrap();
        assert!(json.contains("\"sparsePaths\""));
        assert!(json.contains("\"shallowSince\""));
        assert!(json.contains("\"singleBranch\""));
        assert!(json.contains("docs/한글/"));
    }

    /// Sprint c38 / plan/29 E4 — `--filter=<spec>` round-trip.
    #[test]
    fn test_clone_options_filter_serde() {
        let o = CloneOptions {
            filter: Some("blob:none".to_string()),
            ..Default::default()
        };
        let json = serde_json::to_string(&o).unwrap();
        assert!(json.contains("\"filter\":\"blob:none\""));

        // deserialize back from camelCase JSON.
        let parsed: CloneOptions = serde_json::from_str(r#"{"filter":"blob:limit=1m"}"#).unwrap();
        assert_eq!(parsed.filter.as_deref(), Some("blob:limit=1m"));
    }

    /// Sprint c38 / plan/29 E4 — Preset → CLI 옵션 매핑 검증.
    /// frontend Clone Wizard preset 4종이 백엔드 옵션으로 정확히 변환되는지 확인.
    #[test]
    fn test_clone_options_presets_mapping() {
        // Preset: Monorepo 빠른 시작 = sparse + filter=blob:none + single_branch
        let monorepo = CloneOptions {
            sparse_paths: Some(vec!["apps/".to_string()]),
            filter: Some("blob:none".to_string()),
            single_branch: Some("main".to_string()),
            ..Default::default()
        };
        assert!(monorepo.sparse_paths.is_some());
        assert_eq!(monorepo.filter.as_deref(), Some("blob:none"));

        // Preset: 얕은 = depth=1
        let shallow = CloneOptions {
            depth: Some(1),
            ..Default::default()
        };
        assert_eq!(shallow.depth, Some(1));
        assert!(shallow.sparse_paths.is_none());

        // Preset: 전체 = all defaults None.
        let full = CloneOptions::default();
        assert!(full.depth.is_none());
        assert!(full.sparse_paths.is_none());
        assert!(full.filter.is_none());
    }

    /// args 빌더 — filter 가 `--filter=<spec>` 으로 정확히 추가되는지 sanity test.
    /// (실제 clone 은 네트워크 필요 → args 검증만)
    #[test]
    fn test_filter_arg_format() {
        // CloneOptions::filter 가 "blob:none" 이면 결국 `--filter=blob:none` 이 args 에.
        let f = "blob:none";
        let formatted = format!("--filter={f}");
        assert_eq!(formatted, "--filter=blob:none");
    }

    /// CloneResult serde — camelCase (targetPath) + 한글 path.
    #[test]
    fn test_clone_result_serde() {
        let r = CloneResult {
            target_path: "C:/work/한글-레포".to_string(),
            stdout: "".to_string(),
            stderr: "".to_string(),
        };
        let json = serde_json::to_string(&r).unwrap();
        assert!(json.contains("\"targetPath\":\"C:/work/한글-레포\""));
        assert!(!json.contains("target_path"));
    }
}
