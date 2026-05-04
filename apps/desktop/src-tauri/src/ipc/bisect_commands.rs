// Bisect IPC commands — `git bisect start/mark/reset/status` 4 커맨드.
// 2026-05-04 /analyze 후속 — v02_commands.rs 에서 분리.

use crate::error::AppResult;
use crate::git::bisect as git_bisect;
use crate::ipc::repo_path;
use crate::AppState;
use serde::Deserialize;
use std::sync::Arc;

#[tauri::command]
pub async fn bisect_status(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<git_bisect::BisectStatus> {
    let path = repo_path(&state, repo_id).await?;
    git_bisect::status(&path).await
}

#[tauri::command]
pub async fn bisect_start(
    repo_id: i64,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<String> {
    let path = repo_path(&state, repo_id).await?;
    git_bisect::start(&path).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BisectMarkArgs {
    pub repo_id: i64,
    pub mark: git_bisect::BisectMark,
    pub sha: Option<String>,
}

#[tauri::command]
pub async fn bisect_mark(
    args: BisectMarkArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<String> {
    let path = repo_path(&state, args.repo_id).await?;
    git_bisect::mark(&path, args.mark, args.sha.as_deref()).await
}

#[tauri::command]
pub async fn bisect_reset(repo_id: i64, state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
    let path = repo_path(&state, repo_id).await?;
    git_bisect::reset(&path).await
}

// 2026-05-04 /analyze 후속 — IPC args struct 의 camelCase 직렬화 계약 가드.
// (이전 sub-agent 분석에서 ipc/* 의 #[test] 0개로 검출 — 직렬화 계약은
//  렌더러(Vue)에서 invoke 호출 시 정확한 키 매칭이 필수.)
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bisect_mark_args_camel_case_repo_id() {
        // Vue 측 invoke('bisect_mark', { args: { repoId, mark, sha } }) 가
        // serde rename_all="camelCase" 로 정확히 디코드되는지 가드.
        let json = r#"{"repoId":42,"mark":"good","sha":null}"#;
        let parsed: BisectMarkArgs = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.repo_id, 42);
        assert!(parsed.sha.is_none());
    }

    #[test]
    fn bisect_mark_args_with_sha_string() {
        let json = r#"{"repoId":7,"mark":"bad","sha":"abc123"}"#;
        let parsed: BisectMarkArgs = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.sha.as_deref(), Some("abc123"));
    }

    #[test]
    fn bisect_mark_args_rejects_snake_case_repo_id() {
        // legacy snake_case (repo_id) 키는 reject 되어야 한다 — 그렇지 않으면
        // Vue 측 카멜케이스 표준이 깨진 경우 silent 통과 위험.
        let json = r#"{"repo_id":1,"mark":"good","sha":null}"#;
        let result: Result<BisectMarkArgs, _> = serde_json::from_str(json);
        assert!(result.is_err(), "snake_case repo_id 는 거부되어야 함");
    }
}
