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
use crate::git::path::{decode_korean_safe, reject_dash_prefix, validate_repo_relative_path};
use crate::git::runner::{git_run, GitRunOpts};
use std::path::Path;

const MAX_FILE_BYTES: usize = 4 * 1024 * 1024; // 4 MB cap (frontend memory + render)

/// 파일 raw content → string. NFC 미적용 (content 의도 보존).
///
/// Sprint c34 — `git::path::decode_korean_safe(bytes, false)` 위임 (plan/27 단기 액션).
#[inline]
fn decode_bytes(bytes: &[u8]) -> AppResult<String> {
    Ok(decode_korean_safe(bytes, false))
}

/// 파일 raw content 읽기.
///
/// path 는 repo root 기준 상대경로. 절대경로 / `..` traversal / 심볼릭 링크 탈출 방어.
///
/// Sprint 2026-05-26 — CRIT-A 해소:
/// 기존 `..` 만 검사 + `repo.join(path)` 패턴은 path 가 절대경로면
/// `Path::join` 이 절대경로로 덮어쓰기 (Rust 표준 동작) → arbitrary read 가능.
/// 4단 가드: empty / absolute / `..` / canonicalize prefix.
pub async fn read_file(
    repo: &Path,
    path: &str,
    rev: Option<&str>,
    is_staged: bool,
) -> AppResult<String> {
    // git/path.rs::validate_repo_relative_path 로 4단 가드 일원화 (Codex Wave 1 review).
    let abs = validate_repo_relative_path(repo, path)?;

    // staged + rev 동시 지정 → rev 우선 (commit context 가 명확).
    // Codex Wave 1 #6 — `rev` 도 dash prefix 거부 (git show <rev>:<path> argv 인젝션 방어).
    if let Some(sha) = rev {
        let sha = reject_dash_prefix(sha, "rev")?;
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

    // Sprint 2026-05-26 — CRIT-A 회귀 가드.
    #[tokio::test]
    async fn absolute_unix_path_errors() {
        let result = read_file(Path::new("/tmp"), "/etc/passwd", None, false).await;
        assert!(result.is_err());
        let err = result.unwrap_err();
        let msg = err.to_string();
        // 절대경로 또는 루트 접두 메시지 둘 다 허용 (path 가 `/` 으로 시작하면 양쪽 가드 hit 가능).
        assert!(
            msg.contains("절대경로") || msg.contains("루트 접두"),
            "expected absolute/root prefix guard, got: {msg}"
        );
    }

    #[tokio::test]
    async fn absolute_windows_path_errors() {
        let result = read_file(
            Path::new("/tmp"),
            "C:\\Windows\\System32\\drivers\\etc\\hosts",
            None,
            false,
        )
        .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn unc_path_errors() {
        let result = read_file(
            Path::new("/tmp"),
            "\\\\server\\share\\secret.txt",
            None,
            false,
        )
        .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn root_slash_prefix_errors() {
        // POSIX 의 절대경로 (`/etc/passwd`) 이지만 Path::is_absolute 는 OS 별 분기.
        // 가드 3 (slash prefix) 가 backstop.
        let result = read_file(Path::new("/tmp"), "/etc/passwd", None, false).await;
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
