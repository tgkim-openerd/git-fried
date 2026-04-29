// Sprint c30 / GitKraken UX (Phase 6b) — File raw content read.
//
// FullscreenDiffView 의 "File View" 토글 활성화용. 파일 내용 (특정 시점 또는 working dir)
// 을 raw text 로 읽어 frontend 에 반환.
//
// 동작:
//   rev = None  → working dir 의 파일 (fs::read_to_string)
//   rev = sha   → `git show <sha>:<path>` (그 시점의 파일)
//   isStaged    → `git show :<path>` (index 의 staged 버전)
//
// encoding:
//   git show 출력은 byte stream — encoding_rs 로 UTF-8 우선, 실패 시 GBK/CP949 폴백.
//   working dir 파일은 std::fs::read 후 동일 처리.

use crate::error::{AppError, AppResult};
use crate::git::runner::{git_run, GitRunOpts};
use std::path::Path;

const MAX_FILE_BYTES: usize = 4 * 1024 * 1024; // 4 MB cap (frontend memory + render)

fn decode_bytes(bytes: &[u8]) -> AppResult<String> {
    if bytes.is_empty() {
        return Ok(String::new());
    }
    let (cow, _, had_err) = encoding_rs::UTF_8.decode(bytes);
    if !had_err {
        return Ok(cow.into_owned());
    }
    // Fallback — CP949 / GBK (한글 환경 대비).
    let (cow2, _, _) = encoding_rs::GBK.decode(bytes);
    Ok(cow2.into_owned())
}

/// 파일 raw content 읽기.
///
/// path 는 repo root 기준 상대경로. 절대경로 / `..` traversal 방어.
pub async fn read_file(
    repo: &Path,
    path: &str,
    rev: Option<&str>,
    is_staged: bool,
) -> AppResult<String> {
    if path.trim().is_empty() {
        return Err(AppError::validation("파일 경로가 비었습니다."));
    }
    if path.contains("..") {
        return Err(AppError::validation(
            "상대경로 traversal (..) 은 허용되지 않습니다.",
        ));
    }

    // staged + rev 동시 지정 → rev 우선 (commit context 가 명확).
    if let Some(sha) = rev {
        let spec = format!("{sha}:{path}");
        let out = git_run(repo, &["show", &spec], &GitRunOpts::default())
            .await?
            .into_ok()?;
        return Ok(truncate_for_display(out));
    }

    if is_staged {
        let spec = format!(":{path}");
        let out = git_run(repo, &["show", &spec], &GitRunOpts::default())
            .await?
            .into_ok()?;
        return Ok(truncate_for_display(out));
    }

    // working dir read.
    let abs = repo.join(path);
    let bytes = std::fs::read(&abs)?;
    if bytes.len() > MAX_FILE_BYTES {
        return Err(AppError::validation(format!(
            "파일이 너무 큽니다 ({} bytes > {} cap). diff view 만 사용 가능.",
            bytes.len(),
            MAX_FILE_BYTES
        )));
    }
    decode_bytes(&bytes)
}

fn truncate_for_display(s: String) -> String {
    if s.len() <= MAX_FILE_BYTES {
        return s;
    }
    let mut t = s;
    t.truncate(MAX_FILE_BYTES);
    t.push_str("\n\n[... 파일이 cap (4MB) 초과 — 잘렸습니다. diff view 사용 권장.]");
    t
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn empty_path_errors() {
        let result = read_file(Path::new("/tmp"), "", None, false).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn traversal_path_errors() {
        let result = read_file(Path::new("/tmp"), "../etc/passwd", None, false).await;
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.to_string().contains("traversal"));
    }

    #[tokio::test]
    async fn nested_traversal_errors() {
        let result = read_file(Path::new("/tmp"), "src/../../../etc/passwd", None, false).await;
        assert!(result.is_err());
    }

    #[test]
    fn truncate_for_display_under_cap() {
        let s = "hello".to_string();
        assert_eq!(truncate_for_display(s.clone()), s);
    }

    #[test]
    fn decode_utf8_korean() {
        let bytes = "한글 파일 내용".as_bytes();
        let out = decode_bytes(bytes).expect("decode");
        assert_eq!(out, "한글 파일 내용");
    }

    #[test]
    fn decode_empty() {
        assert_eq!(decode_bytes(&[]).expect("decode"), "");
    }
}
