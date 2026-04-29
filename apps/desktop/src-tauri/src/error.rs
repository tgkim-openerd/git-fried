// 앱 전체 에러 타입. Tauri IPC 경계에서 자동 직렬화되어 프론트로 전달.
//
// 디자인 원칙:
//   - thiserror 로 enum, 모든 외부 에러를 흡수
//   - serde::Serialize 구현으로 IPC 자동 변환
//   - 한국어 메시지 우선 (사용자 표시용)
//   - source/cause 는 별도 필드로 유지 (디버깅용)
use serde::Serialize;
use std::fmt;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Git 작업 실패: {0}")]
    Git(#[from] git2::Error),

    #[error("Git 명령 실행 실패: {message}")]
    GitCli {
        message: String,
        exit_code: Option<i32>,
        stderr: String,
    },

    #[error("DB 작업 실패: {0}")]
    Db(#[from] sqlx::Error),

    #[error("DB 마이그레이션 실패: {0}")]
    Migrate(#[from] sqlx::migrate::MigrateError),

    #[error("IO 에러: {0}")]
    Io(#[from] std::io::Error),

    #[error("HTTP 요청 실패: {0}")]
    Http(#[from] reqwest::Error),

    #[error("JSON 직렬화 실패: {0}")]
    Json(#[from] serde_json::Error),

    #[error("경로 변환 실패: {0}")]
    Path(String),

    #[error("레포를 찾을 수 없습니다 (id={0})")]
    RepoNotFound(i64),

    #[error("워크스페이스를 찾을 수 없습니다 (id={0})")]
    WorkspaceNotFound(i64),

    #[error("인코딩 변환 실패: {0}")]
    Encoding(String),

    #[error("입력 검증 실패: {0}")]
    Validation(String),

    /// Sprint c30 / MED 2 — Forge API rate-limit 도달.
    /// `retry_after` 는 초 단위 권장 대기 시간 (Gitea/GitHub Retry-After 헤더).
    #[error("API 호출 한도 초과 ({provider}). {retry_after}초 후 재시도")]
    RateLimit { provider: String, retry_after: u64 },

    /// Sprint c30 / MED 2 — Forge 토큰 만료 / 무효.
    /// frontend 에서 자동으로 토큰 재입력 모달 띄우는 분기 트리거.
    #[error("{provider} 토큰이 만료되었거나 권한이 부족합니다. Settings 에서 토큰을 갱신하세요.")]
    AuthExpired { provider: String },

    #[error("내부 오류: {0}")]
    Internal(String),
}

impl AppError {
    pub fn validation<S: Into<String>>(s: S) -> Self {
        Self::Validation(s.into())
    }
    pub fn internal<S: Into<String>>(s: S) -> Self {
        Self::Internal(s.into())
    }
    pub fn path<S: Into<String>>(s: S) -> Self {
        Self::Path(s.into())
    }
    pub fn encoding<S: Into<String>>(s: S) -> Self {
        Self::Encoding(s.into())
    }

    /// Sprint c30 / MED 2 — Rate limit 빌더.
    pub fn rate_limit<S: Into<String>>(provider: S, retry_after: u64) -> Self {
        Self::RateLimit {
            provider: provider.into(),
            retry_after,
        }
    }

    /// Sprint c30 / MED 2 — Auth expired 빌더.
    pub fn auth_expired<S: Into<String>>(provider: S) -> Self {
        Self::AuthExpired {
            provider: provider.into(),
        }
    }
}

impl From<anyhow::Error> for AppError {
    fn from(e: anyhow::Error) -> Self {
        Self::Internal(format!("{e:#}"))
    }
}

// IPC 직렬화: 프론트 측 catch 시 { kind, message } 형태로 받음.
impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, ser: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeMap;
        let mut map = ser.serialize_map(Some(2))?;
        map.serialize_entry("kind", self.kind())?;
        map.serialize_entry("message", &self.to_string())?;
        match self {
            Self::GitCli {
                stderr, exit_code, ..
            } => {
                map.serialize_entry("stderr", stderr)?;
                map.serialize_entry("exitCode", exit_code)?;
            }
            // Sprint c30 / MED 2 — Forge 분기 처리용 메타.
            Self::RateLimit {
                provider,
                retry_after,
            } => {
                map.serialize_entry("provider", provider)?;
                map.serialize_entry("retryAfter", retry_after)?;
            }
            Self::AuthExpired { provider } => {
                map.serialize_entry("provider", provider)?;
            }
            _ => {}
        }
        map.end()
    }
}

impl AppError {
    /// 프론트에서 분기 처리 가능한 식별자.
    pub fn kind(&self) -> &'static str {
        match self {
            Self::Git(_) => "git",
            Self::GitCli { .. } => "git_cli",
            Self::Db(_) => "db",
            Self::Migrate(_) => "migrate",
            Self::Io(_) => "io",
            Self::Http(_) => "http",
            Self::Json(_) => "json",
            Self::Path(_) => "path",
            Self::RepoNotFound(_) => "repo_not_found",
            Self::WorkspaceNotFound(_) => "workspace_not_found",
            Self::Encoding(_) => "encoding",
            Self::Validation(_) => "validation",
            Self::RateLimit { .. } => "rate_limit",
            Self::AuthExpired { .. } => "auth_expired",
            Self::Internal(_) => "internal",
        }
    }
}

pub type AppResult<T> = Result<T, AppError>;

// fmt::Display 는 thiserror 가 자동 구현하지만, 명시적으로 한 번 더 두면 매크로 디버깅이 쉬움.
pub struct DisplayWrap<T>(pub T);
impl<T: fmt::Display> fmt::Debug for DisplayWrap<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn rate_limit_kind() {
        let e = AppError::rate_limit("Gitea", 60);
        assert_eq!(e.kind(), "rate_limit");
    }

    #[test]
    fn rate_limit_serialize_includes_provider_and_retry_after() {
        let e = AppError::rate_limit("Gitea", 60);
        let v = serde_json::to_value(&e).expect("serde");
        assert_eq!(v["kind"], json!("rate_limit"));
        assert_eq!(v["provider"], json!("Gitea"));
        assert_eq!(v["retryAfter"], json!(60));
        // 한국어 메시지가 직렬화 message 에 들어감.
        assert!(v["message"]
            .as_str()
            .unwrap()
            .contains("API 호출 한도 초과"));
    }

    #[test]
    fn auth_expired_kind() {
        let e = AppError::auth_expired("GitHub");
        assert_eq!(e.kind(), "auth_expired");
    }

    #[test]
    fn auth_expired_serialize_includes_provider() {
        let e = AppError::auth_expired("GitHub");
        let v = serde_json::to_value(&e).expect("serde");
        assert_eq!(v["kind"], json!("auth_expired"));
        assert_eq!(v["provider"], json!("GitHub"));
        assert!(v["message"]
            .as_str()
            .unwrap()
            .contains("토큰이 만료되었거나"));
    }

    #[test]
    fn rate_limit_korean_provider_round_trip() {
        let e = AppError::rate_limit("깃이아", 5);
        let v = serde_json::to_value(&e).expect("serde");
        assert_eq!(v["provider"], json!("깃이아"));
    }

    #[test]
    fn validation_serialize_no_provider_field() {
        let e = AppError::validation("입력값 부족");
        let v = serde_json::to_value(&e).expect("serde");
        assert_eq!(v["kind"], json!("validation"));
        assert!(v.get("provider").is_none());
        assert!(v.get("retryAfter").is_none());
    }

    #[test]
    fn git_cli_serialize_includes_stderr_and_exit_code() {
        let e = AppError::GitCli {
            message: "fail".to_string(),
            exit_code: Some(128),
            stderr: "fatal: not a git repo".to_string(),
        };
        let v = serde_json::to_value(&e).expect("serde");
        assert_eq!(v["kind"], json!("git_cli"));
        assert_eq!(v["exitCode"], json!(128));
        assert_eq!(v["stderr"], json!("fatal: not a git repo"));
    }

    #[test]
    fn all_kinds_are_unique_strings() {
        let kinds = [
            AppError::rate_limit("p", 0).kind(),
            AppError::auth_expired("p").kind(),
            AppError::validation("v").kind(),
            AppError::internal("i").kind(),
            AppError::path("p").kind(),
            AppError::encoding("e").kind(),
        ];
        let unique: std::collections::HashSet<_> = kinds.iter().copied().collect();
        assert_eq!(unique.len(), kinds.len());
    }
}
