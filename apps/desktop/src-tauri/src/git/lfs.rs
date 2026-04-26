// Git LFS — list / status / fetch / pull / track / untrack.
//
// 사용자 회사 sub-repo 6/6 모두 LFS 사용 (`docs/plan/02 §3 W4`).
// git CLI 가 git-lfs 를 호출 (smudge/clean filter 자동).

use crate::error::AppResult;
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LfsFile {
    pub path: String,
    pub oid: String,
    /// LFS 객체가 로컬에 다운로드 됐는지.
    pub downloaded: bool,
    pub size: Option<u64>,
}

/// `git lfs ls-files --long` 파싱.
///
/// 형식 예: `<oid> <state> <path>`
///   - state: `*` = downloaded, `-` = pointer only.
pub async fn list_files(repo: &Path) -> AppResult<Vec<LfsFile>> {
    let out = git_run(
        repo,
        &["lfs", "ls-files", "--long"],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;

    let mut files = Vec::new();
    for line in out.lines() {
        // "1234567890abc... * path/to/file.png"
        let mut parts = line.splitn(3, ' ');
        let oid = match parts.next() {
            Some(s) => s.to_string(),
            None => continue,
        };
        let state = parts.next().unwrap_or("");
        let path = parts.next().unwrap_or("").to_string();
        if path.is_empty() {
            continue;
        }
        files.push(LfsFile {
            path,
            oid,
            downloaded: state == "*",
            size: None,
        });
    }
    Ok(files)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LfsStatus {
    pub installed: bool,
    pub version: Option<String>,
    pub tracked_patterns: Vec<String>,
}

pub async fn status(repo: &Path) -> AppResult<LfsStatus> {
    // version
    let v = git_run(repo, &["lfs", "version"], &GitRunOpts::default()).await;
    let installed = v.as_ref().map(|o| o.exit_code == Some(0)).unwrap_or(false);
    let version = v.ok().and_then(|o| o.into_ok().ok()).map(|s| s.trim().to_string());

    // tracked: `git lfs track` (인자 없음) 가 현재 패턴 출력
    let tracked = git_run(repo, &["lfs", "track"], &GitRunOpts::default()).await;
    let mut patterns: Vec<String> = Vec::new();
    if let Ok(o) = tracked {
        if let Ok(out) = o.into_ok() {
            for line in out.lines().skip(1) {
                // 형식: "    *.psd (.gitattributes)"
                let trimmed = line.trim();
                if let Some(idx) = trimmed.find(" (") {
                    patterns.push(trimmed[..idx].to_string());
                } else if !trimmed.is_empty() && !trimmed.starts_with("Listing") {
                    patterns.push(trimmed.to_string());
                }
            }
        }
    }

    Ok(LfsStatus {
        installed,
        version,
        tracked_patterns: patterns,
    })
}

pub async fn track(repo: &Path, pattern: &str) -> AppResult<()> {
    git_run(repo, &["lfs", "track", pattern], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

pub async fn untrack(repo: &Path, pattern: &str) -> AppResult<()> {
    git_run(repo, &["lfs", "untrack", pattern], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

pub async fn fetch(repo: &Path) -> AppResult<()> {
    git_run(repo, &["lfs", "fetch"], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

pub async fn pull(repo: &Path) -> AppResult<()> {
    git_run(repo, &["lfs", "pull"], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

pub async fn prune(repo: &Path) -> AppResult<()> {
    git_run(repo, &["lfs", "prune"], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LfsPushSize {
    /// 업스트림 대비 push 대상 commit 갯수 (`HEAD ^@{u}` 범위).
    pub commit_count: usize,
    /// 그 범위 안에서 신규/수정된 LFS 파일 갯수.
    pub file_count: usize,
    /// 합계 바이트 (LFS pointer 가 가리키는 실제 LFS object 크기).
    pub total_bytes: u64,
    /// upstream 미설정 등으로 측정 불가 시.
    pub note: Option<String>,
}

/// 업스트림 대비 push 시 보낼 LFS 객체의 총 크기 (Sprint C2).
///
/// GitKraken 미구현 (community 요청 미해결, `docs/plan/11 §12`). git-fried
/// 가 흡수 — 회사 LFS 6/6 사용자 시나리오 직격.
///
/// 알고리즘:
///   1. `git rev-list HEAD ^@{u}` → push 대상 commit 목록.
///   2. `git lfs ls-files --long --size --debug=false` 가 안전하지 않아
///      `git diff --name-only @{u}..HEAD` 로 변경 파일 추출.
///   3. 그 중 `git check-attr filter` 가 `lfs` 인 파일만 LFS 후보.
///   4. 각 파일의 `git cat-file blob :<path>` (HEAD 기준) → pointer 의 size 값.
///
/// upstream 미설정 시 ok=note 처리.
pub async fn push_size(repo: &Path) -> AppResult<LfsPushSize> {
    // 1. upstream 존재 확인.
    let upstream = git_run(
        repo,
        &["rev-parse", "--abbrev-ref", "@{u}"],
        &GitRunOpts::default(),
    )
    .await?;
    if upstream.exit_code != Some(0) {
        return Ok(LfsPushSize {
            commit_count: 0,
            file_count: 0,
            total_bytes: 0,
            note: Some("upstream 미설정 (브랜치 새로 생성됨)".into()),
        });
    }

    // 2. push 대상 commit 갯수.
    let count_out = git_run(
        repo,
        &["rev-list", "--count", "@{u}..HEAD"],
        &GitRunOpts::default(),
    )
    .await?;
    let commit_count: usize = count_out
        .into_ok()
        .ok()
        .and_then(|s| s.trim().parse::<usize>().ok())
        .unwrap_or(0);
    if commit_count == 0 {
        return Ok(LfsPushSize {
            commit_count: 0,
            file_count: 0,
            total_bytes: 0,
            note: Some("push 대상 commit 없음 (이미 동기화)".into()),
        });
    }

    // 3. 변경된 파일 목록 (added or modified, deleted 제외).
    let changed = git_run(
        repo,
        &["diff", "--name-only", "--diff-filter=AM", "@{u}..HEAD"],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()
    .unwrap_or_default();
    let files: Vec<String> = changed
        .lines()
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.to_string())
        .collect();
    if files.is_empty() {
        return Ok(LfsPushSize {
            commit_count,
            file_count: 0,
            total_bytes: 0,
            note: None,
        });
    }

    // 4. LFS 추적 파일만 필터 — `git check-attr filter <files>` 결과의 'lfs'.
    let mut check_args: Vec<String> = vec!["check-attr".into(), "filter".into(), "--".into()];
    for f in &files {
        check_args.push(f.clone());
    }
    let check_refs: Vec<&str> = check_args.iter().map(|s| s.as_str()).collect();
    let attr_out = git_run(repo, &check_refs, &GitRunOpts::default()).await?;
    let attr_text = attr_out.into_ok().unwrap_or_default();

    let mut lfs_files: Vec<String> = Vec::new();
    for line in attr_text.lines() {
        // "<path>: filter: lfs"
        if line.contains(": filter: lfs") {
            if let Some(idx) = line.rfind(": filter: lfs") {
                let p = &line[..idx];
                lfs_files.push(p.to_string());
            }
        }
    }
    if lfs_files.is_empty() {
        return Ok(LfsPushSize {
            commit_count,
            file_count: 0,
            total_bytes: 0,
            note: None,
        });
    }

    // 5. 각 LFS 파일의 pointer 에서 size 값 추출.
    //    pointer 형식: "version https://...\noid sha256:abc...\nsize 12345\n"
    let mut total: u64 = 0;
    for f in &lfs_files {
        // `git show :<file>` 가 staged 또는 HEAD 의 blob 출력. HEAD 가 우선.
        let blob = git_run(
            repo,
            &["show", &format!("HEAD:{f}")],
            &GitRunOpts::default(),
        )
        .await
        .ok()
        .and_then(|o| o.into_ok().ok())
        .unwrap_or_default();
        for line in blob.lines() {
            if let Some(rest) = line.strip_prefix("size ") {
                if let Ok(n) = rest.trim().parse::<u64>() {
                    total += n;
                    break;
                }
            }
        }
    }

    Ok(LfsPushSize {
        commit_count,
        file_count: lfs_files.len(),
        total_bytes: total,
        note: None,
    })
}
