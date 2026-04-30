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
}
