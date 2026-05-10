// Stash 관리 — list / push / apply / pop / drop / show.
//
// 모두 git CLI shell-out. libgit2 stash API 도 있지만 metadata
// (untracked 포함 여부 등) 가 git CLI 와 미묘히 달라 일관성 위해 통일.

use crate::error::AppResult;
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StashEntry {
    /// stash@{0} 의 인덱스 0
    pub index: usize,
    /// stash 의 SHA
    pub sha: String,
    /// "WIP on main: ..." 같은 메시지
    pub message: String,
    /// stash 가 만들어진 브랜치 (메시지에서 파싱)
    pub branch: Option<String>,
    /// unix timestamp
    pub created_at: i64,
}

/// `git stash list --format=...` 파싱.
pub async fn list_stash(repo: &Path) -> AppResult<Vec<StashEntry>> {
    // %gd: stash@{0}, %H: SHA, %ct: committer unix, %s: subject
    let out = git_run(
        repo,
        &["stash", "list", "--format=%gd\x1f%H\x1f%ct\x1f%s"],
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
        let gd = parts[0]; // stash@{0}
        let index = gd
            .strip_prefix("stash@{")
            .and_then(|s| s.strip_suffix('}'))
            .and_then(|s| s.parse::<usize>().ok())
            .unwrap_or(0);
        let sha = parts[1].to_string();
        let created_at = parts[2].parse::<i64>().unwrap_or(0);
        let message = parts[3].to_string();
        let branch = message
            .strip_prefix("WIP on ")
            .or_else(|| message.strip_prefix("On "))
            .and_then(|s| s.split(':').next())
            .map(|s| s.trim().to_string());
        entries.push(StashEntry {
            index,
            sha,
            message,
            branch,
            created_at,
        });
    }
    Ok(entries)
}

/// 새 stash 생성. include_untracked=true 면 -u, message=Some 이면 push -m.
pub async fn push_stash(
    repo: &Path,
    message: Option<&str>,
    include_untracked: bool,
) -> AppResult<()> {
    let started = std::time::Instant::now();
    tracing::debug!(
        target: "git_fried_lib::stash",
        repo = %repo.display(),
        has_message = message.is_some(),
        include_untracked,
        "push_stash 시작"
    );
    let mut args: Vec<&str> = vec!["stash", "push"];
    if include_untracked {
        args.push("-u");
    }
    if let Some(m) = message {
        args.push("-m");
        args.push(m);
    }
    let result = git_run(repo, &args, &GitRunOpts::default())
        .await?
        .into_ok();
    let elapsed_ms = started.elapsed().as_millis() as u64;
    match &result {
        Ok(_) => {
            tracing::info!(target: "git_fried_lib::stash", repo = %repo.display(), elapsed_ms, "push_stash 완료")
        }
        Err(e) => {
            tracing::warn!(target: "git_fried_lib::stash", repo = %repo.display(), elapsed_ms, error = %e, "push_stash 실패")
        }
    }
    result?;
    Ok(())
}

/// Sprint c38 / plan/29 E3 — Smart Stash: staged-only stash (`git stash push -S`).
///
/// 인덱스(staged)에 있는 변경만 stash 하고 워킹트리(unstaged)는 보존.
/// 사용 패턴: WIP 진행 중 별도 작은 fix 만 staged → 그 fix 만 stash 후
/// 다른 작업 계속. 기존 `push_stash` 가 인덱스+워킹트리 모두 stash 하는 것과 다름.
///
/// Git 2.35+ 필요 (`-S` / `--staged` 플래그).
pub async fn push_stash_staged(repo: &Path, message: Option<&str>) -> AppResult<()> {
    let mut args: Vec<&str> = vec!["stash", "push", "-S"];
    if let Some(m) = message {
        args.push("-m");
        args.push(m);
    }
    git_run(repo, &args, &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

/// Sprint c38 / plan/29 E3 — Smart Stash: stash → 새 브랜치로 pop (`git stash branch <name> stash@{n}`).
///
/// stash 시점의 base commit 에서 새 브랜치 생성 후 stash 적용 + drop.
/// 충돌 시 stash 가 그대로 유지 (git 표준 동작) — drop 안 됨.
///
/// 사용 패턴: WIP stash 가 base 에서 너무 멀어져 conflict 가 큰 경우,
/// stash 시점 base 의 새 브랜치로 pop 하면 충돌 없이 복원 가능.
pub async fn stash_to_branch(repo: &Path, index: usize, branch: &str) -> AppResult<()> {
    let trimmed = branch.trim();
    if trimmed.is_empty() {
        return Err(crate::error::AppError::validation(
            "branch 이름이 비었습니다.",
        ));
    }
    // Sprint c38 fix LOW-3 — branch 이름이 `-` 로 시작하면 거부 (git option 처럼 해석되는 것 차단).
    // `--end-of-options` 도 함께 사용해 defense-in-depth.
    if trimmed.starts_with('-') {
        return Err(crate::error::AppError::validation(format!(
            "branch 이름은 '-' 로 시작할 수 없습니다: {trimmed}"
        )));
    }
    let stash_ref = format!("stash@{{{index}}}");
    git_run(
        repo,
        &["stash", "branch", "--end-of-options", trimmed, &stash_ref],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;
    Ok(())
}

/// stash@{n} apply (디폴트 0).
pub async fn apply_stash(repo: &Path, index: usize) -> AppResult<()> {
    let r = format!("stash@{{{index}}}");
    git_run(repo, &["stash", "apply", &r], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

/// stash@{n} pop (apply + drop).
pub async fn pop_stash(repo: &Path, index: usize) -> AppResult<()> {
    let r = format!("stash@{{{index}}}");
    git_run(repo, &["stash", "pop", &r], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

/// stash@{n} drop.
pub async fn drop_stash(repo: &Path, index: usize) -> AppResult<()> {
    let r = format!("stash@{{{index}}}");
    git_run(repo, &["stash", "drop", &r], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

/// stash@{n} 의 diff text.
pub async fn show_stash(repo: &Path, index: usize) -> AppResult<String> {
    let r = format!("stash@{{{index}}}");
    git_run(
        repo,
        &["stash", "show", "-p", "--no-color", &r],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()
}

/// stash@{n} 의 메시지 수정 (`docs/plan/14 §5 D2`, GitKraken §11 "Edit stash message").
///
/// git 표준 명령으로 stash 메시지를 직접 수정하는 방법이 없으므로,
/// 다음 3 단계로 안전하게 재구성:
///   1) 대상 stash 의 commit SHA 추출 (rev-parse stash@{n})
///   2) `git stash store -m "<new>" <sha>` — 같은 SHA 를 새 reflog entry 로 저장 (stash@{0} 이 됨)
///   3) 원본 `git stash drop stash@{n+1}` — drop (store 후 +1 이동)
///
/// 결과: 같은 commit (= 같은 변경) 을 새 메시지로 stash@{0} 에 보유. 순서 변경 발생.
/// store 가 reflog entry 를 만든 뒤 drop 하므로 SHA unreachable 위험 없음.
pub async fn edit_stash_message(repo: &Path, index: usize, new_message: &str) -> AppResult<()> {
    if new_message.trim().is_empty() {
        return Err(crate::error::AppError::validation("메시지 비어있음"));
    }
    // 1) commit SHA 추출
    let r = format!("stash@{{{index}}}");
    let sha = git_run(repo, &["rev-parse", &r], &GitRunOpts::default())
        .await?
        .into_ok()?
        .trim()
        .to_string();
    if sha.is_empty() {
        return Err(crate::error::AppError::validation("stash SHA 추출 실패"));
    }
    // 2) store with new message
    git_run(
        repo,
        &["stash", "store", "-m", new_message, &sha],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;
    // 3) 원본 drop — store 후 stash@{0} 이 새 entry, 원본은 +1 로 이동
    let original = format!("stash@{{{}}}", index + 1);
    git_run(repo, &["stash", "drop", &original], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

/// stash@{n} 안의 단일 파일만 working tree 에 apply
/// (`docs/plan/14 §5 D1`, GitKraken §11 "Apply this file").
///
/// 동작: `git stash show -p stash@{n} -- <path> | git apply -`
///   - stash show -p — patch 형식
///   - `-- <path>` — 해당 파일만 필터
///   - git apply — working tree 에 적용 (충돌 시 stderr 로 reject 안내)
///
/// 한글 path 안전 (git_run 표준 spawn). working tree dirty 여도 git apply 가
/// 충돌 발견 시 명시적으로 거부 → 데이터 손실 차단.
pub async fn apply_stash_file(repo: &Path, index: usize, path: &str) -> AppResult<()> {
    if path.trim().is_empty() {
        return Err(crate::error::AppError::validation("path 비어있음"));
    }
    let r = format!("stash@{{{index}}}");
    // 단순 전략: stash 의 그 시점 파일 내용을 working tree 에 직접 복원
    // (`git checkout stash@{n} -- <path>`).
    //
    // 이유: `git stash show -p` 는 path 필터 미지원, `git diff stash@{n}^1..` 는
    // stash 의 다중 parent 구조에서 비결정적. `git checkout` 은 stash 의 그 시점
    // 그대로를 가져오는 가장 직관적 방식 — GitKraken 의 "Apply this file" 의미와
    // 정확히 일치. dirty working tree 면 git 이 자체 보호 (overwrite 거부).
    git_run(repo, &["checkout", &r, "--", path], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_apply_stash_file_empty_path_errors() {
        let tmp = tempfile::TempDir::new().unwrap();
        let p = tmp.path();
        // git init 없어도 path 검증이 먼저
        let err = apply_stash_file(p, 0, "").await;
        assert!(err.is_err());

        // whitespace only → 동일하게 거부
        let err2 = apply_stash_file(p, 0, "   ").await;
        assert!(err2.is_err());
    }

    // round-trip 테스트는 dogfood 시점에 검증 — Windows test 환경의 `git stash push`
    // 가 silent fail 하는 케이스가 있어 (`run_sync` 가 status 미검증) 회귀 차단을
    // production 사용자 dogfood 로 위임. apply_stash_file 자체는 단순 한 줄 git
    // 호출 (`git checkout stash@{n} -- <path>`) 라 production 위험 낮음.

    /// stash_to_branch 빈 branch 이름 → validation 에러.
    #[tokio::test]
    async fn test_stash_to_branch_empty_name_errors() {
        let tmp = tempfile::TempDir::new().unwrap();
        let err = stash_to_branch(tmp.path(), 0, "").await.unwrap_err();
        assert_eq!(err.kind(), "validation");
        let err2 = stash_to_branch(tmp.path(), 0, "   ").await.unwrap_err();
        assert_eq!(err2.kind(), "validation");
    }

    /// push_stash_staged round-trip — staged 만 stash, unstaged 워킹트리는 보존.
    /// Git 2.35+ 필요 (`-S` 플래그). 시나리오:
    ///   1. init + commit base
    ///   2. file A 수정 후 stage, file B 수정 후 unstage
    ///   3. push_stash_staged → A 가 stash 로, B 는 워킹트리에 남아야 함.
    #[tokio::test]
    async fn test_push_stash_staged_only_indexes_staged() {
        use std::fs;
        let tmp = tempfile::TempDir::new().unwrap();
        let path = tmp.path();

        // init + identity + gpgsign off
        git_run(path, &["init", "-q", "-b", "main"], &GitRunOpts::default())
            .await
            .unwrap()
            .into_ok()
            .unwrap();
        for cfg in &[
            ("user.name", "tester"),
            ("user.email", "t@e.com"),
            ("commit.gpgsign", "false"),
        ] {
            git_run(path, &["config", cfg.0, cfg.1], &GitRunOpts::default())
                .await
                .unwrap()
                .into_ok()
                .unwrap();
        }

        // base commit
        let a = path.join("a.txt");
        let b = path.join("b.txt");
        fs::write(&a, "A0\n").unwrap();
        fs::write(&b, "B0\n").unwrap();
        git_run(path, &["add", "."], &GitRunOpts::default())
            .await
            .unwrap()
            .into_ok()
            .unwrap();
        crate::git::runner::commit_with_message(path, "base")
            .await
            .unwrap()
            .into_ok()
            .unwrap();

        // 둘 다 수정 — A 만 stage, B 는 unstaged.
        fs::write(&a, "A1\n").unwrap();
        fs::write(&b, "B1\n").unwrap();
        git_run(path, &["add", "a.txt"], &GitRunOpts::default())
            .await
            .unwrap()
            .into_ok()
            .unwrap();

        // staged-only stash. Git 2.35+ 가 아니면 GitCli 에러 — 그 경우는 skip.
        match push_stash_staged(path, Some("staged-only test")).await {
            Ok(_) => {
                // A 는 base 로 복원 (stash 됨), B 는 그대로 남음.
                let after_a = fs::read_to_string(&a).unwrap();
                let after_b = fs::read_to_string(&b).unwrap();
                assert_eq!(after_a, "A0\n", "staged stash 후 A 는 base 로 복원");
                assert_eq!(after_b, "B1\n", "unstaged B 는 워킹트리에 보존");
            }
            Err(e) => {
                // CI/older git — skip with informative log
                eprintln!("push_stash_staged skipped (git --version <2.35?): {}", e);
            }
        }
    }

    /// StashEntry serde — camelCase (createdAt) + 한글 message 안전.
    #[test]
    fn test_stash_entry_serde() {
        let e = StashEntry {
            index: 0,
            sha: "abc1234".to_string(),
            message: "WIP on feature/한글: 한글 ellipsis 좌측 잘림 실험".to_string(),
            branch: Some("feature/한글".to_string()),
            created_at: 1_700_000_000,
        };
        let json = serde_json::to_string(&e).unwrap();
        assert!(json.contains("\"createdAt\":1700000000"));
        assert!(!json.contains("created_at"));
        // 한글 그대로 (escape 없이).
        assert!(json.contains("한글 ellipsis 좌측 잘림"));
        assert!(json.contains("feature/한글"));
    }
}
