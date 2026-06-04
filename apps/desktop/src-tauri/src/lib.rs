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

use std::collections::HashMap;
use std::sync::{Arc, Mutex as StdMutex};
use tokio::sync::Mutex as TokioMutex;

pub use error::{AppError, AppResult};

/// 앱 전역 상태. Tauri State 로 등록되어 모든 IPC 핸들러에서 접근 가능.
pub struct AppState {
    pub db: storage::Db,
    /// 통합 터미널 PTY 세션 (`docs/plan/10 옵션 A`).
    pub pty: pty::PtyRegistry,
    /// Sprint 2026-05-26 — Codex Wave 1 HIGH-D 해소: per-repo async lock.
    /// profile binding 같이 (1) DB lookup → (2) git config write 다중 단계 →
    /// (3) DB write 가 일관성 필요한 multi-step mutation 의 직렬화 도구.
    ///
    /// `repo_lock(repo_id)` 가 lazy 생성 + Arc clone 반환. caller 는 `.lock().await` 후
    /// guard 가 살아있는 동안 다른 mutation 직렬화 보장. lock 자체는 (`)` 만 보유 —
    /// payload 는 호출처가 보관. lock map 자체 mutation 은 std Mutex (sync, 단순 insert).
    repo_locks: StdMutex<HashMap<i64, Arc<TokioMutex<()>>>>,
}

impl AppState {
    pub async fn new() -> AppResult<Arc<Self>> {
        let db = storage::Db::open_default().await?;
        // plan/43 P2.5 — post-migration backfill: 기존 미바인딩 레포 자동 매칭 1회 평가.
        // best-effort — 실패해도 앱 기동은 막지 않음 (자동 매칭은 부가 기능).
        if let Err(e) = crate::git::profile_match::backfill_auto_match(&db).await {
            tracing::warn!(
                target: "git_fried_lib",
                error = %e,
                "profile 자동 매칭 backfill 실패 (무시하고 기동)"
            );
        }

        // Sprint 2026-06-04 — forge 메타 backfill. GitKraken 대량 임포트로 비어버린
        // forge_owner/repo/default_remote 를 background 로 1회 일괄 재탐지(self-heal).
        // 기동(window) 을 막지 않도록 detached task. runtime 은 `.manage(runtime)` 로
        // 앱 수명 동안 유지되므로 block_on 반환 후에도 task 가 계속 진행된다.
        // 복구 후 owner 가 채워진 레포는 auto_match 를 재실행해 같은 기동에서 프로필 바인딩.
        let db_bg = db.clone();
        tokio::spawn(async move {
            match crate::git::repository_meta_backfill::backfill_forge_meta(&db_bg).await {
                Ok(rep) => {
                    if rep.healed > 0 || rep.failed > 0 {
                        tracing::info!(
                            target: "git_fried_lib",
                            healed = rep.healed,
                            missing = rep.skipped_missing,
                            no_meta = rep.skipped_no_meta,
                            failed = rep.failed,
                            "forge 메타 backfill 완료"
                        );
                    }
                    if rep.healed > 0 {
                        if let Err(e) = crate::git::profile_match::backfill_auto_match(&db_bg).await
                        {
                            tracing::warn!(
                                target: "git_fried_lib",
                                error = %e,
                                "forge backfill 후 자동 매칭 재평가 실패"
                            );
                        }
                    }
                }
                Err(e) => tracing::warn!(
                    target: "git_fried_lib",
                    error = %e,
                    "forge 메타 backfill 실패 (무시하고 기동)"
                ),
            }
        });

        Ok(Arc::new(Self {
            db,
            pty: pty::PtyRegistry::new(),
            repo_locks: StdMutex::new(HashMap::new()),
        }))
    }

    /// 특정 repo 의 직렬화 lock 을 가져온다. 없으면 lazy 생성.
    ///
    /// caller 패턴:
    /// ```ignore
    /// let lock = state.repo_lock(args.repo_id);
    /// let _guard = lock.lock().await;  // 해제까지 다른 caller 차단
    /// // ... TOCTOU-critical section (DB + filesystem multi-step) ...
    /// ```
    ///
    /// **호출처**: ipc/profile_commands::apply_profile_binding (HIGH-D),
    /// ipc/profile_commands::select_default_profile (대칭 영역).
    pub fn repo_lock(&self, repo_id: i64) -> Arc<TokioMutex<()>> {
        let mut locks = self
            .repo_locks
            .lock()
            .expect("repo_locks Mutex poisoned — bug or panic during lock");
        // Codex R6 review 2026-06-04 — unbounded growth 방지. guarded IPC 가 repo_path 검증
        // *전에* guard 를 획득하므로 invalid repo_id 반복 호출 시 map 에 TokioMutex 가 영구 잔류.
        prune_idle_locks(&mut locks);
        locks
            .entry(repo_id)
            .or_insert_with(|| Arc::new(TokioMutex::new(())))
            .clone()
    }

    /// Sprint 2026-06-04 (/analyze F3/F13) — destructive/index-mutating IPC 의 표준 진입 가드.
    ///
    /// `repo_lock(repo_id)` 를 owned guard 로 획득 (FIFO blocking). guard 가 사는 동안
    /// 같은 repo 의 다른 mutation IPC 는 직렬화 → 동시 `git` 프로세스가 index.lock / ref.lock
    /// 충돌로 "another git process" 에러를 노출하는 UX degrade 를 막는다.
    /// (git lockfile 이 corruption 자체는 막지만 사용자에게 raw 에러가 새는 걸 못 막음.)
    ///
    /// **반드시 IPC boundary 에서만** 호출 — git 모듈 fn 내부에서 호출하면 TokioMutex 가
    /// non-reentrant 라 self-deadlock. 대상: index/worktree/HEAD/refs/stash/sequencer 변경.
    /// 제외: read-only, network(fetch_all/push/bulk_fetch — 장시간 대기로 commit block),
    /// rebase_prepare_todo(메타 편집). 설계 근거: Codex 자문 2026-06-04.
    pub async fn repo_mutation_guard(&self, repo_id: i64) -> tokio::sync::OwnedMutexGuard<()> {
        self.repo_lock(repo_id).lock_owned().await
    }
}

/// repo_locks map 에서 활성 홀더 없는(strong_count==1 → map 만 참조) 항목 정리.
///
/// Codex R6 review 2026-06-04 — `repo_lock` 에서 매 호출 정리해 unbounded growth 방지.
/// 사용 중 lock 은 caller(`repo_lock` 반환 Arc) 또는 guard(`lock_owned`/`lock` 보유)가 Arc 를
/// 들고 있어 count>=2 → 절대 정리되지 않음. 호출처가 StdMutex 를 보유하므로 strong_count 판정
/// 직전·직후 다른 thread 의 신규 clone 은 불가능(clone 경로는 repo_lock 단일).
fn prune_idle_locks(locks: &mut HashMap<i64, Arc<TokioMutex<()>>>) {
    locks.retain(|_, lock| Arc::strong_count(lock) > 1);
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
            ipc::search_commands::unified_search,
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
            ipc::tag_commands::annotate_existing_tag,
            ipc::repo_commands::clone_repo,
            ipc::importer_commands::import_gitkraken_detect,
            ipc::importer_commands::import_gitkraken_dry_run,
            ipc::importer_commands::import_gitkraken_apply,
            // Plan #42 M-1 (Sprint c99) — Git Hooks manager (read-only scan).
            ipc::hooks_commands::list_git_hooks,
            // Plan #42 M-1 후속 (Sprint c104) — Git Hooks enable/disable.
            ipc::hooks_commands::hook_activate,
            ipc::hooks_commands::hook_deactivate,
            // Plan #42 M-2 (Sprint c100) — Sparse Checkout repo manager.
            ipc::sparse_commands::sparse_status,
            ipc::sparse_commands::sparse_init_cone,
            ipc::sparse_commands::sparse_set,
            ipc::sparse_commands::sparse_disable,
            ipc::sparse_commands::sparse_reapply,
            ipc::forge_commands::forge_save_token,
            ipc::forge_commands::forge_list_accounts,
            ipc::forge_commands::forge_delete_account,
            ipc::forge_commands::set_repo_forge_account,
            ipc::forge_commands::set_repo_ssh_key_path,
            ipc::forge_commands::set_repo_credential_identity,
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
            ipc::profile_commands::preview_profile_apply,
            ipc::profile_commands::apply_profile_binding,
            ipc::profile_commands::select_default_profile,
            ipc::profile_commands::clear_profile_binding,
            // e2e 전용 guard probe — debug 빌드에서만 등록 (release 미포함).
            #[cfg(debug_assertions)]
            ipc::test_commands::guard_probe,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Sprint c89-B Phase 2 (plan/36 §3 Option B) — Tauri test feature MockRuntime POC.
//
// POC 결과: Windows 환경에서 `tauri = { features = ["test"] }` dev-dep 활성 시
// cargo test 자체가 `STATUS_ENTRYPOINT_NOT_FOUND` (0xc0000139) 으로 차단.
// Tauri MockRuntime 가 WebView2 native DLL 에 의존하기 때문.
//
// 본 POC 코드 + dev-dep 모두 제거 — plan/36 v0.3 에 결과 documented.
// Linux/macOS 또는 Tauri 후속 release 에서 재시도 시 별도 trigger.

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    /// Codex R6 review 2026-06-04 — repo_lock unbounded growth 방지 가드.
    /// 활성 홀더 없는(strong_count==1) 항목은 정리, 보유 중인 항목은 유지.
    #[test]
    fn prune_idle_locks_removes_unheld_keeps_held() {
        let mut map: HashMap<i64, Arc<TokioMutex<()>>> = HashMap::new();
        // id=1: idle (map 만 참조, count==1) — invalid repo_id 반복 호출 시뮬레이션.
        map.insert(1, Arc::new(TokioMutex::new(())));
        // id=2: 외부에서 보유 (caller/guard 상당, count==2).
        let held = Arc::new(TokioMutex::new(()));
        map.insert(2, held.clone());

        prune_idle_locks(&mut map);

        assert!(
            !map.contains_key(&1),
            "활성 홀더 없는 lock 은 정리되어야 함"
        );
        assert!(map.contains_key(&2), "보유 중 lock 은 유지되어야 함");
        // held drop 후 재정리 시 id=2 도 정리됨 (lazy 재생성 전제).
        drop(held);
        prune_idle_locks(&mut map);
        assert!(map.is_empty(), "모든 홀더 해제 후 map 은 비어야 함");
    }

    // ====== repo_mutation_guard 직렬화 불변식 (Layer D, /verify 2026-06-04) ======
    //
    // full-stack(CDP e2e) 와 별도로, guard 직렬화 invariant 를 deterministic 하게 검증.
    // WebView/WebDriver flake 없이 Rust 런타임에서 직접 동시성 관찰.

    async fn test_state() -> (Arc<AppState>, tempfile::NamedTempFile) {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let db = storage::Db::open(tmp.path()).await.unwrap();
        let state = Arc::new(AppState {
            db,
            pty: pty::PtyRegistry::new(),
            repo_locks: StdMutex::new(HashMap::new()),
        });
        (state, tmp) // tmp 반환해 NamedTempFile 생명주기 유지 (drop 시 파일 삭제).
    }

    /// 같은 repo 의 두 번째 guard 는 첫 번째 해제 전까지 직렬화(대기) — 해제 후 즉시 획득.
    #[tokio::test]
    async fn repo_mutation_guard_blocks_same_repo_until_released() {
        let (state, _tmp) = test_state().await;
        let g1 = state.repo_mutation_guard(7).await;
        let blocked =
            tokio::time::timeout(Duration::from_millis(150), state.repo_mutation_guard(7)).await;
        assert!(
            blocked.is_err(),
            "같은 repo 의 두 번째 mutation guard 는 첫 번째 해제 전까지 직렬화(대기)되어야 함"
        );
        drop(g1);
        let after =
            tokio::time::timeout(Duration::from_millis(150), state.repo_mutation_guard(7)).await;
        assert!(after.is_ok(), "guard 해제 후 같은 repo 재획득 가능해야 함");
    }

    /// 다른 repo 의 guard 는 동시 획득 가능 (직렬화 안 됨) — network/UX starvation 회피의 근거.
    #[tokio::test]
    async fn repo_mutation_guard_allows_different_repos_concurrently() {
        let (state, _tmp) = test_state().await;
        let _g1 = state.repo_mutation_guard(1).await;
        let g2 =
            tokio::time::timeout(Duration::from_millis(150), state.repo_mutation_guard(2)).await;
        assert!(g2.is_ok(), "다른 repo 의 guard 는 동시 획득 가능해야 함");
    }

    /// 같은 repo_id 는 같은 Mutex 인스턴스 공유(→직렬화), 다른 id 는 별도(→동시). prune 후에도 유지.
    #[tokio::test]
    async fn repo_lock_same_id_returns_same_mutex() {
        let (state, _tmp) = test_state().await;
        let a = state.repo_lock(42);
        let b = state.repo_lock(42);
        assert!(
            Arc::ptr_eq(&a, &b),
            "같은 repo_id 는 같은 Mutex 인스턴스를 공유해야 직렬화됨"
        );
        let c = state.repo_lock(43);
        assert!(
            !Arc::ptr_eq(&a, &c),
            "다른 repo_id 는 별도 Mutex 여야 동시 실행됨"
        );
    }
}
