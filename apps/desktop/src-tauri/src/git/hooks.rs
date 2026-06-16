// Plan #42 M-1 (Sprint c99+) — Git Hooks manager
//
// .git/hooks/ 디렉토리 scan + 표준 hook 이름 별 존재/sample 여부 반환.
// core.hooksPath 설정 시 그 경로 사용 (config_local 결과를 caller 가 전달, 기본 .git/hooks).
//
// 본 모듈 = read-only scan. enable/disable / edit 은 별도 sprint (M-1 후속).

use crate::error::{AppError, AppResult};
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::fs::Metadata;
use std::path::{Path, PathBuf};

/// Plan #42 M-1 (Codex 8차 HIGH fix) — executable bit 판단.
/// Unix: mode & 0o111 (owner/group/other 중 하나라도 +x).
/// Windows: 권한 모델 다름 (.exe/.bat/.cmd 확장자 또는 ACL) — 보수적으로 true 반환.
#[cfg(unix)]
fn is_executable(metadata: Option<&Metadata>) -> bool {
    use std::os::unix::fs::PermissionsExt;
    metadata
        .map(|m| m.permissions().mode() & 0o111 != 0)
        .unwrap_or(false)
}

#[cfg(not(unix))]
fn is_executable(metadata: Option<&Metadata>) -> bool {
    // Windows 의 git for windows 는 sh script 를 ACL 기준 실행. file 존재만으로 충분.
    metadata.is_some()
}

/// Git 의 표준 hook 이름 — `man githooks`. 사용자 환경에 없는 hook 도 entry 반환 (exists=false).
pub const STANDARD_HOOK_NAMES: &[&str] = &[
    "applypatch-msg",
    "pre-applypatch",
    "post-applypatch",
    "pre-commit",
    "pre-merge-commit",
    "prepare-commit-msg",
    "commit-msg",
    "post-commit",
    "pre-rebase",
    "post-checkout",
    "post-merge",
    "pre-push",
    "pre-receive",
    "update",
    "proc-receive",
    "post-receive",
    "post-update",
    "reference-transaction",
    "push-to-checkout",
    "pre-auto-gc",
    "post-rewrite",
    "sendemail-validate",
    "fsmonitor-watchman",
    "p4-changelist",
    "p4-prepare-changelist",
    "p4-post-changelist",
    "p4-pre-submit",
    "post-index-change",
];

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HookEntry {
    /// hook 이름 (예: "pre-commit")
    pub name: String,
    /// 표준 hook 이름인지 (githooks 정의)
    pub standard: bool,
    /// 실제 실행 가능 hook 파일 존재 여부 (`.sample` 확장자 제외)
    pub exists: bool,
    /// `.sample` 파일 존재 여부 (git init 의 template — 활성화 안 됨)
    pub sample_exists: bool,
    /// hook 파일의 절대 경로 (exists=true 시)
    pub path: Option<PathBuf>,
    /// 파일 크기 (bytes, exists=true 시)
    pub size: Option<u64>,
    /// Plan #42 M-1 (Codex 8차 HIGH fix) — executable bit (Unix 0o111, Windows 항상 true).
    /// git 은 non-executable hook 을 ignore — `exists=true` + `executable=false` 시
    /// "파일 있으나 git 이 실행 안 함" 안내 필요.
    pub executable: bool,
}

/// Plan #42 M-1 후속 (Sprint c104) — `.sample` → active rename (활성화).
/// `<name>.sample` 파일이 존재해야 함. 실패 시 AppError.
pub async fn hook_activate_from_sample(
    repo_path: &Path,
    hooks_path_override: Option<&str>,
    name: &str,
) -> AppResult<()> {
    if name.trim().is_empty() {
        return Err(AppError::validation("hook name 비어있음"));
    }
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err(AppError::validation(
            "invalid hook name (path traversal 차단)",
        ));
    }
    let hooks_dir = resolve_hooks_dir(repo_path, hooks_path_override).await?;
    let sample_path = hooks_dir.join(format!("{name}.sample"));
    let active_path = hooks_dir.join(name);
    if !sample_path.exists() {
        return Err(AppError::validation(format!(
            "{}.sample 파일 없음 — 활성화 불가",
            name
        )));
    }
    if active_path.exists() {
        return Err(AppError::validation(format!(
            "{} 이미 활성 — 중복 활성화 거부",
            name
        )));
    }
    std::fs::rename(&sample_path, &active_path).map_err(|e| {
        AppError::internal(format!("rename {sample_path:?} -> {active_path:?}: {e}"))
    })?;
    // Unix executable bit 부여 (rename 후 권한 보존되지만 명시).
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = std::fs::metadata(&active_path) {
            let mut perms = metadata.permissions();
            perms.set_mode(perms.mode() | 0o755);
            let _ = std::fs::set_permissions(&active_path, perms);
        }
    }
    tracing::info!(
        target: "git_fried_lib::hooks",
        repo = %repo_path.display(),
        name,
        "hook_activate_from_sample 완료"
    );
    Ok(())
}

/// Plan #42 M-1 후속 (Sprint c104) — active → `.sample` rename (비활성화).
/// `<name>` 파일이 존재해야 함. `<name>.sample` 이미 존재 시 거부.
pub async fn hook_deactivate_to_sample(
    repo_path: &Path,
    hooks_path_override: Option<&str>,
    name: &str,
) -> AppResult<()> {
    if name.trim().is_empty() {
        return Err(AppError::validation("hook name 비어있음"));
    }
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err(AppError::validation(
            "invalid hook name (path traversal 차단)",
        ));
    }
    let hooks_dir = resolve_hooks_dir(repo_path, hooks_path_override).await?;
    let active_path = hooks_dir.join(name);
    let sample_path = hooks_dir.join(format!("{name}.sample"));
    if !active_path.exists() {
        return Err(AppError::validation(format!(
            "{} 활성 파일 없음 — 비활성화 불가",
            name
        )));
    }
    if sample_path.exists() {
        return Err(AppError::validation(format!(
            "{}.sample 이미 존재 — rename 충돌 거부",
            name
        )));
    }
    std::fs::rename(&active_path, &sample_path).map_err(|e| {
        AppError::internal(format!("rename {active_path:?} -> {sample_path:?}: {e}"))
    })?;
    tracing::info!(
        target: "git_fried_lib::hooks",
        repo = %repo_path.display(),
        name,
        "hook_deactivate_to_sample 완료"
    );
    Ok(())
}

/// hooks 디렉토리 해석 — **서버측 권위 해석** (plan #45 H, 경고+허용 정책).
///
/// SECURITY: renderer 가 넘긴 `hooks_path_override` 는 신뢰하지 않는다. 과거엔 override
/// 를 verbatim 사용해, compromised renderer(XSS)가 임의 절대경로를 넘기면 `list_git_hooks`
/// 가 임의 디렉토리의 파일 메타를 열거(정찰)할 수 있었다. 이제 git 이 직접 모든 config
/// level 의 `core.hooksPath` 를 resolve 한 결과(`git rev-parse --git-path hooks`)를 SoT 로
/// 쓴다. renderer override 가 서버 해석과 다르면 무시 + warn-log. 정당한 외부 core.hooksPath
/// (중앙 공유 hooks)는 git 이 resolve 하므로 그대로 동작한다(거부 아님 — 경고+허용).
async fn resolve_hooks_dir(
    repo_path: &Path,
    hooks_path_override: Option<&str>,
) -> AppResult<PathBuf> {
    // git 이 core.hooksPath(모든 config level)를 직접 resolve. 비-git / git 실패 시
    // `.git/hooks` 기본값으로 graceful fallback (repo 내부 + override 미사용 → 보안
    // 불변식 유지). renderer override 는 어떤 경우에도 해석에 쓰지 않는다.
    let default_dir = repo_path.join(".git").join("hooks");
    let resolved = match git_run(
        repo_path,
        &["rev-parse", "--git-path", "hooks"],
        &GitRunOpts::default(),
    )
    .await
    {
        Ok(out) if out.exit_code == Some(0) && !out.stdout.trim().is_empty() => {
            let p = PathBuf::from(out.stdout.trim());
            if p.is_absolute() {
                p
            } else {
                repo_path.join(p)
            }
        }
        _ => default_dir,
    };

    // renderer override cross-check — 서버 해석과 불일치 시 무시(warn). 신뢰 경계.
    if let Some(ov) = hooks_path_override.map(str::trim).filter(|s| !s.is_empty()) {
        let ov_abs = {
            let p = PathBuf::from(ov);
            if p.is_absolute() {
                p
            } else {
                repo_path.join(p)
            }
        };
        if ov_abs != resolved {
            tracing::warn!(
                target: "git_fried_lib::hooks",
                repo = %repo_path.display(),
                "hooks_path_override 가 실제 core.hooksPath 해석과 불일치 — override 무시 (renderer-supplied 임의 경로 차단)"
            );
        }
    }

    Ok(resolved)
}

/// 해석된 hooks 디렉토리가 repo working tree 밖인지 — UI 경고(경고+허용)용.
/// canonicalize 가능하면 그 기준, 아니면 경로 prefix 로 보수 판정.
pub fn hooks_dir_is_external(repo_path: &Path, hooks_dir: &Path) -> bool {
    match (hooks_dir.canonicalize(), repo_path.canonicalize()) {
        (Ok(hc), Ok(rc)) => !hc.starts_with(&rc),
        _ => !hooks_dir.starts_with(repo_path),
    }
}

/// `.git/hooks/` 또는 `core.hooksPath` 디렉토리 scan + 표준 hook 28개 + 추가 발견 hook 통합 반환.
pub async fn list_git_hooks(
    repo_path: &Path,
    hooks_path_override: Option<&str>,
) -> AppResult<Vec<HookEntry>> {
    let hooks_dir = resolve_hooks_dir(repo_path, hooks_path_override).await?;

    if hooks_dir_is_external(repo_path, &hooks_dir) {
        tracing::warn!(
            target: "git_fried_lib::hooks",
            repo = %repo_path.display(),
            hooks_dir = %hooks_dir.display(),
            "core.hooksPath 가 repo working tree 밖을 가리킴 — 외부 hooks 디렉토리 (경고+허용)"
        );
    }

    tracing::debug!(
        target: "git_fried_lib::hooks",
        repo = %repo_path.display(),
        hooks_dir = %hooks_dir.display(),
        "list_git_hooks 시작"
    );

    let mut entries: Vec<HookEntry> = STANDARD_HOOK_NAMES
        .iter()
        .map(|name| HookEntry {
            name: (*name).to_string(),
            standard: true,
            exists: false,
            sample_exists: false,
            path: None,
            size: None,
            executable: false,
        })
        .collect();

    if !hooks_dir.exists() {
        tracing::warn!(
            target: "git_fried_lib::hooks",
            repo = %repo_path.display(),
            hooks_dir = %hooks_dir.display(),
            "hooks 디렉토리 없음 — 모든 hook exists=false 반환"
        );
        return Ok(entries);
    }

    // 디렉토리 scan — 각 file 의 (name, .sample 여부, metadata) 수집
    let read_dir = match std::fs::read_dir(&hooks_dir) {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!(
                target: "git_fried_lib::hooks",
                repo = %repo_path.display(),
                hooks_dir = %hooks_dir.display(),
                error = %e,
                "hooks 디렉토리 read 실패"
            );
            return Ok(entries);
        }
    };

    let mut non_standard: Vec<HookEntry> = Vec::new();

    for ent in read_dir.flatten() {
        let path = ent.path();
        let file_name = match path.file_name().and_then(|s| s.to_str()) {
            Some(s) => s.to_string(),
            None => continue,
        };
        let metadata = ent.metadata().ok();
        // Codex 8차 MED — directory/symlink 도 entry 로 표시될 가능성. file 만 채택.
        if let Some(m) = metadata.as_ref() {
            if !m.is_file() {
                continue;
            }
        }
        let size = metadata.as_ref().map(|m| m.len());
        // Codex 8차 HIGH — executable bit (Unix 0o111). Windows 는 권한 모델 다름 — 항상 true 처리.
        let executable = is_executable(metadata.as_ref());
        let (base_name, is_sample) = if let Some(stripped) = file_name.strip_suffix(".sample") {
            (stripped.to_string(), true)
        } else {
            (file_name.clone(), false)
        };
        let is_standard = STANDARD_HOOK_NAMES.contains(&base_name.as_str());
        if is_standard {
            if let Some(entry) = entries.iter_mut().find(|e| e.name == base_name) {
                if is_sample {
                    entry.sample_exists = true;
                } else {
                    entry.exists = true;
                    entry.path = Some(path.clone());
                    entry.size = size;
                    entry.executable = executable;
                }
            }
        } else if !is_sample {
            // 표준 hook 외 (custom / lefthook 같은 wrapper) — 별도 추가
            non_standard.push(HookEntry {
                name: base_name,
                standard: false,
                exists: true,
                sample_exists: false,
                path: Some(path.clone()),
                size,
                executable,
            });
        }
    }

    entries.extend(non_standard);

    tracing::info!(
        target: "git_fried_lib::hooks",
        repo = %repo_path.display(),
        active = entries.iter().filter(|e| e.exists).count(),
        sample = entries.iter().filter(|e| e.sample_exists).count(),
        "list_git_hooks 완료"
    );

    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_list_hooks_empty_repo_returns_standard_entries() {
        let tmp = TempDir::new().unwrap();
        let repo = tmp.path();
        std::fs::create_dir_all(repo.join(".git").join("hooks")).unwrap();

        let result = list_git_hooks(repo, None).await.unwrap();
        assert!(result.len() >= STANDARD_HOOK_NAMES.len());
        assert!(result.iter().all(|e| !e.exists));
        assert!(result.iter().any(|e| e.name == "pre-commit"));
    }

    #[tokio::test]
    async fn test_list_hooks_sample_only_marks_sample_exists() {
        let tmp = TempDir::new().unwrap();
        let repo = tmp.path();
        let hooks = repo.join(".git").join("hooks");
        std::fs::create_dir_all(&hooks).unwrap();
        std::fs::write(hooks.join("pre-commit.sample"), "#!/bin/sh\n").unwrap();

        let result = list_git_hooks(repo, None).await.unwrap();
        let pre_commit = result.iter().find(|e| e.name == "pre-commit").unwrap();
        assert!(!pre_commit.exists);
        assert!(pre_commit.sample_exists);
    }

    #[tokio::test]
    async fn test_list_hooks_active_hook_marked_exists() {
        let tmp = TempDir::new().unwrap();
        let repo = tmp.path();
        let hooks = repo.join(".git").join("hooks");
        std::fs::create_dir_all(&hooks).unwrap();
        let hook_path = hooks.join("pre-commit");
        std::fs::write(&hook_path, "#!/bin/sh\nexit 0\n").unwrap();

        let result = list_git_hooks(repo, None).await.unwrap();
        let pre_commit = result.iter().find(|e| e.name == "pre-commit").unwrap();
        assert!(pre_commit.exists);
        assert!(pre_commit.size.unwrap() > 0);
        assert_eq!(pre_commit.path.as_ref().unwrap(), &hook_path);
    }

    #[tokio::test]
    async fn test_list_hooks_non_standard_appended() {
        let tmp = TempDir::new().unwrap();
        let repo = tmp.path();
        let hooks = repo.join(".git").join("hooks");
        std::fs::create_dir_all(&hooks).unwrap();
        std::fs::write(hooks.join("lefthook"), "#!/bin/sh\n").unwrap();

        let result = list_git_hooks(repo, None).await.unwrap();
        let lefthook = result.iter().find(|e| e.name == "lefthook").unwrap();
        assert!(lefthook.exists);
        assert!(!lefthook.standard);
    }

    #[tokio::test]
    async fn test_list_hooks_missing_dir_returns_empty_exists() {
        let tmp = TempDir::new().unwrap();
        let repo = tmp.path();
        // .git/hooks/ 생성 안 함

        let result = list_git_hooks(repo, None).await.unwrap();
        assert!(result.iter().all(|e| !e.exists));
        assert!(result.iter().all(|e| !e.sample_exists));
    }

    // plan #45 H — renderer 가 임의 hooks_path_override 를 줘도 서버는 그것을 신뢰하지
    // 않고 git 이 resolve 한 core.hooksPath(config)만 scan 함을 검증. (compromised
    // renderer 가 임의 디렉토리 메타를 열거하던 벡터 차단 — 경고+허용 정책.)
    #[tokio::test]
    async fn test_list_hooks_ignores_renderer_override_uses_config() {
        let repo_tmp = TempDir::new().unwrap();
        let repo = repo_tmp.path();
        git_run(repo, &["init", "-q", "-b", "main"], &GitRunOpts::default())
            .await
            .unwrap()
            .into_ok()
            .unwrap();

        // 정당한 외부 hooks 디렉토리 (config 로 지정) — pre-commit 보유.
        let cfg_tmp = TempDir::new().unwrap();
        let cfg_dir = cfg_tmp.path();
        std::fs::write(cfg_dir.join("pre-commit"), "#!/bin/sh\nexit 0\n").unwrap();
        git_run(
            repo,
            &["config", "core.hooksPath", cfg_dir.to_str().unwrap()],
            &GitRunOpts::default(),
        )
        .await
        .unwrap()
        .into_ok()
        .unwrap();

        // 공격자가 노리는 override 디렉토리 — pre-push 보유 (config 에는 없음).
        let evil_tmp = TempDir::new().unwrap();
        let evil_dir = evil_tmp.path();
        std::fs::write(evil_dir.join("pre-push"), "#!/bin/sh\nexit 0\n").unwrap();

        // renderer 가 evil override 를 줘도 → config(cfg_dir)의 pre-commit 만 보여야 함.
        let result = list_git_hooks(repo, Some(evil_dir.to_str().unwrap()))
            .await
            .unwrap();
        let pre_commit = result.iter().find(|e| e.name == "pre-commit").unwrap();
        assert!(
            pre_commit.exists,
            "config 의 core.hooksPath 가 honor 되어 pre-commit 발견되어야 함"
        );
        let pre_push = result.iter().find(|e| e.name == "pre-push").unwrap();
        assert!(
            !pre_push.exists,
            "공격자 override 디렉토리의 pre-push 는 무시되어야 함 (renderer override 불신)"
        );
    }
}
