// 한글 안전 path / encoding helper — Sprint c34 plan/27 단기 액션 1.
//
// 이전: 동일 로직이 `git/runner.rs::decode_lossy`, `git/read_file.rs::decode_bytes`,
// `git/status.rs` 의 `.nfc()` 인라인 호출에 산재 (3 파일).
//
// 통합 후: 본 모듈이 단일 진입점.
//   - `decode_korean_safe(bytes, normalize)` — UTF-8 우선 + GBK/CP949 fallback (+ 옵션 NFC)
//   - `nfc_normalize(s)` — Vec<char> NFC collect (Windows NFD 회피)
//   - `nfc_normalize_path(s)` — alias (path 의도 명시)
//
// 호출자 패턴:
//   - git CLI stdout/stderr → `decode_korean_safe(bytes, true)` (NFC 적용, runner.rs 의 기존 동작)
//   - 파일 raw content → `decode_korean_safe(bytes, false)` (NFC X — 컨텐츠 보존)
//   - git2 반환 path → `nfc_normalize_path(p)` (Windows NFD → NFC)
//
// 차후 v1.x 시점에 별도 crate `git-korean-safe` 로 추출 후보 (plan/27 §2 결정).
use unicode_normalization::UnicodeNormalization;

/// 바이트 → UTF-8 lossy decode + (옵션) NFC 정규화.
///
/// 동작:
///   1. encoding_rs::UTF_8 우선 시도. 실패 (mojibake) 시 GBK/CP949 fallback (한글 환경).
///   2. `normalize=true` 면 NFC 정규화 (자모 분리 → 결합형).
///   3. 디코딩 실패 자모는 `\u{FFFD}` 대체 — 호출자가 mojibake 패턴 감지 가능.
///
/// 사용 위치:
///   - git CLI stdout/stderr (NFC 적용)
///   - 파일 raw content (NFC 미적용, content 보존)
pub fn decode_korean_safe(bytes: &[u8], normalize: bool) -> String {
    if bytes.is_empty() {
        return String::new();
    }
    let (cow, _, had_errors) = encoding_rs::UTF_8.decode(bytes);
    let s: String = if had_errors {
        // UTF-8 강제 환경변수에도 mojibake 발생 시 GBK/CP949 fallback.
        let (cow2, _, _) = encoding_rs::GBK.decode(bytes);
        cow2.into_owned()
    } else {
        cow.into_owned()
    };
    if normalize {
        s.nfc().collect::<String>()
    } else {
        s
    }
}

/// `&str` → NFC 정규화된 `String`.
///
/// Windows 파일 시스템이 NFD 로 자모를 분리하는 경우 (드물지만 macOS HFS+ 호환 / OneDrive 등)
/// NFC 결합형으로 통일. 단순 ASCII 는 무영향.
pub fn nfc_normalize(s: &str) -> String {
    s.nfc().collect()
}

/// path 의도 명시용 alias. 동작은 `nfc_normalize` 와 동일.
///
/// git2 의 `entry.path()` / `tree_entry.name()` 등이 NFD 로 반환되는 경우 NFC 로 통일.
#[inline]
pub fn nfc_normalize_path(s: &str) -> String {
    nfc_normalize(s)
}

/// Sprint 2026-05-26 — CRIT-A / CRITICAL #1 (Codex Wave 1) 공통 가드.
///
/// `repo` 기준 상대경로 `path` 를 검증한 후 join 한 absolute path 를 반환.
/// 4단 가드: empty / `..` / 절대경로 / `/` 또는 `\` prefix.
/// 추가: 파일이 존재하면 canonicalize 후 repo prefix 확인 (심볼릭 링크 탈출 방어).
///
/// **호출처**: git/read_file.rs (CRIT-A), git/merge.rs (read_conflicted/write_resolved).
pub fn validate_repo_relative_path(
    repo: &std::path::Path,
    path: &str,
) -> crate::error::AppResult<std::path::PathBuf> {
    use crate::error::AppError;
    if path.trim().is_empty() {
        return Err(AppError::validation("파일 경로가 비었습니다."));
    }
    if path.contains("..") {
        return Err(AppError::validation(
            "상대경로 traversal (..) 은 허용되지 않습니다.",
        ));
    }
    let p = std::path::Path::new(path);
    if p.is_absolute() {
        return Err(AppError::validation(
            "절대경로는 허용되지 않습니다 — repo root 기준 상대경로만 가능합니다.",
        ));
    }
    if path.starts_with('\\') || path.starts_with('/') {
        return Err(AppError::validation("루트 접두 경로는 허용되지 않습니다."));
    }
    let abs = repo.join(path);
    // 파일이 존재할 때만 canonicalize 후 prefix 확인. 미존재 파일은 caller 의 IO error 가
    // 정상 흐름 (예: write_resolved 가 새 파일 생성하는 경우).
    if abs.exists() {
        let canonical_file = abs.canonicalize().map_err(AppError::Io)?;
        let canonical_repo = repo.canonicalize().map_err(AppError::Io)?;
        if !canonical_file.starts_with(&canonical_repo) {
            return Err(AppError::validation(
                "파일이 repo root 외부를 가리킵니다 (심볼릭 링크 탈출 의심).",
            ));
        }
    }
    Ok(abs)
}

/// `-` prefix 입력을 거부하는 가드 — git CLI 인자 인젝션 (CWE-88) 방어용.
///
/// **목적**: 사용자가 제공하는 branch / remote / tag / ref / file path 를 git CLI 에
/// 그대로 전달할 때, `-D`, `--quiet`, `--upload-pack=...` 같이 옵션처럼 해석되는
/// 입력을 차단. defense-in-depth 로 호출처에서 `--end-of-options` 도 함께 사용.
///
/// 실사례 (`stash_to_branch`, `range_diff` Sprint c38) 표준화 — Sprint c40 후속
/// review 에서 branch / remote / clone / config_local / importer 8 영역 일괄 적용.
///
/// CVE-2017-1000117 (`ssh://-oProxyCommand=...`) 같이 URL 자체가 옵션 인젝션 시
/// 추가 prefix 검증은 protocol allowlist (`https`, `http`, `ssh`, `git@`) 가 책임.
pub fn reject_dash_prefix<'a>(value: &'a str, label: &str) -> crate::error::AppResult<&'a str> {
    let trimmed = value.trim();
    if trimmed.starts_with('-') {
        return Err(crate::error::AppError::validation(format!(
            "{label} 은 '-' 로 시작할 수 없습니다: {trimmed}"
        )));
    }
    Ok(trimmed)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// UTF-8 한글 정상 디코드 (가장 일반).
    #[test]
    fn utf8_korean_with_normalize() {
        assert_eq!(
            decode_korean_safe("커밋 메시지".as_bytes(), true),
            "커밋 메시지"
        );
    }

    #[test]
    fn utf8_korean_without_normalize() {
        assert_eq!(
            decode_korean_safe("커밋 메시지".as_bytes(), false),
            "커밋 메시지"
        );
    }

    /// 빈 byte slice → 빈 string.
    #[test]
    fn empty_bytes() {
        assert_eq!(decode_korean_safe(&[], true), "");
        assert_eq!(decode_korean_safe(&[], false), "");
    }

    /// ASCII 무영향 (NFC normalize 도 noop).
    #[test]
    fn ascii_passthrough() {
        let bytes = b"git --version";
        assert_eq!(decode_korean_safe(bytes, true), "git --version");
        assert_eq!(decode_korean_safe(bytes, false), "git --version");
    }

    /// NFD 분리 자모 → NFC 결합형.
    #[test]
    fn nfd_to_nfc_normalize() {
        // \u{1112}=ᄒ, \u{1161}=ᅡ, \u{11AB}=ᆫ, \u{1100}=ᄀ, \u{1173}=ᅳ, \u{11AF}=ᆯ
        let nfd = "\u{1112}\u{1161}\u{11AB}\u{1100}\u{1173}\u{11AF}";
        assert_eq!(decode_korean_safe(nfd.as_bytes(), true), "한글");
    }

    /// normalize=false 면 NFD 보존 (파일 content 의도).
    #[test]
    fn nfd_preserved_when_no_normalize() {
        let nfd = "\u{1112}\u{1161}\u{11AB}";
        let s = decode_korean_safe(nfd.as_bytes(), false);
        // 분리형 그대로 (NFC 가 안 됨).
        assert_ne!(s, "한");
        assert_eq!(s.chars().count(), 3);
    }

    /// 한글 + ASCII mixed.
    #[test]
    fn mixed_korean_ascii() {
        assert_eq!(
            decode_korean_safe("[chore] 한글 메시지".as_bytes(), true),
            "[chore] 한글 메시지"
        );
    }

    /// nfc_normalize helper 단독.
    #[test]
    fn nfc_normalize_helper() {
        let nfd = "\u{1112}\u{1161}\u{11AB}";
        assert_eq!(nfc_normalize(nfd), "한");
    }

    /// nfc_normalize_path alias 검증.
    #[test]
    fn nfc_normalize_path_alias() {
        let nfd_path = "src/\u{1112}\u{1161}\u{11AB}.txt";
        assert_eq!(nfc_normalize_path(nfd_path), "src/한.txt");
    }

    /// 한국어 파일명 — NFD git2 출력 시뮬레이션.
    #[test]
    fn nfc_normalize_path_realistic() {
        let nfd_path = "docs/\u{1100}\u{1173}\u{11AF}_\u{1112}\u{1161}\u{11AB}.md";
        let nfc = nfc_normalize_path(nfd_path);
        assert_eq!(nfc, "docs/글_한.md");
    }

    /// 디코딩 실패 (잘못된 byte sequence) → fallback 동작.
    #[test]
    fn invalid_bytes_fallback() {
        // 0xFF 0xFE 는 UTF-8 invalid → GBK fallback 또는 \u{FFFD}.
        let bytes = vec![0xFF, 0xFE, b'a', b'b'];
        let s = decode_korean_safe(&bytes, true);
        // 비어있지 않고 panic 안 함.
        assert!(!s.is_empty());
    }

    // ====== reject_dash_prefix (Sprint c40 후속 review SEC-001~005,007) ======

    #[test]
    fn reject_dash_prefix_normal_branch_name_ok() {
        assert_eq!(
            reject_dash_prefix("feature/foo", "branch").unwrap(),
            "feature/foo"
        );
        assert_eq!(reject_dash_prefix("main", "branch").unwrap(), "main");
        assert_eq!(
            reject_dash_prefix("release-1.0", "branch").unwrap(),
            "release-1.0"
        );
    }

    #[test]
    fn reject_dash_prefix_blocks_dash_start() {
        assert!(reject_dash_prefix("-D", "branch").is_err());
        assert!(reject_dash_prefix("--quiet", "remote").is_err());
        assert!(reject_dash_prefix("--upload-pack=evil", "url").is_err());
    }

    #[test]
    fn reject_dash_prefix_trims_whitespace() {
        // 앞뒤 공백 포함도 거부 (trim 후 - 검사).
        assert!(reject_dash_prefix("  -D  ", "branch").is_err());
        assert_eq!(reject_dash_prefix("  main  ", "branch").unwrap(), "main");
    }
}
