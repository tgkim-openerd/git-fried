// Interactive rebase — `docs/plan/09 옵션 A` 구현.
//
// 핵심 전략:
//   1. 우리가 만든 todo 를 임시 파일에 작성
//   2. `GIT_SEQUENCE_EDITOR` 를 자체 helper binary (`--rebase-todo-helper`) 로 지정
//   3. `git rebase -i <base>` 호출 → git 이 helper 호출 → todo 복사 → rebase 진행
//   4. reword 는 GIT_EDITOR 큐잉 대신 `exec git commit --amend -F <msgfile>` 로
//      대체 — 사후 메시지 변경 (단순/안정).
//
// MVP 액션 (`docs/plan/09 §4.5`): pick / drop / squash / fixup / reword.
//   - edit / exec 사용자 액션 은 v1.x.

use crate::error::{AppError, AppResult};
use crate::git::runner::{git_run, GitOutput, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tempfile::NamedTempFile;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum RebaseAction {
    Pick,
    Reword,
    Squash,
    Fixup,
    Drop,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RebaseTodoEntry {
    pub action: RebaseAction,
    pub sha: String,
    pub subject: String,
    /// reword 시 새 메시지 (다른 액션은 None).
    pub new_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RebaseStatus {
    pub in_progress: bool,
    pub current_step: Option<usize>,
    pub total_steps: Option<usize>,
    pub stopped_at: Option<String>,
    pub conflict: bool,
    pub head_name: Option<String>,
}

/// 마지막 N 개 commit 으로 todo 후보 생성 (모두 pick).
///
/// UI 가 받아서 사용자가 액션/순서/메시지 변경 후 `run_interactive` 호출.
/// 결과는 oldest → newest 순서 (rebase 의 todo 표준).
pub async fn prepare_todo(repo: &Path, count: usize) -> AppResult<Vec<RebaseTodoEntry>> {
    if count == 0 {
        return Err(AppError::validation("count 는 1 이상이어야 합니다."));
    }
    let n = format!("-n{count}");
    let out = git_run(
        repo,
        &["log", &n, "--pretty=%H%x1f%s", "--reverse"],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;

    let mut entries = Vec::new();
    for line in out.lines() {
        let mut parts = line.splitn(2, '\x1f');
        let sha = parts.next().unwrap_or("").trim();
        let subject = parts.next().unwrap_or("").to_string();
        if !sha.is_empty() {
            entries.push(RebaseTodoEntry {
                action: RebaseAction::Pick,
                sha: sha.to_string(),
                subject,
                new_message: None,
            });
        }
    }
    Ok(entries)
}

/// todo 의 entries 로 rebase -i 실행.
///
/// reword 가 있는 entry 는 `pick + exec git commit --amend -F <msgfile>` 패턴으로
/// 변환 — GIT_EDITOR 큐잉을 회피하면서 다중 reword 지원.
pub async fn run_interactive(
    repo: &Path,
    base: &str,
    todo: &[RebaseTodoEntry],
) -> AppResult<GitOutput> {
    run_interactive_internal(repo, base, todo, None).await
}

/// 테스트 / 고급 사용자용 — sequence editor 명령을 직접 주입.
///
/// `editor_template` 안의 `{TODO}` 는 우리가 만든 todo 임시 파일 경로 (forward-slash) 로
/// 치환됨. 테스트 환경에서는 main.rs 의 `--rebase-todo-helper` 분기를 거치지 않으므로
/// `sh -c 'cat "{TODO}" > "$0"'` 같은 대체 명령을 주입한다.
#[cfg(test)]
pub(crate) async fn run_interactive_with_editor(
    repo: &Path,
    base: &str,
    todo: &[RebaseTodoEntry],
    editor_template: String,
) -> AppResult<GitOutput> {
    run_interactive_internal(repo, base, todo, Some(editor_template)).await
}

async fn run_interactive_internal(
    repo: &Path,
    base: &str,
    todo: &[RebaseTodoEntry],
    override_editor: Option<String>,
) -> AppResult<GitOutput> {
    if todo.is_empty() {
        return Err(AppError::validation("todo 가 비어있습니다."));
    }
    if base.trim().is_empty() {
        return Err(AppError::validation("base 가 비어있습니다."));
    }

    // 1. reword 메시지 임시 파일들 (rebase 끝날 때까지 alive 유지).
    let mut msg_files: Vec<NamedTempFile> = Vec::new();

    // 2. todo 라인 빌드.
    let mut lines: Vec<String> = Vec::with_capacity(todo.len());
    for e in todo {
        match e.action {
            RebaseAction::Drop => {
                // git 은 todo 에서 빠진 commit 도 drop 으로 처리하지만, 명시적으로 적어둔다.
                lines.push(format!("drop {} {}", e.sha, e.subject));
            }
            RebaseAction::Pick => {
                lines.push(format!("pick {} {}", e.sha, e.subject));
            }
            RebaseAction::Squash => {
                lines.push(format!("squash {} {}", e.sha, e.subject));
            }
            RebaseAction::Fixup => {
                lines.push(format!("fixup {} {}", e.sha, e.subject));
            }
            RebaseAction::Reword => {
                let new_msg = e.new_message.as_deref().ok_or_else(|| {
                    AppError::validation(format!(
                        "reword 액션은 newMessage 가 필요합니다 (sha={})",
                        e.sha
                    ))
                })?;
                let mut tmp = NamedTempFile::new().map_err(AppError::Io)?;
                use std::io::Write;
                tmp.write_all(new_msg.as_bytes()).map_err(AppError::Io)?;
                tmp.flush().map_err(AppError::Io)?;
                let msg_path = path_for_shell(tmp.path());
                lines.push(format!("pick {} {}", e.sha, e.subject));
                lines.push(format!(
                    "exec git commit --amend -F \"{msg_path}\" --no-edit"
                ));
                msg_files.push(tmp);
            }
        }
    }
    let todo_str = lines.join("\n") + "\n";

    // 3. todo 임시 파일.
    let mut todo_file = NamedTempFile::new().map_err(AppError::Io)?;
    use std::io::Write;
    todo_file
        .write_all(todo_str.as_bytes())
        .map_err(AppError::Io)?;
    todo_file.flush().map_err(AppError::Io)?;

    // 4. sequence editor 명령 빌드.
    let todo_quoted = path_for_shell(todo_file.path());
    let sequence_editor = match override_editor {
        Some(template) => template.replace("{TODO}", &todo_quoted),
        None => {
            // production: 자기 자신 (helper binary) 호출.
            let exe = std::env::current_exe().map_err(AppError::Io)?;
            let exe_quoted = path_for_shell(&exe);
            // git 의 sequence.editor 는 sh -c 로 실행됨 → "..." 인용 필요.
            // 마지막에 git 이 todo 경로를 인자로 추가하므로 우리는 src 만 지정.
            format!("\"{exe_quoted}\" --rebase-todo-helper \"{todo_quoted}\"")
        }
    };

    // 5. rebase -i 실행.
    let opts = GitRunOpts {
        envs: vec![
            ("GIT_SEQUENCE_EDITOR".into(), sequence_editor),
            // reword 는 exec 로 처리하므로 GIT_EDITOR 호출은 squash 의 combined message
            // 한 가지뿐 — auto-generated 메시지를 그대로 사용 (true 가 즉시 0 종료).
            ("GIT_EDITOR".into(), "true".into()),
        ],
        ..Default::default()
    };
    let out = git_run(repo, &["rebase", "-i", base], &opts).await?;

    // todo_file / msg_files 는 여기까지 살아있다가 함수 종료 시 drop → 자동 삭제.
    drop(todo_file);
    drop(msg_files);
    Ok(out)
}

/// 경로를 sh-quote 가능한 형태로 변환 (Windows 백슬래시 → 슬래시).
fn path_for_shell(p: &Path) -> String {
    let s = p.to_string_lossy().into_owned();
    s.replace('\\', "/")
}

/// 현재 rebase 상태 조회 — `.git/rebase-merge` (interactive) 또는 `rebase-apply` (am).
pub fn status(repo: &Path) -> AppResult<RebaseStatus> {
    let merge_dir = repo.join(".git").join("rebase-merge");
    let apply_dir = repo.join(".git").join("rebase-apply");
    let in_progress = merge_dir.exists() || apply_dir.exists();
    if !in_progress {
        return Ok(RebaseStatus {
            in_progress: false,
            current_step: None,
            total_steps: None,
            stopped_at: None,
            conflict: false,
            head_name: None,
        });
    }
    let dir = if merge_dir.exists() {
        merge_dir
    } else {
        apply_dir
    };

    let read_trim = |f: &str| {
        std::fs::read_to_string(dir.join(f))
            .ok()
            .map(|s| s.trim().to_string())
    };

    let current_step = read_trim("msgnum").and_then(|s| s.parse::<usize>().ok());
    let total_steps = read_trim("end").and_then(|s| s.parse::<usize>().ok());
    let stopped_at = read_trim("stopped-sha");
    let head_name = read_trim("head-name").map(|s| {
        s.strip_prefix("refs/heads/")
            .unwrap_or(&s)
            .to_string()
    });

    // 충돌 여부 — MERGE_MSG 또는 stage entries (UU 등) 존재.
    let conflict = repo.join(".git").join("MERGE_MSG").exists()
        || dir.join("patch").exists() && stopped_at.is_some();

    Ok(RebaseStatus {
        in_progress: true,
        current_step,
        total_steps,
        stopped_at,
        conflict,
        head_name,
    })
}

pub async fn rebase_continue(repo: &Path) -> AppResult<GitOutput> {
    git_run(
        repo,
        &["rebase", "--continue"],
        &GitRunOpts {
            envs: vec![("GIT_EDITOR".into(), "true".into())],
            ..Default::default()
        },
    )
    .await
}

pub async fn rebase_abort(repo: &Path) -> AppResult<()> {
    git_run(repo, &["rebase", "--abort"], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

pub async fn rebase_skip(repo: &Path) -> AppResult<GitOutput> {
    git_run(
        repo,
        &["rebase", "--skip"],
        &GitRunOpts {
            envs: vec![("GIT_EDITOR".into(), "true".into())],
            ..Default::default()
        },
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::runner::git_run;

    async fn init_test_repo() -> (tempfile::TempDir, std::path::PathBuf) {
        let tmp = tempfile::TempDir::new().unwrap();
        let path = tmp.path().to_path_buf();
        git_run(&path, &["init", "-q", "-b", "main"], &Default::default())
            .await
            .unwrap()
            .into_ok()
            .unwrap();
        git_run(
            &path,
            &["config", "user.name", "테스트사용자"],
            &Default::default(),
        )
        .await
        .unwrap()
        .into_ok()
        .unwrap();
        git_run(
            &path,
            &["config", "user.email", "test@example.com"],
            &Default::default(),
        )
        .await
        .unwrap()
        .into_ok()
        .unwrap();
        // 글로벌 commit.gpgsign=true 가 켜진 환경에서도 테스트가 깨지지 않도록 강제 OFF.
        git_run(
            &path,
            &["config", "commit.gpgsign", "false"],
            &Default::default(),
        )
        .await
        .unwrap()
        .into_ok()
        .unwrap();
        (tmp, path)
    }

    async fn make_commit(path: &Path, file: &str, content: &str, msg: &str) {
        std::fs::write(path.join(file), content).unwrap();
        git_run(path, &["add", "."], &Default::default())
            .await
            .unwrap()
            .into_ok()
            .unwrap();
        git_run(path, &["commit", "-m", msg], &Default::default())
            .await
            .unwrap()
            .into_ok()
            .unwrap();
    }

    #[tokio::test]
    async fn test_prepare_todo_returns_oldest_first() {
        let (_tmp, path) = init_test_repo().await;
        make_commit(&path, "a.txt", "1\n", "feat: A").await;
        make_commit(&path, "b.txt", "2\n", "fix: B").await;
        make_commit(&path, "c.txt", "3\n", "chore: C").await;

        let todo = prepare_todo(&path, 3).await.unwrap();
        assert_eq!(todo.len(), 3);
        assert_eq!(todo[0].subject, "feat: A");
        assert_eq!(todo[1].subject, "fix: B");
        assert_eq!(todo[2].subject, "chore: C");
        assert!(todo.iter().all(|e| e.action == RebaseAction::Pick));
    }

    #[tokio::test]
    async fn test_status_clean_repo() {
        let (_tmp, path) = init_test_repo().await;
        let st = status(&path).unwrap();
        assert!(!st.in_progress);
        assert!(!st.conflict);
    }

    /// 테스트용 sh-based sequence editor — main.rs 의 helper 분기 우회.
    /// `git_run` 이 sh 를 통해 sequence.editor 를 실행하므로, sh -c 'cat src > $0' 로 todo 복사.
    fn test_editor_template() -> String {
        // git rebase 가 git-todo path 를 인자로 추가 → $0 = git-todo path.
        "sh -c 'cat \"{TODO}\" > \"$0\"'".to_string()
    }

    /// drop 액션이 commit 을 제거.
    #[tokio::test]
    async fn test_run_interactive_drop_removes_commit() {
        let (_tmp, path) = init_test_repo().await;
        make_commit(&path, "base.txt", "0\n", "init").await;
        make_commit(&path, "a.txt", "1\n", "feat: A").await;
        make_commit(&path, "b.txt", "2\n", "fix: B (드랍 대상)").await;
        make_commit(&path, "c.txt", "3\n", "chore: C").await;

        // 마지막 3개를 todo 로 — B 를 drop.
        let mut todo = prepare_todo(&path, 3).await.unwrap();
        assert_eq!(todo.len(), 3);
        assert!(todo[1].subject.contains("드랍 대상"));
        todo[1].action = RebaseAction::Drop;

        let out = run_interactive_with_editor(&path, "HEAD~3", &todo, test_editor_template())
            .await
            .unwrap();
        out.into_ok().unwrap();

        // log 확인 — B 는 빠지고 A, C 는 남아있어야 함 + 한글 메시지 안전.
        let log = git_run(&path, &["log", "--pretty=%s"], &Default::default())
            .await
            .unwrap()
            .into_ok()
            .unwrap();
        assert!(log.contains("feat: A"), "drop 후 A 는 살아야 함");
        assert!(log.contains("chore: C"), "drop 후 C 는 살아야 함");
        assert!(!log.contains("드랍 대상"), "B 가 drop 되어야 함");
    }

    /// reword 가 메시지를 한글로 교체.
    #[tokio::test]
    async fn test_run_interactive_reword_korean() {
        let (_tmp, path) = init_test_repo().await;
        make_commit(&path, "base.txt", "0\n", "init").await;
        make_commit(&path, "a.txt", "1\n", "feat: A original").await;
        make_commit(&path, "b.txt", "2\n", "fix: B").await;

        // 마지막 2개 — A 를 reword.
        let mut todo = prepare_todo(&path, 2).await.unwrap();
        assert_eq!(todo[0].subject, "feat: A original");
        todo[0].action = RebaseAction::Reword;
        todo[0].new_message = Some("feat: 한글 reword 적용\n\n본문도 한글.".into());

        let out = run_interactive_with_editor(&path, "HEAD~2", &todo, test_editor_template())
            .await
            .unwrap();
        out.into_ok().unwrap();

        let log = git_run(&path, &["log", "--pretty=%s%n%b%x1f"], &Default::default())
            .await
            .unwrap()
            .into_ok()
            .unwrap();
        assert!(
            log.contains("feat: 한글 reword 적용"),
            "reword 새 메시지 누락. log: {log}"
        );
        assert!(log.contains("본문도 한글"), "reword 본문 누락. log: {log}");
        assert!(!log.contains("A original"), "원래 메시지가 남아있음");
    }

    /// squash 가 두 commit 을 합침.
    #[tokio::test]
    async fn test_run_interactive_squash_combines() {
        let (_tmp, path) = init_test_repo().await;
        make_commit(&path, "base.txt", "0\n", "init").await;
        make_commit(&path, "a.txt", "1\n", "feat: A").await;
        make_commit(&path, "b.txt", "2\n", "feat: B (squash 대상)").await;

        // 마지막 2개 — B 를 squash (A 에 합침).
        let mut todo = prepare_todo(&path, 2).await.unwrap();
        todo[1].action = RebaseAction::Squash;

        let out = run_interactive_with_editor(&path, "HEAD~2", &todo, test_editor_template())
            .await
            .unwrap();
        out.into_ok().unwrap();

        // commit 1 개로 줄어들어야 함 (init 이후로).
        let log = git_run(
            &path,
            &["log", "--pretty=%s", "HEAD~1..HEAD"],
            &Default::default(),
        )
        .await
        .unwrap()
        .into_ok()
        .unwrap();
        let count = log.lines().filter(|l| !l.is_empty()).count();
        assert_eq!(count, 1, "squash 후 commit 1 개. log: {log}");

        // 새 commit 의 본문에 두 메시지 모두 포함 (auto-generated).
        let body = git_run(&path, &["log", "-1", "--pretty=%B"], &Default::default())
            .await
            .unwrap()
            .into_ok()
            .unwrap();
        assert!(body.contains("feat: A"));
        assert!(body.contains("feat: B"));
        // 그리고 두 파일 모두 working tree 에 존재 (squash 는 변경 보존).
        assert!(path.join("a.txt").exists());
        assert!(path.join("b.txt").exists());
    }
}
