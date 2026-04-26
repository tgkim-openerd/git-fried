// v0.x 단계 허용 — DbExt::add_repo 같은 8개 인자 함수.
// 추후 builder pattern 또는 args struct 로 리팩토링 시 제거.
#![allow(clippy::too_many_arguments)]

// 앱 진입점 라이브러리 — Tauri 빌더 + state + plugin + IPC 등록.
//
// 모듈 구조:
//   - error: 앱 전체 에러 타입
//   - git: git2-rs / git CLI 하이브리드 + 한글 spawn 표준
//   - storage: SQLite + sqlx + 마이그레이션
//   - ipc: Tauri commands (#[tauri::command])
pub mod ai;
pub mod auth;
pub mod error;
pub mod forge;
pub mod git;
pub mod ipc;
pub mod profiles;
pub mod storage;

use std::sync::Arc;

pub use error::{AppError, AppResult};

/// 앱 전역 상태. Tauri State 로 등록되어 모든 IPC 핸들러에서 접근 가능.
pub struct AppState {
    pub db: storage::Db,
}

impl AppState {
    pub async fn new() -> AppResult<Arc<Self>> {
        let db = storage::Db::open_default().await?;
        Ok(Arc::new(Self { db }))
    }
}

/// `tauri::Builder` 를 셋업하고 실행. main.rs 에서 호출.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 로깅: RUST_LOG 환경변수, 디폴트는 info.
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info,git_fried_lib=debug")),
        )
        .init();

    // tokio runtime 으로 AppState 비동기 초기화 후 Tauri 빌더에 inject.
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("tokio runtime build failed");
    let state = runtime
        .block_on(async { AppState::new().await })
        .expect("AppState init failed");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .manage(runtime)
        .invoke_handler(tauri::generate_handler![
            ipc::commands::get_app_info,
            ipc::commands::list_workspaces,
            ipc::commands::create_workspace,
            ipc::commands::list_repos,
            ipc::commands::add_repo,
            ipc::commands::remove_repo,
            ipc::commands::get_log,
            ipc::commands::get_status,
            ipc::commands::stage_paths,
            ipc::commands::stage_all,
            ipc::commands::unstage_paths,
            ipc::commands::discard_paths,
            ipc::commands::apply_patch,
            ipc::commands::get_diff,
            ipc::commands::get_commit_diff,
            ipc::commands::commit,
            ipc::commands::last_commit_message,
            ipc::commands::fetch_all,
            ipc::commands::pull,
            ipc::commands::push,
            ipc::commands::list_branches,
            ipc::commands::switch_branch,
            ipc::commands::create_branch,
            ipc::commands::delete_branch,
            ipc::commands::rename_branch,
            ipc::commands::list_stash,
            ipc::commands::push_stash,
            ipc::commands::apply_stash,
            ipc::commands::pop_stash,
            ipc::commands::drop_stash,
            ipc::commands::show_stash,
            ipc::commands::reset,
            ipc::commands::revert,
            ipc::commands::get_graph,
            ipc::commands::list_submodules,
            ipc::commands::init_submodules,
            ipc::commands::update_submodules,
            ipc::commands::sync_submodules,
            ipc::commands::bulk_fetch,
            ipc::commands::bulk_status,
            ipc::commands::bulk_list_prs,
            ipc::forge_commands::forge_save_token,
            ipc::forge_commands::forge_list_accounts,
            ipc::forge_commands::forge_delete_account,
            ipc::forge_commands::forge_whoami,
            ipc::forge_commands::list_pull_requests,
            ipc::forge_commands::get_pull_request,
            ipc::forge_commands::create_pull_request,
            ipc::forge_commands::list_issues,
            ipc::forge_commands::list_releases,
            ipc::forge_commands::list_pr_comments,
            ipc::forge_commands::add_pr_comment,
            ipc::forge_commands::submit_pr_review,
            ipc::forge_commands::merge_pr,
            ipc::forge_commands::close_pr,
            ipc::forge_commands::reopen_pr,
            ipc::v02_commands::list_worktrees,
            ipc::v02_commands::add_worktree,
            ipc::v02_commands::remove_worktree,
            ipc::v02_commands::prune_worktrees,
            ipc::v02_commands::bulk_cherry_pick,
            ipc::v02_commands::read_conflicted,
            ipc::v02_commands::write_resolved,
            ipc::v02_commands::take_side,
            ipc::v02_commands::bisect_status,
            ipc::v02_commands::bisect_start,
            ipc::v02_commands::bisect_mark,
            ipc::v02_commands::bisect_reset,
            ipc::v02_commands::list_reflog,
            ipc::v02_commands::lfs_status,
            ipc::v02_commands::lfs_list_files,
            ipc::v02_commands::lfs_track,
            ipc::v02_commands::lfs_untrack,
            ipc::v02_commands::lfs_fetch,
            ipc::v02_commands::lfs_pull,
            ipc::v02_commands::lfs_prune,
            ipc::v02_commands::get_file_history,
            ipc::v02_commands::get_file_blame,
            ipc::v02_commands::ai_detect_clis,
            ipc::v02_commands::ai_commit_message,
            ipc::v02_commands::ai_pr_body,
            ipc::v02_commands::ai_resolve_conflict,
            ipc::v02_commands::ai_code_review,
            ipc::profile_commands::list_profiles,
            ipc::profile_commands::create_profile,
            ipc::profile_commands::update_profile,
            ipc::profile_commands::delete_profile,
            ipc::profile_commands::activate_profile,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
