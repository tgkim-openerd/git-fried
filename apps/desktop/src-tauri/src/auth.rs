// OS keychain (Windows Credential Manager / macOS Keychain / Linux SecretService)
// 을 통한 PAT 저장/조회/삭제.
//
// 디자인:
//   - 모든 토큰 entry 는 prefix `git-fried:` + forge_kind + base_url + username 키.
//   - DB(`forge_accounts`) 의 keychain_ref 가 이 키 문자열.
//   - 평문 토큰을 DB 에 저장하지 않는다.

use crate::error::{AppError, AppResult};
use keyring::Entry;

const SERVICE: &str = "git-fried";

pub fn make_key(forge_kind: &str, base_url: &str, username: Option<&str>) -> String {
    format!("{forge_kind}|{base_url}|{}", username.unwrap_or(""))
}

pub fn save_token(key: &str, token: &str) -> AppResult<()> {
    let token_len = token.len();
    let entry =
        Entry::new(SERVICE, key).map_err(|e| AppError::internal(format!("keyring: {e}")))?;
    let result = entry
        .set_password(token)
        .map_err(|e| AppError::internal(format!("keyring set: {e}")));
    match &result {
        // token 본체는 절대 로그에 노출 금지 — len 만 (secret_mask 와 동일 정책).
        Ok(_) => tracing::info!(target: "git_fried_lib::auth", key, token_len, "save_token 완료"),
        Err(e) => tracing::warn!(target: "git_fried_lib::auth", key, error = %e, "save_token 실패"),
    }
    result?;
    Ok(())
}

pub fn load_token(key: &str) -> AppResult<Option<String>> {
    let entry =
        Entry::new(SERVICE, key).map_err(|e| AppError::internal(format!("keyring: {e}")))?;
    match entry.get_password() {
        Ok(t) => {
            tracing::debug!(target: "git_fried_lib::auth", key, "load_token hit");
            Ok(Some(t))
        }
        Err(keyring::Error::NoEntry) => {
            tracing::debug!(target: "git_fried_lib::auth", key, "load_token NoEntry");
            Ok(None)
        }
        Err(e) => {
            // PR-C.2 (plan v0.9) — Linux D-Bus 미가용 (WSL/Docker/headless) 또는 OS keychain
            // 일시 fault 시 fallback. NoEntry 외 모든 에러를 Ok(None) 으로 변환 → caller 가
            // "재로그인 필요" UI 진입. 앱 전체 auth 블로킹 방지.
            // PII 보호: error stderr 만 mask (없음 — keyring crate 자체 메시지).
            tracing::warn!(
                target: "git_fried_lib::auth",
                key,
                error = %e,
                "load_token keyring 사용 불가 — Ok(None) fallback (재로그인 prompt)"
            );
            Ok(None)
        }
    }
}

pub fn delete_token(key: &str) -> AppResult<()> {
    let entry =
        Entry::new(SERVICE, key).map_err(|e| AppError::internal(format!("keyring: {e}")))?;
    match entry.delete_credential() {
        Ok(()) => {
            tracing::info!(target: "git_fried_lib::auth", key, "delete_token 완료");
            Ok(())
        }
        Err(keyring::Error::NoEntry) => {
            tracing::debug!(target: "git_fried_lib::auth", key, "delete_token NoEntry (noop)");
            Ok(())
        }
        Err(e) => {
            tracing::warn!(target: "git_fried_lib::auth", key, error = %e, "delete_token 실패");
            Err(AppError::internal(format!("keyring delete: {e}")))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Sprint c89-B Phase 1.1 (plan/36 §2.1.1) — auth keyring key 형식 검증.

    #[test]
    fn make_key_basic_format() {
        let key = make_key("github", "https://api.github.com", Some("tgkim"));
        assert_eq!(key, "github|https://api.github.com|tgkim");
    }

    #[test]
    fn make_key_username_none_appends_empty() {
        let key = make_key("gitea", "https://gitea.com", None);
        assert_eq!(key, "gitea|https://gitea.com|");
    }

    /// Sprint c89-B — 한글 forge 이름 + 한글 username 도 정상 (NFC 가정).
    /// keyring crate 는 UTF-8 정상 처리. DB 의 keychain_ref 도 동일.
    #[test]
    fn make_key_korean_username_preserved() {
        let key = make_key("gitea", "https://git.dev.opnd.io", Some("김태길"));
        assert_eq!(key, "gitea|https://git.dev.opnd.io|김태길");
        // 분리자 `|` 가 한글 안에 누출되지 않음.
        assert_eq!(key.split('|').count(), 3);
    }

    /// Sprint c89-B — base_url 에 trailing slash 또는 path 가 포함되면 그대로 key 에 들어감.
    /// 즉 caller (예: profiles.rs) 가 사전에 base URL 정규화 책임 — 본 test 가 정규화 정책 회귀 가드.
    #[test]
    fn make_key_does_not_normalize_base_url() {
        let key = make_key("gitea", "https://gitea.com/", Some("u"));
        assert_eq!(key, "gitea|https://gitea.com/|u");
        // 정규화 누락 시 같은 계정 2개 entry (with/without trailing slash) 잠재 — caller 책임.
    }
}
