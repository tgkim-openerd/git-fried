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
pub mod alias;
pub mod auth;
// v1.0 #25 (UltraPlan plan/31) — OAuth flow skeleton (GitHub / Gitea). 실 활성화 v1.x.
pub mod auth_oauth;
pub mod error;
pub mod forge;
pub mod git;
pub mod importer;
pub mod ipc;
pub mod launchpad;
pub mod menu;
pub mod panic_hook;
pub mod profiles;
pub mod pty;
pub mod secret_mask;
pub mod storage;

use std::sync::Arc;

pub use error::{AppError, AppResult};

/// 앱 전역 상태. Tauri State 로 등록되어 모든 IPC 핸들러에서 접근 가능.
pub struct AppState {
    pub db: storage::Db,
    /// 통합 터미널 PTY 세션 (`docs/plan/10 옵션 A`).
    pub pty: pty::PtyRegistry,
}

impl AppState {
    pub async fn new() -> AppResult<Arc<Self>> {
        let db = storage::Db::open_default().await?;
        Ok(Arc::new(Self {
            db,
            pty: pty::PtyRegistry::new(),
        }))
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

    // Sprint c78 — panic hook (Tauri webview silent abort 방지).
    // c79 ARCH-004 — panic_hook 모듈 분리, install() 1줄 호출.
    panic_hook::install();

    // tokio runtime 으로 AppState 비동기 초기화 후 Tauri 빌더에 inject.
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("tokio runtime build failed");
    let state = runtime
        .block_on(async { AppState::new().await })
        .expect("AppState init failed");

    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .menu(|handle| menu::build(handle))
        .on_menu_event(|app, event| {
            menu::handle_event(app, event.id().as_ref());
        })
        .manage(state)
        .manage(runtime)
        .invoke_handler(tauri::generate_handler![
            ipc::commands::get_app_info,
            ipc::diagnostic_commands::report_frontend_error,
            ipc::workspace_commands::list_workspaces,
            ipc::workspace_commands::create_workspace,
            ipc::workspace_commands::update_workspace,
            ipc::workspace_commands::delete_workspace,
            ipc::branch_commands::merge_branch,
            ipc::branch_commands::rebase_branch,
            ipc::branch_commands::cherry_pick_sha,
            ipc::repo_commands::list_repos,
            ipc::repo_commands::add_repo,
            ipc::repo_commands::remove_repo,
            ipc::repo_commands::set_repo_pinned,
            ipc::graph_commands::get_log,
            ipc::status_commands::get_status,
            ipc::status_commands::stage_paths,
            ipc::status_commands::stage_all,
            ipc::status_commands::unstage_paths,
            ipc::status_commands::discard_paths,
            ipc::status_commands::apply_patch,
            ipc::status_commands::restore_paths,
            ipc::status_commands::restore_worktree_patch,
            ipc::status_commands::get_diff,
            ipc::status_commands::get_commit_diff,
            ipc::status_commands::read_file,
            ipc::commit_commands::commit,
            ipc::commit_commands::last_commit_message,
            ipc::sync_commands::fetch_all,
            ipc::sync_commands::pull,
            ipc::sync_commands::push,
            ipc::branch_commands::list_branches,
            ipc::branch_commands::switch_branch,
            ipc::branch_commands::create_branch,
            ipc::branch_commands::delete_branch,
            ipc::branch_commands::rename_branch,
            ipc::stash_commands::list_stash,
            ipc::stash_commands::push_stash,
            ipc::stash_commands::push_stash_staged,
            ipc::stash_commands::stash_to_branch,
            ipc::stash_commands::apply_stash,
            ipc::stash_commands::pop_stash,
            ipc::stash_commands::drop_stash,
            ipc::stash_commands::show_stash,
            ipc::stash_commands::apply_stash_file,
            ipc::stash_commands::edit_stash_message,
            ipc::commit_commands::compare_refs,
            ipc::status_commands::range_diff,
            ipc::commit_commands::reset,
            ipc::commit_commands::revert,
            ipc::commit_commands::undo_last_action,
            ipc::commit_commands::redo_last_action,
            ipc::commit_commands::count_hangul_commits,
            ipc::graph_commands::get_graph,
            ipc::graph_commands::search_commits_by_message,
            ipc::submodule_commands::list_submodules,
            ipc::submodule_commands::init_submodules,
            ipc::submodule_commands::update_submodules,
            ipc::submodule_commands::sync_submodules,
            ipc::sync_commands::bulk_fetch,
            ipc::sync_commands::bulk_status,
            ipc::sync_commands::bulk_quick_status,
            ipc::sync_commands::bulk_list_prs,
            ipc::remote_commands::list_remotes,
            ipc::remote_commands::add_remote,
            ipc::remote_commands::remove_remote,
            ipc::remote_commands::rename_remote,
            ipc::remote_commands::set_remote_url,
            ipc::remote_commands::maintenance_gc,
            ipc::remote_commands::maintenance_fsck,
            ipc::remote_commands::read_repo_config,
            ipc::remote_commands::apply_repo_config,
            ipc::tag_commands::list_tags,
            ipc::tag_commands::create_tag,
            ipc::tag_commands::delete_tag,
            ipc::tag_commands::push_tag,
            ipc::tag_commands::delete_remote_tag,
            ipc::repo_commands::clone_repo,
            ipc::importer_commands::import_gitkraken_detect,
            ipc::importer_commands::import_gitkraken_dry_run,
            ipc::importer_commands::import_gitkraken_apply,
            ipc::forge_commands::forge_save_token,
            ipc::forge_commands::forge_list_accounts,
            ipc::forge_commands::forge_delete_account,
            ipc::forge_commands::set_repo_forge_account,
            ipc::forge_commands::forge_whoami,
            ipc::forge_commands::list_pull_requests,
            ipc::forge_commands::get_pull_request,
            ipc::forge_commands::create_pull_request,
            ipc::forge_commands::list_issues,
            ipc::forge_commands::list_releases,
            ipc::forge_commands::list_pr_comments,
            ipc::forge_commands::add_pr_comment,
            ipc::forge_commands::add_review_comment,
            ipc::forge_commands::submit_pr_review,
            ipc::forge_commands::merge_pr,
            ipc::forge_commands::close_pr,
            ipc::forge_commands::reopen_pr,
            ipc::forge_commands::list_pr_files,
            ipc::v02_commands::list_worktrees,
            ipc::v02_commands::add_worktree,
            ipc::v02_commands::remove_worktree,
            ipc::v02_commands::prune_worktrees,
            ipc::v02_commands::lock_worktree,
            ipc::v02_commands::unlock_worktree,
            ipc::v02_commands::bulk_cherry_pick,
            ipc::v02_commands::read_conflicted,
            ipc::v02_commands::write_resolved,
            ipc::v02_commands::take_side,
            ipc::v02_commands::launch_mergetool,
            ipc::v02_commands::open_in_explorer,
            ipc::v02_commands::open_path_in_explorer,
            ipc::v02_commands::bisect_status,
            ipc::v02_commands::bisect_start,
            ipc::v02_commands::bisect_mark,
            ipc::v02_commands::bisect_reset,
            ipc::v02_commands::list_reflog,
            ipc::v02_commands::lfs_status,
            ipc::v02_commands::lfs_list_files,
            ipc::v02_commands::lfs_install,
            ipc::v02_commands::lfs_track,
            ipc::v02_commands::lfs_untrack,
            ipc::v02_commands::lfs_fetch,
            ipc::v02_commands::lfs_pull,
            ipc::v02_commands::lfs_prune,
            ipc::v02_commands::lfs_push_size,
            ipc::v02_commands::get_file_history,
            ipc::v02_commands::get_file_blame,
            ipc::v02_commands::ai_detect_clis,
            ipc::v02_commands::ai_commit_message,
            ipc::v02_commands::ai_pr_body,
            ipc::v02_commands::ai_resolve_conflict,
            ipc::v02_commands::ai_code_review,
            ipc::v02_commands::ai_explain_commit,
            ipc::v02_commands::ai_explain_branch,
            ipc::v02_commands::ai_stash_message,
            ipc::v02_commands::predict_target_conflict,
            ipc::v02_commands::ai_composer_plan,
            ipc::v02_commands::rebase_prepare_todo,
            ipc::v02_commands::rebase_run,
            ipc::v02_commands::rebase_status,
            ipc::v02_commands::rebase_continue,
            ipc::v02_commands::rebase_abort,
            ipc::v02_commands::rebase_skip,
            ipc::pty_commands::pty_open,
            ipc::pty_commands::pty_write,
            ipc::pty_commands::pty_resize,
            ipc::pty_commands::pty_close,
            ipc::hide_commands::list_hidden_refs,
            ipc::hide_commands::hide_ref,
            ipc::hide_commands::unhide_ref,
            ipc::hide_commands::hide_refs_bulk,
            ipc::hide_commands::unhide_refs_by_kind,
            ipc::hide_commands::unhide_all_refs,
            ipc::launchpad_commands::launchpad_list_active,
            ipc::launchpad_commands::launchpad_list_for_repo,
            ipc::launchpad_commands::launchpad_set_pinned,
            ipc::launchpad_commands::launchpad_set_snooze,
            ipc::launchpad_commands::launchpad_cleanup_defaults,
            ipc::launchpad_commands::launchpad_list_views,
            ipc::launchpad_commands::launchpad_save_view,
            ipc::launchpad_commands::launchpad_delete_view,
            ipc::alias_commands::list_all_repo_aliases,
            ipc::alias_commands::resolve_repo_alias,
            ipc::alias_commands::set_repo_alias,
            ipc::alias_commands::unset_repo_alias,
            ipc::profile_commands::list_profiles,
            ipc::profile_commands::create_profile,
            ipc::profile_commands::update_profile,
            ipc::profile_commands::delete_profile,
            ipc::profile_commands::activate_profile,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
