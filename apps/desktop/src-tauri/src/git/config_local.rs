// Per-repo .git/config 키 read/write (`docs/plan/14 §3` Sprint B14-3).
//
// Repository-Specific Preferences (B1~B4):
//   - B1 Hooks path: core.hooksPath
//   - B2 Encoding: i18n.commitEncoding / i18n.logOutputEncoding
//   - B3 Gitflow: gitflow.branch.master / develop / prefix.feature / etc.
//   - B4 Commit Signing: commit.gpgsign / user.signingkey / gpg.format
//
// `git config --local <key>` / `git config --local <key> <value>` /
// `git config --local --unset <key>` shell-out (한글 안전).
//
// 빈 값 (Option::None) = unset, Some("") = 명시적 빈 string (보통 unset 으로 처리).

use crate::error::AppResult;
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Repository-Specific Preferences 4 섹션 통합 read 결과.
/// 모든 키는 `Option<String>` — 미설정 시 None.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoConfigSnapshot {
    // B1 Hooks
    pub hooks_path: Option<String>,
    // B2 Encoding
    pub commit_encoding: Option<String>,
    pub log_output_encoding: Option<String>,
    // B3 Gitflow
    pub gitflow_branch_master: Option<String>,
    pub gitflow_branch_develop: Option<String>,
    pub gitflow_prefix_feature: Option<String>,
    pub gitflow_prefix_release: Option<String>,
    pub gitflow_prefix_hotfix: Option<String>,
    // B4 Commit Signing
    pub commit_gpgsign: Option<String>, // "true" | "false"
    pub user_signingkey: Option<String>,
    pub gpg_format: Option<String>, // "openpgp" | "ssh" | "x509"
    // 추가 — 자주 쓰는 user identity override (per-repo)
    pub user_name: Option<String>,
    pub user_email: Option<String>,
}

const KEYS: &[&str] = &[
    "core.hooksPath",
    "i18n.commitEncoding",
    "i18n.logOutputEncoding",
    "gitflow.branch.master",
    "gitflow.branch.develop",
    "gitflow.prefix.feature",
    "gitflow.prefix.release",
    "gitflow.prefix.hotfix",
    "commit.gpgsign",
    "user.signingkey",
    "gpg.format",
    "user.name",
    "user.email",
];

async fn read_one(repo: &Path, key: &str) -> AppResult<Option<String>> {
    // `git config --local --get <key>` — 미설정 시 exit 1.
    // git_run 은 non-zero 도 Err 가 아닌 GitOutput 으로 반환하므로 exit_code 직접 검사.
    let out = git_run(repo, &["config", "--local", "--get", key], &GitRunOpts::default()).await?;
    if out.exit_code == Some(0) {
        Ok(Some(out.stdout.trim_end().to_string()))
    } else {
        Ok(None)
    }
}

pub async fn read_snapshot(repo: &Path) -> AppResult<RepoConfigSnapshot> {
    let mut snap = RepoConfigSnapshot::default();
    for key in KEYS {
        let v = read_one(repo, key).await?;
        assign_field(&mut snap, key, v);
    }
    Ok(snap)
}

fn assign_field(snap: &mut RepoConfigSnapshot, key: &str, v: Option<String>) {
    match key {
        "core.hooksPath" => snap.hooks_path = v,
        "i18n.commitEncoding" => snap.commit_encoding = v,
        "i18n.logOutputEncoding" => snap.log_output_encoding = v,
        "gitflow.branch.master" => snap.gitflow_branch_master = v,
        "gitflow.branch.develop" => snap.gitflow_branch_develop = v,
        "gitflow.prefix.feature" => snap.gitflow_prefix_feature = v,
        "gitflow.prefix.release" => snap.gitflow_prefix_release = v,
        "gitflow.prefix.hotfix" => snap.gitflow_prefix_hotfix = v,
        "commit.gpgsign" => snap.commit_gpgsign = v,
        "user.signingkey" => snap.user_signingkey = v,
        "gpg.format" => snap.gpg_format = v,
        "user.name" => snap.user_name = v,
        "user.email" => snap.user_email = v,
        _ => {}
    }
}

/// 단일 키 set/unset.
/// - `Some("non-empty")` → `git config --local <key> <value>`
/// - `None` 또는 `Some("")` → `git config --local --unset <key>` (이미 unset 이면 skip)
pub async fn set_one(repo: &Path, key: &str, value: Option<&str>) -> AppResult<()> {
    let trimmed = value.map(|s| s.trim()).filter(|s| !s.is_empty());
    if let Some(v) = trimmed {
        git_run(
            repo,
            &["config", "--local", key, v],
            &GitRunOpts::default(),
        )
        .await?
        .into_ok()?;
    } else {
        // unset — 미존재 시 exit 5. into_ok 호출 안 하면 무시됨.
        let _ = git_run(
            repo,
            &["config", "--local", "--unset", key],
            &GitRunOpts::default(),
        )
        .await?;
    }
    Ok(())
}

/// 여러 키를 한 번의 IPC 호출로 적용 (form save).
pub async fn apply_snapshot(
    repo: &Path,
    snap: &RepoConfigSnapshot,
) -> AppResult<()> {
    set_one(repo, "core.hooksPath", snap.hooks_path.as_deref()).await?;
    set_one(repo, "i18n.commitEncoding", snap.commit_encoding.as_deref()).await?;
    set_one(repo, "i18n.logOutputEncoding", snap.log_output_encoding.as_deref()).await?;
    set_one(repo, "gitflow.branch.master", snap.gitflow_branch_master.as_deref()).await?;
    set_one(repo, "gitflow.branch.develop", snap.gitflow_branch_develop.as_deref()).await?;
    set_one(repo, "gitflow.prefix.feature", snap.gitflow_prefix_feature.as_deref()).await?;
    set_one(repo, "gitflow.prefix.release", snap.gitflow_prefix_release.as_deref()).await?;
    set_one(repo, "gitflow.prefix.hotfix", snap.gitflow_prefix_hotfix.as_deref()).await?;
    set_one(repo, "commit.gpgsign", snap.commit_gpgsign.as_deref()).await?;
    set_one(repo, "user.signingkey", snap.user_signingkey.as_deref()).await?;
    set_one(repo, "gpg.format", snap.gpg_format.as_deref()).await?;
    set_one(repo, "user.name", snap.user_name.as_deref()).await?;
    set_one(repo, "user.email", snap.user_email.as_deref()).await?;
    Ok(())
}
