// Sprint c45 SEC-2/SEC-1 — 공용 secret 마스킹.
//
// AI prompt 송출 + GitCli stderr 직렬화 양쪽에서 사용.
// 패턴 추가 시 본 파일만 수정 → 자동 양쪽 적용.

use once_cell::sync::Lazy;
use regex::Regex;

static SECRET_PATTERNS: Lazy<Vec<Regex>> = Lazy::new(|| {
    vec![
        // GitHub PAT (classic + fine-grained)
        Regex::new(r"\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b").unwrap(),
        // GitLab PAT
        Regex::new(r"\bglpat-[A-Za-z0-9_-]{20,}\b").unwrap(),
        // AWS access key id
        Regex::new(r"\b(AKIA|ASIA)[0-9A-Z]{16}\b").unwrap(),
        // Private key 헤더 (RSA / EC / OpenSSH / PGP)
        Regex::new(r"-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+PRIVATE KEY-----")
            .unwrap(),
        // Slack token
        Regex::new(r"\bxox[barpsoe]-[A-Za-z0-9-]{10,}\b").unwrap(),
        // JWT
        Regex::new(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b").unwrap(),
        // Stripe
        Regex::new(r"\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]{20,}\b").unwrap(),
        // Anthropic API key
        Regex::new(r"\bsk-ant-[A-Za-z0-9_-]{20,}\b").unwrap(),
        // OpenAI API key (sk- 만 prefix, sk-ant 가 더 specific 이라 위에)
        Regex::new(r"\bsk-[A-Za-z0-9]{20,}\b").unwrap(),
        // Google API key
        Regex::new(r"\bAIza[0-9A-Za-z_-]{35}\b").unwrap(),
        // Database URL (인증 포함)
        Regex::new(
            r"(?i)\b(postgres|postgresql|mysql|mongodb|redis)(\+srv)?://[^:\s]+:[^@\s]+@[^\s]+",
        )
        .unwrap(),
        // 한국 주민등록번호
        Regex::new(r"\b\d{6}-?[1-4]\d{6}\b").unwrap(),
        // Generic env-var-secret (KEY_NAME=VALUE) — stack trace / error message 노출 방어.
        // 보다 구체적인 패턴 (GitHub PAT, AWS, JWT, etc.) 이 먼저 매칭되도록 본 패턴은 끝에 배치.
        // 키워드: API_KEY / ACCESS_KEY / SECRET_KEY / API_SECRET / CLIENT_SECRET /
        //        ACCESS_TOKEN / AUTH_TOKEN / BEARER_TOKEN / REFRESH_TOKEN / PASSWORD / PASSWD.
        // `[_-]?` 로 dash/underscore/연결 변형 모두 수용 (APIKEY / API-KEY / API_KEY).
        Regex::new(
            r"(?i)\b(API[_-]?KEY|ACCESS[_-]?KEY|SECRET[_-]?KEY|API[_-]?SECRET|CLIENT[_-]?SECRET|ACCESS[_-]?TOKEN|AUTH[_-]?TOKEN|BEARER[_-]?TOKEN|REFRESH[_-]?TOKEN|PASSWORD|PASSWD)\s*[:=]\s*\S+",
        )
        .unwrap(),
    ]
});

/// 모든 알려진 secret 패턴을 `[MASKED]` 로 치환.
pub fn mask_secrets(input: &str) -> String {
    let mut out = input.to_string();
    for re in SECRET_PATTERNS.iter() {
        out = re.replace_all(&out, "[MASKED]").into_owned();
    }
    out
}

/// tracing fmt sink 용 redacting writer (plan #45 M7).
///
/// 전역 `tracing_subscriber::fmt()` sink 가 마스킹을 거치지 않아, secret 를 담은 값이
/// tracing 으로 로깅되면 stderr/캡처 로그로 누출될 수 있었다 (IPC Serialize 마스킹은
/// frontend-bound 경로만 보호). 본 writer 는 fmt 가 포맷한 각 이벤트 라인을 `mask_secrets`
/// 통과 후 inner(기본 stderr)로 흘린다. fmt 는 이벤트당 1회 write_all 하므로 라인 단위
/// 마스킹이 안전하다.
pub struct RedactingWriter<W: std::io::Write> {
    inner: W,
}

impl<W: std::io::Write> RedactingWriter<W> {
    pub fn new(inner: W) -> Self {
        Self { inner }
    }
}

impl<W: std::io::Write> std::io::Write for RedactingWriter<W> {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        let masked = mask_secrets(&String::from_utf8_lossy(buf));
        self.inner.write_all(masked.as_bytes())?;
        Ok(buf.len())
    }
    fn flush(&mut self) -> std::io::Result<()> {
        self.inner.flush()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacting_writer_masks_pat_before_sink() {
        use std::io::Write;
        let mut sink: Vec<u8> = Vec::new();
        {
            let mut w = RedactingWriter::new(&mut sink);
            write!(
                w,
                "fetch 실패: token ghp_abcdefghijklmnopqrstuvwxyz123456 invalid"
            )
            .unwrap();
        }
        let out = String::from_utf8(sink).unwrap();
        assert!(
            out.contains("[MASKED]"),
            "PAT 이 sink 직전 마스킹되어야 함: {out}"
        );
        assert!(
            !out.contains("ghp_"),
            "원본 PAT 가 sink 에 남으면 안 됨: {out}"
        );
    }

    #[test]
    fn masks_github_pat() {
        let s = mask_secrets("token: ghp_abcdefghijklmnopqrstuvwxyz123456");
        assert!(s.contains("[MASKED]"));
        assert!(!s.contains("ghp_"));
    }

    #[test]
    fn masks_jwt() {
        let s = mask_secrets("Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.SflKxwRJSMeKKF2QT4");
        assert!(s.contains("[MASKED]"));
        assert!(!s.contains("eyJhbGc"));
    }

    #[test]
    fn masks_database_url() {
        let s = mask_secrets("DATABASE_URL=postgres://user:pass@db.example.com/app");
        assert!(s.contains("[MASKED]"));
        assert!(!s.contains("user:pass"));
    }

    #[test]
    fn preserves_safe_text() {
        let safe = "feat: refactor commit graph rendering (Sprint c45)";
        assert_eq!(mask_secrets(safe), safe);
    }

    #[test]
    fn masks_ssn() {
        let s = mask_secrets("주민번호: 900101-1234567");
        assert!(s.contains("[MASKED]"));
    }

    // c46+ /code-review SEC-1 후속 — generic env-var-secret 패턴.
    // 사전 결함 `ai::prompts::tests::test_mask_env_pattern` 동시 해소.

    #[test]
    fn masks_env_api_key() {
        let s = mask_secrets("API_KEY=mySecretKey123");
        assert!(s.contains("[MASKED]"));
        assert!(!s.contains("mySecretKey123"));
    }

    #[test]
    fn masks_env_password_lowercase() {
        let s = mask_secrets("password = '12345!'");
        assert!(s.contains("[MASKED]"));
        assert!(!s.contains("12345!"));
    }

    #[test]
    fn masks_env_dashed_variants() {
        // ACCESS-TOKEN, BEARER-TOKEN 도 mask 대상.
        let s = mask_secrets("ACCESS-TOKEN: sometokenvalue");
        assert!(s.contains("[MASKED]"));
    }

    #[test]
    fn env_pattern_does_not_overmatch_generic_text() {
        // 키워드 미포함 일반 KEY=VALUE 는 mask 되지 않아야 함.
        let s = mask_secrets("path=/usr/local/bin");
        assert_eq!(s, "path=/usr/local/bin");
        let s = mask_secrets("count=42 status=ok");
        assert_eq!(s, "count=42 status=ok");
    }

    #[test]
    fn env_pattern_keyword_without_assignment_kept() {
        // "the password field is required" 처럼 = / : 가 없으면 mask 하지 않음.
        let s = mask_secrets("the password field is required");
        assert_eq!(s, "the password field is required");
    }
}
