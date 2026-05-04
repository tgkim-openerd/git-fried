// `git range-diff` wrapper — Sprint c38 / plan/29 E2 (Range Diff Panel).
//
// rebase 또는 PR 업데이트 후 patch series 비교.
// `git range-diff base..tip1 base..tip2` 또는 `git range-diff A...B` (자동 base).
//
// porcelain output 형식 (Git docs § "git range-diff"):
//   <left-idx>:  <left-sha> <op> <right-idx>:  <right-sha> <subject>
//
//   op:
//     '='  — 같음 (matched)
//     '!'  — 변경됨 (matched but content differs) → 이어 inter-diff body
//     '>'  — 우측만 (added)
//     '<'  — 좌측만 (removed)
//
//   `<left-idx>` 또는 `<right-idx>` 가 매칭 없으면 `-`, sha 도 `-`.
//
// 본 파서는 안정 영역 (마커 + index + sha + subject + inter-diff body) 만 사용.
// 의문스러운 출력은 status="?" 로 fallback (renderer 가 raw 표시).

use crate::error::{AppError, AppResult};
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RangeDiffEntry {
    /// "=" / "!" / ">" / "<" / "?" (unknown).
    pub status: String,
    /// 좌측 시리즈에서의 위치 (1-based). 없으면 None.
    pub left_index: Option<u32>,
    /// 우측 시리즈에서의 위치 (1-based). 없으면 None.
    pub right_index: Option<u32>,
    /// 좌측 commit SHA (축약). 없으면 None.
    pub left_sha: Option<String>,
    /// 우측 commit SHA (축약). 없으면 None.
    pub right_sha: Option<String>,
    /// 한 줄 subject.
    pub summary: String,
    /// status="!" 시 inter-diff (patch body). 그 외 None.
    pub patch_diff: Option<String>,
}

/// `git range-diff <range1> <range2>` 실행 + porcelain 파싱.
///
/// `range1` / `range2` 는 보통 `base..tip` 형태. base 가 같으면 `git range-diff base..t1 base..t2`.
/// 양쪽 모두 비어있으면 validation 에러.
pub async fn range_diff(repo: &Path, range1: &str, range2: &str) -> AppResult<Vec<RangeDiffEntry>> {
    if range1.trim().is_empty() || range2.trim().is_empty() {
        return Err(AppError::validation("range-diff: range 가 비어있습니다."));
    }
    let out = git_run(
        repo,
        &["range-diff", "--no-color", range1, range2],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;
    Ok(parse_range_diff(&out))
}

/// `git range-diff A...B` (3-dot, auto merge-base) 형태 호출.
pub async fn range_diff_auto(
    repo: &Path,
    rev1: &str,
    rev2: &str,
) -> AppResult<Vec<RangeDiffEntry>> {
    if rev1.trim().is_empty() || rev2.trim().is_empty() {
        return Err(AppError::validation("range-diff: rev 가 비어있습니다."));
    }
    let three_dot = format!("{}...{}", rev1.trim(), rev2.trim());
    let out = git_run(
        repo,
        &["range-diff", "--no-color", &three_dot],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;
    Ok(parse_range_diff(&out))
}

/// porcelain output → entry list 파싱.
///
/// 헤더 라인 검출: `<idx|->:  <sha|-> <op> <idx|->:  <sha|-> <subject>`.
/// 본 함수는 op 가 4종 (=, !, <, >) 인 경우만 entry 로 인정.
/// `!` 의 경우 다음 entry 헤더 전까지의 라인을 inter-diff 로 누적.
pub fn parse_range_diff(text: &str) -> Vec<RangeDiffEntry> {
    let mut out: Vec<RangeDiffEntry> = Vec::new();
    let mut current_patch: Option<String> = None;

    for line in text.lines() {
        if let Some(entry) = parse_header_line(line) {
            // 직전 entry 에 누적된 patch_diff finalize.
            if let (Some(prev), Some(patch)) = (out.last_mut(), current_patch.take()) {
                if prev.status == "!" {
                    prev.patch_diff = Some(patch);
                }
            }
            // status="!" 이면 다음 라인부터 patch 누적 시작.
            if entry.status == "!" {
                current_patch = Some(String::new());
            }
            out.push(entry);
        } else if let Some(buf) = current_patch.as_mut() {
            // ! entry 의 inter-diff body. range-diff 는 body 라인을 4-space 들여쓰기 함.
            buf.push_str(line);
            buf.push('\n');
        }
        // 헤더도 patch buf 도 아니면 무시 (preamble 등).
    }
    // 마지막 entry finalize.
    if let (Some(prev), Some(patch)) = (out.last_mut(), current_patch.take()) {
        if prev.status == "!" {
            prev.patch_diff = Some(patch);
        }
    }
    out
}

/// 단일 라인이 range-diff header 면 RangeDiffEntry 반환.
///
/// 예시 라인:
///   `1:  abc1234 = 1:  def5678 commit subject`
///   `-:  -       > 2:  ghi9abc only on right`
///   `3:  mno1234 < -:  -       only on left`
///   `4:  pqr5678 ! 4:  stu9012 changed subject`
fn parse_header_line(line: &str) -> Option<RangeDiffEntry> {
    let trimmed = line.trim_start();
    // 빠른 거부: 너무 짧거나 들여쓰기 깊으면 본문 (inter-diff).
    if trimmed.len() < 7 {
        return None;
    }
    if line.starts_with("    ") {
        return None;
    }

    // Tokenize by whitespace. range-diff 출력은 패딩 공백이 들어갈 수 있으므로
    // split_whitespace 로 토큰만 추출 후 5 개를 매칭, 나머지는 subject.
    let tokens: Vec<&str> = trimmed.split_whitespace().collect();
    if tokens.len() < 6 {
        return None;
    }
    let left_idx_tok = tokens[0];
    let left_sha_tok = tokens[1];
    let op_tok = tokens[2];
    let right_idx_tok = tokens[3];
    let right_sha_tok = tokens[4];
    let summary = tokens[5..].join(" ");

    // left_idx / right_idx 는 `<n>:` 또는 `-:` 형태. 콜론 제거.
    let left_idx = parse_idx_token(left_idx_tok)?;
    let right_idx = parse_idx_token(right_idx_tok)?;

    // op 는 정확히 1자 = / ! / > / < 만.
    let op = match op_tok {
        "=" | "!" | ">" | "<" => op_tok.to_string(),
        _ => return None,
    };

    let left_sha = parse_sha_token(left_sha_tok);
    let right_sha = parse_sha_token(right_sha_tok);

    // op 와 idx 가 모순이면 거부 (헤더 false-positive 방어).
    match op.as_str() {
        ">" => {
            // 좌측은 비어있어야 함.
            if left_idx.is_some() || left_sha.is_some() {
                return None;
            }
        }
        "<" => {
            if right_idx.is_some() || right_sha.is_some() {
                return None;
            }
        }
        _ => {}
    }

    Some(RangeDiffEntry {
        status: op,
        left_index: left_idx,
        right_index: right_idx,
        left_sha,
        right_sha,
        summary,
        patch_diff: None,
    })
}

/// `<n>:` → Some(n), `-:` → None, 그 외 → 거부 (헤더 아님).
fn parse_idx_token(tok: &str) -> Option<Option<u32>> {
    let s = tok.strip_suffix(':')?;
    if s == "-" {
        return Some(None);
    }
    s.parse::<u32>().ok().map(Some)
}

/// `<sha>` 또는 `-` → Option<String>.
fn parse_sha_token(tok: &str) -> Option<String> {
    if tok == "-" {
        return None;
    }
    // 7+ 자리 hex 만 (range-diff 의 SHA 는 short hash).
    if tok.len() < 4 || !tok.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    Some(tok.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 헤더 4종 모두 파싱.
    #[test]
    fn test_parse_header_all_status() {
        let eq = parse_header_line("1:  abc1234 = 1:  def5678 commit unchanged").unwrap();
        assert_eq!(eq.status, "=");
        assert_eq!(eq.left_index, Some(1));
        assert_eq!(eq.right_index, Some(1));
        assert_eq!(eq.left_sha.as_deref(), Some("abc1234"));
        assert_eq!(eq.right_sha.as_deref(), Some("def5678"));
        assert_eq!(eq.summary, "commit unchanged");

        let bang = parse_header_line("4:  pqr5678 ! 4:  stu9012 changed subject 한글").unwrap();
        assert_eq!(bang.status, "!");
        assert_eq!(bang.summary, "changed subject 한글");

        let added = parse_header_line("-:  -       > 2:  ghi9abc only on right").unwrap();
        assert_eq!(added.status, ">");
        assert_eq!(added.left_index, None);
        assert_eq!(added.left_sha, None);
        assert_eq!(added.right_index, Some(2));

        let removed = parse_header_line("3:  mno1234 < -:  -       only on left").unwrap();
        assert_eq!(removed.status, "<");
        assert_eq!(removed.right_index, None);
        assert_eq!(removed.right_sha, None);
    }

    /// 헤더가 아닌 라인은 None.
    #[test]
    fn test_parse_header_rejects_non_header() {
        assert!(parse_header_line("    @@ -1,3 +1,3 @@").is_none());
        assert!(parse_header_line("preamble line").is_none());
        assert!(parse_header_line("").is_none());
        // op 가 잘못된 형태.
        assert!(parse_header_line("1:  abc1234 ? 1:  def5678 wrong op").is_none());
        // op 와 idx 모순 — > 인데 left 가 있음.
        assert!(parse_header_line("1:  abc1234 > 2:  def5678 contradictory").is_none());
    }

    /// 전체 output 파싱 — entries + inter-diff body.
    #[test]
    fn test_parse_range_diff_with_inter_diff_body() {
        let sample = "\
1:  abc1234 = 1:  def5678 first commit
2:  ghi9abc ! 2:  jkl0def changed second
    @@ -1,3 +1,3 @@
    -old line
    +new line
3:  mno1234 < -:  -       removed third
-:  -       > 3:  pqr5678 added new
";
        let entries = parse_range_diff(sample);
        assert_eq!(entries.len(), 4);

        assert_eq!(entries[0].status, "=");
        assert_eq!(entries[0].patch_diff, None);

        assert_eq!(entries[1].status, "!");
        let body = entries[1].patch_diff.as_deref().unwrap();
        assert!(body.contains("@@ -1,3 +1,3 @@"));
        assert!(body.contains("-old line"));
        assert!(body.contains("+new line"));

        assert_eq!(entries[2].status, "<");
        assert_eq!(entries[2].right_index, None);

        assert_eq!(entries[3].status, ">");
        assert_eq!(entries[3].left_index, None);
    }

    /// 빈 range 는 validation 에러.
    #[tokio::test]
    async fn test_range_diff_empty_range_errors() {
        let tmp = tempfile::TempDir::new().unwrap();
        let err = range_diff(tmp.path(), "", "main..feature")
            .await
            .unwrap_err();
        assert_eq!(err.kind(), "validation");
        let err2 = range_diff(tmp.path(), "main..feature", "  ")
            .await
            .unwrap_err();
        assert_eq!(err2.kind(), "validation");
    }

    /// camelCase serde — leftIndex / rightSha / patchDiff round-trip.
    #[test]
    fn test_range_diff_entry_serde() {
        let e = RangeDiffEntry {
            status: "!".to_string(),
            left_index: Some(2),
            right_index: Some(2),
            left_sha: Some("abc1234".to_string()),
            right_sha: Some("def5678".to_string()),
            summary: "한글 변경 subject".to_string(),
            patch_diff: Some("@@ ... @@\n+한글\n".to_string()),
        };
        let json = serde_json::to_string(&e).unwrap();
        assert!(json.contains("\"leftIndex\":2"));
        assert!(json.contains("\"rightSha\":\"def5678\""));
        assert!(json.contains("\"patchDiff\""));
        assert!(json.contains("한글 변경 subject"));
    }
}
