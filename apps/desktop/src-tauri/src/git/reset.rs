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
    //    Phase 1 (plan-reflog-undo): commit 4종 + checkout 추가. checkout 은 working tree
    //    clean 시 만 자동 처리 (dirty → 거부 + ReflogModal 안내).
    let is_commit = matches!(
        action.as_str(),
        "commit" | "commit (amend)" | "commit (initial)" | "commit (merge)"
    );
    let is_checkout = action.as_str() == "checkout";
    let supported = is_commit || is_checkout;
    if !supported {
        return Ok(UndoResult {
            action,
            message,
            executed: false,
            rejection_reason: Some(
                "commit/amend/initial/checkout 외 액션은 안전 보장 어려움 — Reflog 모달에서 직접 처리하세요."
                    .to_string(),
            ),
            new_head_sha: None,
        });
    }

    // 3.5. checkout undo 는 working tree clean 검증 (status --porcelain 빈 출력).
    //      dirty 시 자동 checkout 이 변경 손상 가능 → 거부.
    if is_checkout {
        let status = git_run(path, &["status", "--porcelain"], &GitRunOpts::default())
            .await?
            .into_ok()?;
        if !status.trim().is_empty() {
            return Ok(UndoResult {
                action,
                message,
                executed: false,
                rejection_reason: Some(
                    "checkout undo 는 working tree 가 clean 일 때만 자동 처리 — 변경을 stash 하거나 commit 후 재시도하세요."
                        .to_string(),
                ),
                new_head_sha: None,
            });
        }
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

    // 5. action 별 분기:
    //    - commit/amend/initial/commit (merge): reset --soft target_sha (working tree 보존)
    //    - checkout: git checkout target_sha (clean 검증 후, branch ref 유지)
    if is_checkout {
        git_run(path, &["checkout", &target_sha], &GitRunOpts::default())
            .await?
            .into_ok()?;
    } else {
        git_run(
            path,
            &["reset", "--soft", &target_sha],
            &GitRunOpts::default(),
        )
        .await?
        .into_ok()?;
    }

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

/// === Phase 1 (plan-reflog-undo) — Redo last action ===
///
/// undo 가 reflog 에 남긴 reset/checkout entry 의 inverse 를 적용 (= HEAD@{1} 의 SHA 로 복귀).
/// undo 가 아닌 일반 작업 위에서는 거부 (toast.warning) — 사용자가 ReflogModal 직접 사용.
///
/// 안전 측면: undo 와 동일한 reset --soft / checkout 분기 사용. dirty check 도 동일.
pub async fn redo_last_action(path: &Path) -> AppResult<UndoResult> {
    // 1. 마지막 reflog entry subject.
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
            "reflog 가 비어있어 redo 할 작업이 없습니다.",
        ));
    }

    let (action, message) = match raw.split_once(':') {
        Some((a, m)) => (a.trim().to_string(), m.trim().to_string()),
        None => (raw.clone(), String::new()),
    };

    // 2. redo 가능 action: 직전이 reset/checkout (= 사용자가 undo 버튼 또는 reflog restore 한 결과).
    let supported = action.starts_with("reset") || action == "checkout";
    if !supported {
        return Ok(UndoResult {
            action,
            message,
            executed: false,
            rejection_reason: Some(
                "redo 는 직전이 reset/checkout 일 때만 자동 처리 — Reflog 모달에서 sha 직접 선택하세요."
                    .to_string(),
            ),
            new_head_sha: None,
        });
    }
    let is_checkout = action == "checkout";

    // 3. checkout redo 는 working tree clean 검증.
    if is_checkout {
        let status = git_run(path, &["status", "--porcelain"], &GitRunOpts::default())
            .await?
            .into_ok()?;
        if !status.trim().is_empty() {
            return Ok(UndoResult {
                action,
                message,
                executed: false,
                rejection_reason: Some(
                    "checkout redo 는 working tree clean 일 때만 자동 처리 — stash 또는 commit 후 재시도하세요.".to_string(),
                ),
                new_head_sha: None,
            });
        }
    }

    // 4. SEC-004 mirror — HEAD@{1} 의 SHA 캡처 (race 방지).
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
            rejection_reason: Some(
                "reflog 에 redo target 이 없습니다 (HEAD@{1} 부재).".to_string(),
            ),
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

    // 5. inverse 적용: undo 가 reset --soft 였으면 redo 도 reset --soft. checkout 이면 checkout.
    if is_checkout {
        git_run(path, &["checkout", &target_sha], &GitRunOpts::default())
            .await?
            .into_ok()?;
    } else {
        git_run(
            path,
            &["reset", "--soft", &target_sha],
            &GitRunOpts::default(),
        )
        .await?
        .into_ok()?;
    }

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

#[cfg(test)]
mod tests {
    use super::*;

    /// reflog 가 비어있으면 (= 신규 init repo, no commits) undo 는 validation 에러.
    #[tokio::test]
    async fn test_undo_empty_reflog_errors() {
        let tmp = tempfile::TempDir::new().unwrap();
        let res = undo_last_action(tmp.path()).await;
        assert!(res.is_err());
    }

    /// redo 도 동일.
    #[tokio::test]
    async fn test_redo_empty_reflog_errors() {
        let tmp = tempfile::TempDir::new().unwrap();
        let res = redo_last_action(tmp.path()).await;
        assert!(res.is_err());
    }

    /// reset target 이 비어있으면 validation 에러.
    #[tokio::test]
    async fn test_reset_empty_target_errors() {
        let tmp = tempfile::TempDir::new().unwrap();
        let res = reset(tmp.path(), ResetMode::Soft, "").await;
        assert!(res.is_err());
        let res = reset(tmp.path(), ResetMode::Soft, "   ").await;
        assert!(res.is_err());
    }

    /// UndoResult serde — camelCase 직렬화 (frontend 와 일치).
    #[test]
    fn test_undo_result_serde_camel_case() {
        let r = UndoResult {
            action: "checkout".to_string(),
            message: "moving from main to feature".to_string(),
            executed: false,
            rejection_reason: Some("dirty".to_string()),
            new_head_sha: None,
        };
        let json = serde_json::to_string(&r).unwrap();
        assert!(json.contains("\"rejectionReason\""));
        assert!(json.contains("\"newHeadSha\""));
        assert!(!json.contains("rejection_reason"));
    }
}
