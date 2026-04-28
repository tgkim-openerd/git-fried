// 두 ref 간 비교 — Sprint C3 (`docs/plan/14 §2 A1`, GitKraken §17 Branch "Compare").
//
// `git diff <ref1>..<ref2>` (patch) + `git log <ref1>..<ref2>` (commit list) +
// ahead/behind 카운트 (`git rev-list --left-right --count ref1...ref2`).

use crate::error::AppResult;
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareCommit {
    pub sha: String,
    pub author: String,
    pub author_at: i64,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareResult {
    /// `ref1..ref2` 의 커밋 (ref1 에 없는 것만).
    pub commits: Vec<CompareCommit>,
    /// `ref1..ref2` 의 patch text.
    pub diff: String,
    /// ref1 → ref2 차이 카운트 (left = ref1 only, right = ref2 only).
    pub left_count: u32,
    pub right_count: u32,
}

/// 두 ref 간 비교 — commits + diff + ahead/behind.
pub async fn compare_refs(repo: &Path, ref1: &str, ref2: &str) -> AppResult<CompareResult> {
    if ref1.trim().is_empty() || ref2.trim().is_empty() {
        return Err(crate::error::AppError::validation("ref 비어있음"));
    }

    let range = format!("{ref1}..{ref2}");
    // 1) commits — `git log ref1..ref2`
    // format: <sha>\t<author>\t<unix_ts>\t<summary>
    let log_out = git_run(
        repo,
        &[
            "log",
            "--pretty=format:%H\t%an\t%at\t%s",
            "--no-color",
            &range,
        ],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;

    let commits: Vec<CompareCommit> = log_out
        .lines()
        .filter_map(|line| {
            let mut parts = line.splitn(4, '\t');
            let sha = parts.next()?.to_string();
            let author = parts.next()?.to_string();
            let at: i64 = parts.next()?.parse().ok()?;
            let summary = parts.next().unwrap_or("").to_string();
            Some(CompareCommit {
                sha,
                author,
                author_at: at,
                summary,
            })
        })
        .collect();

    // 2) diff — `git diff ref1..ref2`
    let diff = git_run(
        repo,
        &["diff", "--no-color", &range],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;

    // 3) ahead/behind — `git rev-list --left-right --count ref1...ref2` (3 dot)
    let three_dot = format!("{ref1}...{ref2}");
    let counts_out = git_run(
        repo,
        &["rev-list", "--left-right", "--count", &three_dot],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;
    // 출력: "<left>\t<right>\n"
    let mut split = counts_out.split_whitespace();
    let left_count: u32 = split.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    let right_count: u32 = split.next().and_then(|s| s.parse().ok()).unwrap_or(0);

    Ok(CompareResult {
        commits,
        diff,
        left_count,
        right_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_compare_refs_empty_ref_errors() {
        let tmp = tempfile::TempDir::new().unwrap();
        let err = compare_refs(tmp.path(), "", "main").await;
        assert!(err.is_err());
        let err = compare_refs(tmp.path(), "main", "").await;
        assert!(err.is_err());
    }
}
