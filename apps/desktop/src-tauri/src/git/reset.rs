// git reset (soft / mixed / hard) — 위험 액션, UI 에서 type-to-confirm.

use crate::error::{AppError, AppResult};
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ResetMode {
    Soft,
    Mixed,
    Hard,
    Keep,
}

pub async fn reset(path: &Path, mode: ResetMode, target: &str) -> AppResult<()> {
    let mode_arg = match mode {
        ResetMode::Soft => "--soft",
        ResetMode::Mixed => "--mixed",
        ResetMode::Hard => "--hard",
        ResetMode::Keep => "--keep",
    };
    if target.trim().is_empty() {
        return Err(AppError::validation("reset 대상이 비었습니다."));
    }
    git_run(path, &["reset", mode_arg, target], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

/// === Sprint c25-1.5 (`docs/plan/25 §2 c25-1.5`) — Undo last action ===
///
/// GitKraken Toolbar 의 ↶ Undo 버튼이 호출. 안전을 위해 commit/amend 만 지원
/// (`reset --soft HEAD@{1}` — working tree 보존). 다른 액션 (merge, rebase,
/// branch switch, checkout 등) 은 거부 → 사용자에게 ReflogModal 권유.
///
/// 동작:
/// 1. `git reflog HEAD -1 --format=%gs` → 마지막 entry subject (e.g., "commit: feat...")
/// 2. action prefix 파싱 (예: `commit`, `commit (amend)`, `merge`, `pull`, `checkout`, ...)
/// 3. commit / commit (amend) / commit (initial) 만 진행, 나머지 거부
/// 4. `reset --soft HEAD@{1}` 실행
/// 5. UndoResult 반환 (action / message / new_head_sha)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UndoResult {
    /// commit / amend / merge / pull / rebase / checkout / etc — reflog action prefix.
    pub action: String,
    /// reflog 메시지 (action 제외 부분, e.g., "feat: 구현").
    pub message: String,
    /// reset 실행 여부. false 면 supported=false 라서 거부됨.
    pub executed: bool,
    /// 거부 사유 (executed=false 시).
    pub rejection_reason: Option<String>,
    /// reset 후 새 HEAD SHA (executed=true 시).
    pub new_head_sha: Option<String>,
}

pub async fn undo_last_action(path: &Path) -> AppResult<UndoResult> {
    // 1. reflog HEAD 의 마지막 entry subject 조회.
    let out = git_run(
        path,
        &["reflog", "HEAD", "-1", "--format=%gs"],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;
    let raw = out.trim().to_string();
    if raw.is_empty() {
        return Err(AppError::validation(
            "reflog 가 비어있어 undo 할 작업이 없습니다.",
        ));
    }

    // 2. action prefix 파싱 — `<action>: <message>` 또는 `<action> (<sub>): <message>`.
    let (action, message) = match raw.split_once(':') {
        Some((a, m)) => (a.trim().to_string(), m.trim().to_string()),
        None => (raw.clone(), String::new()),
    };

    // 3. 지원 액션 화이트리스트 (SEC-007 / ARCH-011 fix).
    //    명시 매칭 — `commit (cherry-pick)` 등 미래 git 버전의 새 subaction 자동 통과 방지.
    let supported = matches!(
        action.as_str(),
        "commit" | "commit (amend)" | "commit (initial)" | "commit (merge)"
    );
    if !supported {
        return Ok(UndoResult {
            action,
            message,
            executed: false,
            rejection_reason: Some(
                "commit/amend/initial/merge 외 액션은 안전 보장 어려움 — Reflog 모달에서 직접 처리하세요."
                    .to_string(),
            ),
            new_head_sha: None,
        });
    }

    // 4. SEC-004 fix — TOCTOU 방지: HEAD@{1} 의 SHA 를 캡처해 reset target 으로 직접 사용.
    //    reflog 조회 (1) → SHA 캡처 (4) → reset (5) 사이에 외부 git 프로세스 (CLI/hooks)
    //    가 reflog 추가하더라도 캡처된 SHA 로 reset → race 무력화.
    let prev_sha = git_run(
        path,
        &["rev-parse", "--verify", "HEAD@{1}"],
        &GitRunOpts::default(),
    )
    .await?;
    if prev_sha.exit_code != Some(0) {
        return Ok(UndoResult {
            action,
            message,
            executed: false,
            rejection_reason: Some("reflog 에 이전 entry 가 없습니다 (HEAD@{1} 부재).".to_string()),
            new_head_sha: None,
        });
    }
    let target_sha = prev_sha.stdout.trim().to_string();
    if target_sha.is_empty() {
        return Ok(UndoResult {
            action,
            message,
            executed: false,
            rejection_reason: Some("HEAD@{1} SHA 조회 실패 (빈 응답).".to_string()),
            new_head_sha: None,
        });
    }

    // 5. soft reset — working tree / index 보존, branch 만 캡처된 SHA 로.
    //    HEAD@{1} 직접 사용 안 함 (race 방지).
    git_run(
        path,
        &["reset", "--soft", &target_sha],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;

    // 6. 새 HEAD SHA 조회.
    let new_sha = git_run(path, &["rev-parse", "HEAD"], &GitRunOpts::default())
        .await?
        .into_ok()
        .ok()
        .map(|s| s.trim().to_string());

    Ok(UndoResult {
        action,
        message,
        executed: true,
        rejection_reason: None,
        new_head_sha: new_sha,
    })
}

/// 단일 커밋 revert.
pub async fn revert(path: &Path, sha: &str, no_commit: bool) -> AppResult<()> {
    let mut args: Vec<&str> = vec!["revert"];
    if no_commit {
        args.push("--no-commit");
    }
    args.push(sha);
    git_run(path, &args, &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}
