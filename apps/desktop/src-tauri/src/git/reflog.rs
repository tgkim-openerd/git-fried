// Reflog viewer — `.git/logs/HEAD` 또는 다른 ref 의 reflog 파싱.
//
// `git reflog` 출력 파싱이 가장 안정적.

use crate::error::AppResult;
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

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

pub async fn list_reflog(
    repo: &Path,
    ref_name: &str,
    limit: usize,
) -> AppResult<Vec<ReflogEntry>> {
    let limit_arg = format!("-n{limit}");
    // %H | %gd (HEAD@{0}) | %gs (subject) | %ct (committer time)
    let format = "--format=%H\x1f%gd\x1f%gs\x1f%ct";
    let out = git_run(
        repo,
        &["reflog", "--no-color", &limit_arg, format, ref_name],
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
