// 앱 진입점 라이브러리 — Tauri 빌더 + state + plugin + IPC 등록.
//
// 모듈 구조:
//   - error: 앱 전체 에러 타입
//   - git: git2-rs / git CLI 하이브리드 + 한글 spawn 표준
//   - storage: SQLite + sqlx + 마이그레이션
//   - ipc: Tauri commands (#[tauri::command])
pub mod error;
pub mod git;
pub mod ipc;
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
