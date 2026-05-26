// Reflog 모듈 — `.git/logs/HEAD` 또는 다른 ref 의 reflog 파싱 + reflog-based undo/redo
// 통합 진입점.
//
// 본 모듈의 책임 (Sprint c35 plan/27 단기 액션 3):
//   1. `list_reflog(repo, ref_name, limit)` — reflog 항목 파싱 (sha + label + action + subject + at)
//   2. `undo_last_action(repo)` / `redo_last_action(repo)` — reflog 기반 안전 undo/redo
//      (실 구현은 `git/reset.rs` 에 있고 본 모듈에서 re-export — v1.x crate
//      'reflog-undo' 추출 시 본 모듈 통째로 가져갈 수 있도록 정비).
//
// `git reflog` 출력 파싱이 가장 안정적 (in-process libgit2 의 reflog API 보다 정확).

use crate::error::AppResult;
use crate::git::path::reject_dash_prefix;
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

// Sprint c35 — reflog 단일 진입점. 실 구현은 reset.rs (race-safe SHA capture / 화이트리스트
// 검증 / checkout dirty 거부 등) 그대로 두되 본 모듈에서 re-export 하여 publish 가능 형태 정비.
pub use crate::git::reset::{redo_last_action, undo_last_action, UndoResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReflogEntry {
    pub sha: String,
    pub short_sha: String,
    pub ref_label: String, // "HEAD@{0}"
    pub action: String,    // "commit:", "checkout:", "reset:" 등
    pub subject: String,
    pub at: i64, // unix timestamp
}

pub async fn list_reflog(repo: &Path, ref_name: &str, limit: usize) -> AppResult<Vec<ReflogEntry>> {
    // Sprint 2026-05-26 R4 — Codex audit MED: ref_name CWE-88 가드.
    let safe_ref = reject_dash_prefix(ref_name, "ref_name")?;
    let limit_arg = format!("-n{limit}");
    // %H | %gd (HEAD@{0}) | %gs (subject) | %ct (committer time)
    let format = "--format=%H\x1f%gd\x1f%gs\x1f%ct";
    let out = git_run(
        repo,
        &[
            "reflog",
            "--no-color",
            &limit_arg,
            format,
            "--end-of-options",
            safe_ref,
        ],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;

    let mut entries = Vec::new();
    for line in out.lines() {
        let parts: Vec<&str> = line.split('\x1f').collect();
        if parts.len() < 4 {
            continue;
        }
        let sha = parts[0].to_string();
        let ref_label = parts[1].to_string();
        let raw_subject = parts[2];
        // raw_subject 형식: "commit: feat: ..." 또는 "checkout: moving from a to b"
        let (action, subject) = if let Some(idx) = raw_subject.find(": ") {
            let action = raw_subject[..idx].to_string();
            let subj = raw_subject[idx + 2..].to_string();
            (action, subj)
        } else {
            (String::new(), raw_subject.to_string())
        };
        let at: i64 = parts[3].parse().unwrap_or(0);
        entries.push(ReflogEntry {
            short_sha: sha.chars().take(7).collect(),
            sha,
            ref_label,
            action,
            subject,
            at,
        });
    }
    Ok(entries)
}
