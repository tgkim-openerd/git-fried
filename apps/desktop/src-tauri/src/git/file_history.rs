// 파일 단위 history + blame.
//
// 둘 다 git CLI shell-out:
//   - history: `git log --follow <path>` (rename 추적)
//   - blame: `git blame --porcelain <path>` (이름 변경 정확)
//
// libgit2 의 blame 은 30배+ 느린 케이스 보고 → CLI 가 정답.

use crate::error::{AppError, AppResult};
use crate::git::repository::CommitSummary;
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// 파일의 commit history (rename 추적 포함).
pub async fn file_history(repo: &Path, path: &str, limit: usize) -> AppResult<Vec<CommitSummary>> {
    if path.trim().is_empty() {
        return Err(AppError::validation("파일 경로가 비었습니다."));
    }
    // %H | %P | %an | %ae | %at | %ct | %s | %b | %G? — null byte 로 구분.
    // 본문이 길어지므로 record separator 0x1e 사용.
    let limit_arg = format!("-n{limit}");
    let format_arg = "--pretty=format:%H\x1f%P\x1f%an\x1f%ae\x1f%at\x1f%ct\x1f%G?\x1f%s\x1f%b\x1e";
    let out = git_run(
        repo,
        &[
            "log",
            "--follow",
            "--no-color",
            &limit_arg,
            format_arg,
            "--",
            path,
        ],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;

    let mut out_vec = Vec::new();
    for record in out.split('\x1e') {
        let r = record.trim_start_matches('\n');
        if r.trim().is_empty() {
            continue;
        }
        let f: Vec<&str> = r.splitn(9, '\x1f').collect();
        if f.len() < 9 {
            continue;
        }
        let parent_shas: Vec<String> = f[1].split_whitespace().map(|s| s.to_string()).collect();
        out_vec.push(CommitSummary {
            sha: f[0].to_string(),
            short_sha: f[0].chars().take(7).collect(),
            parent_shas,
            author_name: f[2].to_string(),
            author_email: f[3].to_string(),
            author_at: f[4].parse().unwrap_or(0),
            committer_at: f[5].parse().unwrap_or(0),
            // %G? : G(ood), B(ad), U(nknown), N(o sig). G/B/U 는 sig 존재.
            signed: f[6] != "N" && !f[6].is_empty(),
            subject: f[7].to_string(),
            body: f[8].trim_end_matches('\n').to_string(),
            refs: vec![],
        });
    }
    Ok(out_vec)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlameLine {
    pub sha: String,
    pub short_sha: String,
    pub author_name: String,
    pub author_at: i64,
    pub summary: String,
    pub original_line: u32,
    pub final_line: u32,
    pub content: String,
}

/// 파일의 blame (line-by-line 작성자 + sha).
///
/// `git blame --porcelain` 출력 파싱.
/// 첫 commit 헤더 + author/summary 메타 + content line 의 반복.
pub async fn file_blame(repo: &Path, path: &str) -> AppResult<Vec<BlameLine>> {
    if path.trim().is_empty() {
        return Err(AppError::validation("파일 경로가 비었습니다."));
    }
    let out = git_run(
        repo,
        &["blame", "--porcelain", "--no-color", "--", path],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;

    parse_blame_porcelain(&out)
}

fn parse_blame_porcelain(input: &str) -> AppResult<Vec<BlameLine>> {
    use std::collections::HashMap;

    let mut lines = input.lines().peekable();
    // sha → (author, author_at, summary)
    let mut commit_meta: HashMap<String, (String, i64, String)> = HashMap::new();
    let mut current_sha = String::new();
    let mut current_author = String::new();
    let mut current_at: i64 = 0;
    let mut current_summary = String::new();
    let mut current_orig: u32 = 0;
    let mut current_final: u32 = 0;

    let mut out = Vec::new();

    while let Some(line) = lines.next() {
        if let Some(first) = line.chars().next() {
            // SHA header line: "<40-hex> <orig> <final> [<group>]"
            if first.is_ascii_hexdigit() && line.len() >= 40 {
                let parts: Vec<&str> = line.splitn(4, ' ').collect();
                if parts.len() >= 3 && parts[0].len() == 40 {
                    current_sha = parts[0].to_string();
                    current_orig = parts[1].parse().unwrap_or(0);
                    current_final = parts[2].parse().unwrap_or(0);

                    // 이미 본 sha 면 메타 재사용
                    if let Some((a, at, s)) = commit_meta.get(&current_sha) {
                        current_author = a.clone();
                        current_at = *at;
                        current_summary = s.clone();
                    } else {
                        // 다음 헤더 라인들 파싱 (author / committer-time / summary / ...)
                        while let Some(next) = lines.peek() {
                            if next.starts_with('\t') {
                                break;
                            }
                            let h = lines.next().unwrap();
                            if let Some(rest) = h.strip_prefix("author ") {
                                current_author = rest.to_string();
                            } else if let Some(rest) = h.strip_prefix("author-time ") {
                                current_at = rest.parse().unwrap_or(0);
                            } else if let Some(rest) = h.strip_prefix("summary ") {
                                current_summary = rest.to_string();
                            }
                            // 그 외 헤더 (committer / boundary / previous / filename) 무시
                        }
                        commit_meta.insert(
                            current_sha.clone(),
                            (current_author.clone(), current_at, current_summary.clone()),
                        );
                    }
                    continue;
                }
            }
            // content line: '\t' 로 시작
            if first == '\t' {
                let content = line.trim_start_matches('\t').to_string();
                out.push(BlameLine {
                    short_sha: current_sha.chars().take(7).collect(),
                    sha: current_sha.clone(),
                    author_name: current_author.clone(),
                    author_at: current_at,
                    summary: current_summary.clone(),
                    original_line: current_orig,
                    final_line: current_final,
                    content,
                });
            }
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_blame_porcelain_minimal() {
        let porcelain = concat!(
            "abcdef1234567890abcdef1234567890abcdef12 1 1 1\n",
            "author tgkim\n",
            "author-mail <oharapass@gmail.com>\n",
            "author-time 1700000000\n",
            "author-tz +0900\n",
            "committer tgkim\n",
            "committer-mail <oharapass@gmail.com>\n",
            "committer-time 1700000000\n",
            "summary feat: 첫 줄 추가\n",
            "filename a.txt\n",
            "\thello world\n",
        );
        let parsed = parse_blame_porcelain(porcelain).unwrap();
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].sha, "abcdef1234567890abcdef1234567890abcdef12");
        assert_eq!(parsed[0].author_name, "tgkim");
        assert_eq!(parsed[0].summary, "feat: 첫 줄 추가");
        assert_eq!(parsed[0].content, "hello world");
        assert_eq!(parsed[0].final_line, 1);
    }

    #[test]
    fn test_parse_blame_porcelain_reuse_meta() {
        // 같은 sha 가 여러 번 나오면 두 번째부터 author/summary 헤더 생략됨.
        let porcelain = concat!(
            "abcdef1234567890abcdef1234567890abcdef12 1 1 2\n",
            "author tgkim\n",
            "author-time 1700000000\n",
            "summary feat: 추가\n",
            "filename a.txt\n",
            "\tline1\n",
            "abcdef1234567890abcdef1234567890abcdef12 2 2\n",
            "\tline2\n",
        );
        let parsed = parse_blame_porcelain(porcelain).unwrap();
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].author_name, "tgkim");
        assert_eq!(parsed[1].author_name, "tgkim"); // 메타 재사용
        assert_eq!(parsed[1].summary, "feat: 추가");
        assert_eq!(parsed[1].content, "line2");
    }
}
