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

#[cfg(test)]
mod tests {
    use super::*;

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
}
