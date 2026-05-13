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

use serde::{Deserialize, Serialize};

/// OAuth provider 식별.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OAuthProvider {
    Github,
    Gitea,
}

/// OAuth flow 시작 — Tauri 가 외부 브라우저로 authorize URL 열림.
/// callback URL `gitfried://oauth/callback` 으로 code 수신 → exchange.
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
pub fn build_authorize_url(args: &OAuthStartArgs, redirect_uri: &str) -> String {
    let provider_path = match args.provider {
        OAuthProvider::Github => "/login/oauth/authorize",
        OAuthProvider::Gitea => "/login/oauth/authorize",
    };
    // PKCE code_challenge = base64url(sha256(verifier)). 본 skeleton 은 placeholder.
    format!(
        "{}{}?client_id={}&redirect_uri={}&response_type=code&scope=repo&code_challenge=PLACEHOLDER&code_challenge_method=S256",
        args.base_url, provider_path, args.client_id, redirect_uri
    )
}

/// code → token exchange. 실 reqwest 호출은 v1.0.
pub async fn exchange_code_for_token(
    _provider: OAuthProvider,
    _base_url: &str,
    _client_id: &str,
    _client_secret: Option<&str>,
    _code: &str,
    _verifier: &str,
) -> Result<OAuthTokenSet, String> {
    // v1.0 — reqwest::Client POST /login/oauth/access_token
    Err("OAuth flow v1.0 release sprint 에서 활성화 (skeleton 만).".to_string())
}

/// access_token 만료 시 refresh.
pub async fn refresh_access_token(
    _provider: OAuthProvider,
    _base_url: &str,
    _client_id: &str,
    _refresh_token: &str,
) -> Result<OAuthTokenSet, String> {
    Err("OAuth refresh v1.0 release sprint 에서 활성화.".to_string())
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
            pkce_verifier: "verifier".to_string(),
        };
        let url = build_authorize_url(&args, "gitfried://oauth/callback");
        assert!(url.contains("github.com/login/oauth/authorize"));
        assert!(url.contains("client_id=client123"));
        assert!(url.contains("redirect_uri=gitfried://oauth/callback"));
        assert!(url.contains("response_type=code"));
    }

    #[test]
    fn authorize_url_gitea() {
        let args = OAuthStartArgs {
            provider: OAuthProvider::Gitea,
            base_url: "https://git.dev.opnd.io".to_string(),
            client_id: "company".to_string(),
            pkce_verifier: "verifier".to_string(),
        };
        let url = build_authorize_url(&args, "gitfried://oauth/callback");
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
        assert!(r.unwrap_err().contains("v1.0"));
    }
}
