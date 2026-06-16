// v1.0 #25 (UltraPlan plan/31) — OAuth flow skeleton (GitHub / Gitea).
//
// 현재 PAT 만 지원 (auth.rs + forge_accounts.keychain_ref). OAuth 는 v1.x — Tauri
// deep-link plugin 으로 callback URL 받기 + token refresh 흐름.
//
// 본 모듈은 **skeleton + 타입 정의만** — 실 flow 구현은 v1.0 release sprint.
// 사유: GitHub OAuth App 등록 + redirect URL whitelist + Gitea OAuth 별도 등록 필요.
//
// 외부 ref:
//   - GitHub OAuth: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps
//   - Gitea OAuth: https://docs.gitea.com/development/oauth2-provider
//   - Tauri deep-link: https://v2.tauri.app/plugin/deep-link/

use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};

/// OAuth provider 식별.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OAuthProvider {
    Github,
    Gitea,
}

/// OAuth flow 시작 — Tauri 가 외부 브라우저로 authorize URL 열림.
/// callback URL `git-fried://oauth/callback` 으로 code 수신 → exchange.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthStartArgs {
    pub provider: OAuthProvider,
    pub base_url: String,
    pub client_id: String,
    /// PKCE code_verifier (랜덤 생성, code_challenge 와 함께 authorize URL 에 전달).
    pub pkce_verifier: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthTokenSet {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: Option<i64>,
    pub scope: Option<String>,
}

/// authorize URL 빌더. 실 호출은 v1.0.
///
/// **SEC-001 fix (code-review 2026-05-13)**: PKCE code_challenge='PLACEHOLDER'
/// 가 prod 빌드에 노출되면 PKCE 보호 무력화. runtime panic 가드 — verifier
/// 가 RFC 7636 §4.1 권장 길이 (43-128 char unreserved) 미만이면 즉시 panic.
/// 실 base64url(sha256(verifier)) 계산은 sha2 crate 통합 시 (v1.0 release sprint).
pub fn build_authorize_url(args: &OAuthStartArgs, redirect_uri: &str) -> String {
    // SEC-001 — PKCE verifier 검증 (RFC 7636 §4.1).
    let verifier_len = args.pkce_verifier.len();
    assert!(
        (43..=128).contains(&verifier_len),
        "PKCE verifier 가 RFC 7636 §4.1 범위 위반 (현재 len={verifier_len}, 권장 43..=128). \
         실 OAuth flow 진입 전 차단."
    );
    assert!(
        args.pkce_verifier
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '.' | '_' | '~')),
        "PKCE verifier 가 RFC 7636 §4.1 unreserved char 위반."
    );

    let provider_path = match args.provider {
        OAuthProvider::Github => "/login/oauth/authorize",
        OAuthProvider::Gitea => "/login/oauth/authorize",
    };
    // SEC-001 — v1.0: base64url(sha256(verifier)) 계산 후 code_challenge 치환.
    // 본 skeleton 은 verifier 자체를 placeholder 로 사용 (plain method) — assert 가
    // 길이 검증 통과한 verifier 만 도달. 실 S256 method 활성화는 sha2 통합 시.
    format!(
        "{}{}?client_id={}&redirect_uri={}&response_type=code&scope=repo&code_challenge={}&code_challenge_method=plain",
        args.base_url, provider_path, args.client_id, redirect_uri, args.pkce_verifier
    )
}

/// code → token exchange. 실 reqwest 호출은 v1.0.
///
/// ARCH-001 fix (code-review 2026-05-13): `Result<_, String>` → AppResult 일관.
/// 다른 IPC 모듈 (forge_commands / db / search_commands) 와 동일 error type.
/// v1.0 활성 시 reqwest::Error → AppError #[from] 변환 path 자연.
pub async fn exchange_code_for_token(
    _provider: OAuthProvider,
    _base_url: &str,
    _client_id: &str,
    _client_secret: Option<&str>,
    _code: &str,
    _verifier: &str,
) -> AppResult<OAuthTokenSet> {
    // v1.0 — reqwest::Client POST /login/oauth/access_token
    Err(AppError::Internal(
        "OAuth flow v1.0 release sprint 에서 활성화 (skeleton 만).".into(),
    ))
}

/// access_token 만료 시 refresh.
pub async fn refresh_access_token(
    _provider: OAuthProvider,
    _base_url: &str,
    _client_id: &str,
    _refresh_token: &str,
) -> AppResult<OAuthTokenSet> {
    Err(AppError::Internal(
        "OAuth refresh v1.0 release sprint 에서 활성화.".into(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn authorize_url_github() {
        let args = OAuthStartArgs {
            provider: OAuthProvider::Github,
            base_url: "https://github.com".to_string(),
            client_id: "client123".to_string(),
            // SEC-001 — RFC 7636 §4.1: 43-128 char unreserved (A-Z a-z 0-9 -._~)
            pkce_verifier: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG".to_string(),
        };
        let url = build_authorize_url(&args, "git-fried://oauth/callback");
        assert!(url.contains("github.com/login/oauth/authorize"));
        assert!(url.contains("client_id=client123"));
        assert!(url.contains("redirect_uri=git-fried://oauth/callback"));
        assert!(url.contains("response_type=code"));
    }

    #[test]
    fn authorize_url_gitea() {
        let args = OAuthStartArgs {
            provider: OAuthProvider::Gitea,
            base_url: "https://git.dev.opnd.io".to_string(),
            client_id: "company".to_string(),
            // SEC-001 — RFC 7636 §4.1: 43-128 char unreserved (A-Z a-z 0-9 -._~)
            pkce_verifier: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG".to_string(),
        };
        let url = build_authorize_url(&args, "git-fried://oauth/callback");
        assert!(url.contains("git.dev.opnd.io/login/oauth/authorize"));
    }

    #[tokio::test]
    async fn exchange_returns_skeleton_error() {
        let r = exchange_code_for_token(
            OAuthProvider::Github,
            "https://github.com",
            "id",
            None,
            "code",
            "ver",
        )
        .await;
        assert!(r.is_err());
        // ARCH-001 fix — AppResult 일관 후 Display 통해 message 확인.
        let msg = format!("{}", r.unwrap_err());
        assert!(msg.contains("v1.0"));
    }
}
