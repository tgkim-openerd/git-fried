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
        if let Self::GitCli { stderr, exit_code, .. } = self {
            map.serialize_entry("stderr", stderr)?;
            map.serialize_entry("exitCode", exit_code)?;
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
