// Plan #42 M-1 (Sprint c99+) — Git Hooks manager
//
// .git/hooks/ 디렉토리 scan + 표준 hook 이름 별 존재/sample 여부 반환.
// core.hooksPath 설정 시 그 경로 사용 (config_local 결과를 caller 가 전달, 기본 .git/hooks).
//
// 본 모듈 = read-only scan. enable/disable / edit 은 별도 sprint (M-1 후속).

use crate::error::AppResult;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

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
}

/// `.git/hooks/` 또는 `core.hooksPath` 디렉토리 scan + 표준 hook 28개 + 추가 발견 hook 통합 반환.
pub async fn list_git_hooks(
    repo_path: &Path,
    hooks_path_override: Option<&str>,
) -> AppResult<Vec<HookEntry>> {
    let hooks_dir = match hooks_path_override {
        Some(p) if !p.trim().is_empty() => {
            // override 가 relative 면 repo root 기준
            let pb = PathBuf::from(p);
            if pb.is_absolute() {
                pb
            } else {
                repo_path.join(pb)
            }
        }
        _ => repo_path.join(".git").join("hooks"),
    };

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
        let size = metadata.as_ref().map(|m| m.len());
        let (base_name, is_sample) = if let Some(stripped) = file_name.strip_suffix(".sample") {
            (stripped.to_string(), true)
        } else {
            (file_name.clone(), false)
        };
        let is_standard = STANDARD_HOOK_NAMES.iter().any(|s| *s == base_name.as_str());
        if is_standard {
            if let Some(entry) = entries.iter_mut().find(|e| e.name == base_name) {
                if is_sample {
                    entry.sample_exists = true;
                } else {
                    entry.exists = true;
                    entry.path = Some(path.clone());
                    entry.size = size;
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
}
