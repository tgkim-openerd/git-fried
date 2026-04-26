// 3-way merge — 충돌 파일 read / write 도우미.
//
// libgit2 의 index entry stage 별 내용:
//   - stage 1 = base (common ancestor)
//   - stage 2 = ours (current branch)
//   - stage 3 = theirs (incoming)
//   - stage 0 = resolved (충돌 해결 후)
//
// working tree 의 파일은 git 의 conflict marker (<<<<<<< / ======= / >>>>>>>) 포함.

use crate::error::{AppError, AppResult};
use crate::git::runner::{git_run, GitRunOpts};
use git2::Repository;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictedFile {
    pub path: String,
    /// 공통 조상 버전 (없을 수 있음 — add/add 충돌)
    pub base: Option<String>,
    /// 현재 브랜치 버전
    pub ours: Option<String>,
    /// 들어오는 버전
    pub theirs: Option<String>,
    /// working tree 버전 (충돌 마커 포함)
    pub working: Option<String>,
}

pub fn read_conflicted(path: &Path, file_path: &str) -> AppResult<ConflictedFile> {
    let repo = Repository::open(path).map_err(AppError::Git)?;
    let index = repo.index().map_err(AppError::Git)?;

    let mut base: Option<String> = None;
    let mut ours: Option<String> = None;
    let mut theirs: Option<String> = None;

    for entry in index.iter() {
        let entry_path = std::str::from_utf8(&entry.path).unwrap_or("");
        if entry_path != file_path {
            continue;
        }
        // stage 는 entry.flags 의 12~13 bit. git2 0.19 에 IndexEntry::stage() 함수가 없어
        // 직접 비트 연산으로 추출 (Git index 포맷 표준).
        let stage = (entry.flags >> 12) & 0x3;
        let blob = match repo.find_blob(entry.id) {
            Ok(b) => b,
            Err(_) => continue,
        };
        let content = String::from_utf8_lossy(blob.content()).into_owned();
        match stage {
            1 => base = Some(content),
            2 => ours = Some(content),
            3 => theirs = Some(content),
            _ => {}
        }
    }

    // working tree 파일 (conflict marker 포함)
    let wt_path = path.join(file_path);
    let working = std::fs::read_to_string(&wt_path).ok();

    Ok(ConflictedFile {
        path: file_path.to_string(),
        base,
        ours,
        theirs,
        working,
    })
}

/// 충돌 해결된 내용을 working tree 에 쓰고 stage 추가.
pub async fn write_resolved(
    path: &Path,
    file_path: &str,
    content: &str,
) -> AppResult<()> {
    let wt_path = path.join(file_path);
    if let Some(parent) = wt_path.parent() {
        std::fs::create_dir_all(parent).map_err(AppError::Io)?;
    }
    std::fs::write(&wt_path, content).map_err(AppError::Io)?;

    // git add <file> — index 에서 충돌 마커 제거 + stage 0 으로 등록
    git_run(path, &["add", "--", file_path], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

/// 충돌 해결을 포기하고 ours 또는 theirs 버전으로 덮어쓰기.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SideTake {
    Ours,
    Theirs,
}

pub async fn take_side(path: &Path, file_path: &str, side: SideTake) -> AppResult<()> {
    let arg = match side {
        SideTake::Ours => "--ours",
        SideTake::Theirs => "--theirs",
    };
    git_run(
        path,
        &["checkout", arg, "--", file_path],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;
    git_run(path, &["add", "--", file_path], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_test_repo() -> (tempfile::TempDir, std::path::PathBuf) {
        let tmp = tempfile::TempDir::new().unwrap();
        let path = tmp.path().to_path_buf();
        std::process::Command::new("git")
            .args(["init", "-q", "-b", "main"])
            .current_dir(&path)
            .status()
            .unwrap();
        std::process::Command::new("git")
            .args(["config", "user.name", "x"])
            .current_dir(&path)
            .status()
            .unwrap();
        std::process::Command::new("git")
            .args(["config", "user.email", "x@x"])
            .current_dir(&path)
            .status()
            .unwrap();
        (tmp, path)
    }

    #[tokio::test]
    async fn test_read_conflicted_returns_three_sides() {
        // 충돌 인위 생성: main 에서 a.txt 작성, feat 에서 다른 내용, merge → 충돌.
        let (_tmp, path) = make_test_repo();
        let cmds: &[&[&str]] = &[
            &["commit", "--allow-empty", "-m", "init"],
            &["checkout", "-b", "feat"],
        ];
        for c in cmds {
            std::process::Command::new("git")
                .args(*c)
                .current_dir(&path)
                .status()
                .unwrap();
        }
        std::fs::write(path.join("a.txt"), "feat 버전 한글\n").unwrap();
        std::process::Command::new("git")
            .args(["add", "."])
            .current_dir(&path)
            .status()
            .unwrap();
        std::process::Command::new("git")
            .args(["commit", "-m", "feat: a.txt"])
            .current_dir(&path)
            .status()
            .unwrap();
        std::process::Command::new("git")
            .args(["checkout", "main"])
            .current_dir(&path)
            .status()
            .unwrap();
        std::fs::write(path.join("a.txt"), "main 버전 한글\n").unwrap();
        std::process::Command::new("git")
            .args(["add", "."])
            .current_dir(&path)
            .status()
            .unwrap();
        std::process::Command::new("git")
            .args(["commit", "-m", "main: a.txt"])
            .current_dir(&path)
            .status()
            .unwrap();
        // 머지 시도 → 충돌
        let _ = std::process::Command::new("git")
            .args(["merge", "feat"])
            .current_dir(&path)
            .status();

        let cf = read_conflicted(&path, "a.txt").unwrap();
        // base 는 없음 (a.txt 가 양쪽에서 새로 생긴 add/add 충돌)
        assert_eq!(cf.path, "a.txt");
        assert!(cf.ours.is_some(), "ours 있어야 함");
        assert!(cf.theirs.is_some(), "theirs 있어야 함");
        assert!(cf.ours.as_ref().unwrap().contains("main"));
        assert!(cf.theirs.as_ref().unwrap().contains("feat"));
        assert!(cf.working.is_some());
        assert!(cf.working.as_ref().unwrap().contains("<<<<<<<"));
    }
}
