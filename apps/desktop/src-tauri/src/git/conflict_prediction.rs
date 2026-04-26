// Conflict prediction (target-branch 한정) — Sprint B2 (`docs/plan/11 §20`).
//
// 핵심: Git 2.38+ 의 `git merge-tree --write-tree` 가 데이터 변경 0 으로
// 3-way merge 결과 시뮬레이션. 충돌 발생 시 stderr 에 file 목록 출력.
//
// 회사 50+ 레포 사용자 시나리오 — 매번 main rebase 전에 미리 알 수 있도록.

use crate::error::AppResult;
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictPrediction {
    /// 충돌 없음 = true.
    pub ok: bool,
    /// 비교 대상 (예: 'origin/main'). 입력 그대로.
    pub target: String,
    /// 충돌 파일 목록 (ok=true 면 빈 vec).
    pub conflict_files: Vec<String>,
    /// merge-tree 미지원 등으로 판정 불가능 시 메시지.
    pub note: Option<String>,
}

/// 현재 HEAD 와 target ref 사이의 머지 시뮬레이션. 충돌 없으면 ok=true.
///
/// 호출자 (frontend) 가 주기적으로 (예: 60초) 호출. 비용은 git 의 in-memory
/// 3-way merge 1회 → 빠름. 단 큰 모노레포는 1~2초 가능.
pub async fn predict(repo: &Path, target: &str) -> AppResult<ConflictPrediction> {
    if target.trim().is_empty() {
        return Ok(ConflictPrediction {
            ok: true,
            target: target.to_string(),
            conflict_files: vec![],
            note: Some("target 비어있음".into()),
        });
    }

    // 1차: Git 2.38+ 의 modern `merge-tree --write-tree`.
    let modern = predict_modern(repo, target).await?;
    if modern.note.is_none() {
        return Ok(modern);
    }
    // 2차: 구버전 fallback (`merge-base` + legacy merge-tree).
    predict_legacy(repo, target).await
}

async fn predict_modern(
    repo: &Path,
    target: &str,
) -> AppResult<ConflictPrediction> {
    // Git 2.38+ 의 modern merge-tree.
    // `--no-messages` 없으면 일부 git 빌드가 정보 메시지 출력 → 파싱 노이즈.
    let out = git_run(
        repo,
        &[
            "merge-tree",
            "--write-tree",
            "--name-only",
            "--no-messages",
            "HEAD",
            target,
        ],
        &GitRunOpts::default(),
    )
    .await?;

    // merge-tree 의 동작:
    //   - 충돌 없음: exit=0, stdout = merge tree SHA (한 줄).
    //   - 충돌 있음: exit=1, stdout = tree SHA + 빈 줄 + 충돌 파일 목록.
    //   - 미지원/에러: exit!=0, stderr 에 메시지.
    //
    // 일부 git 빌드는 exit=0 이지만 stdout 에 충돌 파일이 함께 출력되는 변형도 있어
    // 파싱은 "두 번째 빈 줄 이후 비어있지 않은 라인" 을 충돌 파일로 간주.
    let stdout = out.stdout.trim_end();

    if out.exit_code == Some(0) {
        // 충돌 없음 — 단일 SHA 라인만.
        // 또는 multi-line (위 변형) — 두 번째 라인 이후 충돌.
        let lines: Vec<&str> = stdout.lines().collect();
        if lines.len() <= 1 {
            return Ok(ConflictPrediction {
                ok: true,
                target: target.to_string(),
                conflict_files: vec![],
                note: None,
            });
        }
        // 첫 line = SHA, 빈 줄 분리 후 충돌 파일 (변형 처리).
        let conflicts: Vec<String> = lines
            .iter()
            .skip(1)
            .filter(|l| !l.trim().is_empty())
            .map(|s| s.trim().to_string())
            .collect();
        return Ok(ConflictPrediction {
            ok: conflicts.is_empty(),
            target: target.to_string(),
            conflict_files: conflicts,
            note: None,
        });
    }

    // exit != 0
    if out.exit_code == Some(1) {
        // 표준 충돌 — stdout: SHA / "" / file1 / file2 ...
        let lines: Vec<&str> = stdout.lines().collect();
        let conflicts: Vec<String> = lines
            .iter()
            .skip(1)
            .filter(|l| !l.trim().is_empty())
            .map(|s| s.trim().to_string())
            .collect();
        return Ok(ConflictPrediction {
            ok: false,
            target: target.to_string(),
            conflict_files: if conflicts.is_empty() {
                // 일부 빌드는 stderr 에 출력 — fallback.
                out.stderr
                    .lines()
                    .filter(|l| !l.trim().is_empty() && !l.starts_with("CONFLICT"))
                    .map(|s| s.trim().to_string())
                    .collect()
            } else {
                conflicts
            },
            note: None,
        });
    }

    // 기타 — git 버전 미지원 / target 잘못 지정 등. graceful degrade.
    Ok(ConflictPrediction {
        ok: true,
        target: target.to_string(),
        conflict_files: vec![],
        note: Some(format!(
            "merge-tree 실패 (exit={:?}): {}",
            out.exit_code,
            out.stderr.trim().chars().take(120).collect::<String>(),
        )),
    })
}

/// Legacy `git merge-tree <base> HEAD <target>` 기반 fallback (구버전 git).
///
/// 출력은 git diff-like 마커 포함. `<<<<<<<` 마커 존재로 충돌 판단 + `+++ b/<path>`
/// 헤더에서 영향 파일 추출. 정확도가 modern 보다 낮지만 ok/conflict 분류는 신뢰.
async fn predict_legacy(
    repo: &Path,
    target: &str,
) -> AppResult<ConflictPrediction> {
    // base 구하기.
    let base_out = git_run(
        repo,
        &["merge-base", "HEAD", target],
        &GitRunOpts::default(),
    )
    .await?;
    let base = match base_out.exit_code {
        Some(0) => base_out.stdout.trim().to_string(),
        _ => {
            return Ok(ConflictPrediction {
                ok: true,
                target: target.to_string(),
                conflict_files: vec![],
                note: Some(format!(
                    "merge-base 실패 (target={target}): {}",
                    base_out.stderr.trim().chars().take(120).collect::<String>(),
                )),
            });
        }
    };
    if base.is_empty() {
        return Ok(ConflictPrediction {
            ok: true,
            target: target.to_string(),
            conflict_files: vec![],
            note: Some("merge-base 가 비어있음 (공통 조상 없음)".into()),
        });
    }

    let out = git_run(
        repo,
        &["merge-tree", &base, "HEAD", target],
        &GitRunOpts::default(),
    )
    .await?;
    if out.exit_code != Some(0) {
        return Ok(ConflictPrediction {
            ok: true,
            target: target.to_string(),
            conflict_files: vec![],
            note: Some(format!(
                "legacy merge-tree 실패 (exit={:?}): {}",
                out.exit_code,
                out.stderr.trim().chars().take(120).collect::<String>(),
            )),
        });
    }
    let stdout = &out.stdout;
    if !stdout.contains("<<<<<<<") {
        return Ok(ConflictPrediction {
            ok: true,
            target: target.to_string(),
            conflict_files: vec![],
            note: None,
        });
    }
    // 충돌 파일 추출 — `+++ b/<file>` 헤더에서.
    let mut files: Vec<String> = Vec::new();
    let mut last_file: Option<String> = None;
    for line in stdout.lines() {
        if let Some(rest) = line.strip_prefix("+++ b/") {
            last_file = Some(rest.trim().to_string());
        } else if line.starts_with("<<<<<<<") {
            if let Some(ref f) = last_file {
                if !files.iter().any(|x| x == f) {
                    files.push(f.clone());
                }
            }
        }
    }
    if files.is_empty() {
        // 파일명 추출 못하면 "(파일명 미상)" placeholder.
        files.push("(파일명 미상)".to_string());
    }
    Ok(ConflictPrediction {
        ok: false,
        target: target.to_string(),
        conflict_files: files,
        note: Some("legacy merge-tree fallback".into()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn init_test_repo() -> (tempfile::TempDir, std::path::PathBuf) {
        let tmp = tempfile::TempDir::new().unwrap();
        let path = tmp.path().to_path_buf();
        for cmd in &[
            vec!["init", "-q", "-b", "main"],
            vec!["config", "user.name", "x"],
            vec!["config", "user.email", "x@x"],
            vec!["config", "commit.gpgsign", "false"],
        ] {
            git_run(&path, cmd, &GitRunOpts::default())
                .await
                .unwrap()
                .into_ok()
                .unwrap();
        }
        (tmp, path)
    }

    async fn make_commit(p: &std::path::Path, file: &str, body: &str, msg: &str) {
        std::fs::write(p.join(file), body).unwrap();
        git_run(p, &["add", "."], &GitRunOpts::default())
            .await
            .unwrap()
            .into_ok()
            .unwrap();
        git_run(p, &["commit", "-m", msg], &GitRunOpts::default())
            .await
            .unwrap()
            .into_ok()
            .unwrap();
    }

    #[tokio::test]
    async fn test_no_conflict_when_branches_diverge_clean() {
        let (_tmp, path) = init_test_repo().await;
        make_commit(&path, "a.txt", "1\n", "init").await;

        // feat 브랜치에서 새 파일.
        git_run(&path, &["checkout", "-b", "feat"], &GitRunOpts::default())
            .await
            .unwrap()
            .into_ok()
            .unwrap();
        make_commit(&path, "feat-only.txt", "feat\n", "feat").await;

        // main 으로 돌아와서 다른 새 파일.
        git_run(&path, &["checkout", "main"], &GitRunOpts::default())
            .await
            .unwrap()
            .into_ok()
            .unwrap();
        make_commit(&path, "main-only.txt", "main\n", "main").await;

        // HEAD (=main) vs feat → 충돌 없음 (서로 다른 파일).
        let p = predict(&path, "feat").await.unwrap();
        assert!(p.ok, "충돌 없어야 함. note={:?}, files={:?}", p.note, p.conflict_files);
    }

    #[tokio::test]
    async fn test_conflict_detected_on_same_file_change() {
        let (_tmp, path) = init_test_repo().await;
        make_commit(&path, "a.txt", "원래\n", "init").await;

        git_run(&path, &["checkout", "-b", "feat"], &GitRunOpts::default())
            .await
            .unwrap()
            .into_ok()
            .unwrap();
        make_commit(&path, "a.txt", "feat 버전\n", "feat: 한글 변경").await;

        git_run(&path, &["checkout", "main"], &GitRunOpts::default())
            .await
            .unwrap()
            .into_ok()
            .unwrap();
        make_commit(&path, "a.txt", "main 버전\n", "main: 한글 변경").await;

        let p = predict(&path, "feat").await.unwrap();
        assert!(!p.ok, "충돌 있어야 함. note={:?}", p.note);
        // modern 은 정확한 파일명, legacy 는 "(파일명 미상)" 가능 — 둘 다 OK.
        assert!(
            !p.conflict_files.is_empty(),
            "최소 1개 충돌 항목. got: {:?}",
            p.conflict_files
        );
    }

    #[tokio::test]
    async fn test_empty_target_returns_ok_note() {
        let (_tmp, path) = init_test_repo().await;
        make_commit(&path, "a.txt", "x", "init").await;
        let p = predict(&path, "").await.unwrap();
        assert!(p.ok);
        assert!(p.note.is_some());
    }

    #[tokio::test]
    async fn test_invalid_target_returns_graceful_note() {
        let (_tmp, path) = init_test_repo().await;
        make_commit(&path, "a.txt", "x", "init").await;
        let p = predict(&path, "non-existent-branch").await.unwrap();
        // ok=true with note (graceful) — 호출자가 note 보고 판단.
        assert!(p.note.is_some(), "graceful degrade — note 있음");
    }
}
