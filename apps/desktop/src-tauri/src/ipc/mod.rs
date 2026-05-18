// Tauri IPC 핸들러 모듈.
//
// 모든 #[tauri::command] 함수는 카테고리별 *.rs 에 분산.
// generate_handler! 매크로 호출은 lib.rs 의 invoke_handler() 에서 직접
// fully-qualified path (`ipc::module_name::fn`) 로 호출하므로 본 mod.rs 는
// `pub mod` 로 모듈 노출만 담당. 와일드카드 `pub use *::*` 는 c40 후속에서
// 모두 dead 로 확인되어 제거 (cargo unused_imports warning 4건 해소).
//
// 예외: v02_commands.rs:7-9 가 `pub use crate::ipc::{bisect,lfs,rebase}_commands::*`
// 로 재내보내는 부분은 lib.rs 가 `ipc::v02_commands::bisect_status` /
// `ipc::v02_commands::lfs_install` 형태로 호출하므로 load-bearing — 보존.
//
// 분해 이력:
//   - 2026-05-04 c39 — v02_commands.rs 의 LFS / Bisect / Rebase 영역 분리.
//   - 2026-05-04 c40 Step 4 — Workspace 4 commands → workspace_commands 시범.
//   - 2026-05-04 c40 후속 — branch (8) + stash (10) + repo (5) 추가 분리.
//   - 2026-05-04 c40 후속 (전체) — status (11) + commit (8) + graph (3) +
//     sync (7) + submodule (4) + remote (9) + tag (5) + importer (3) 분리.
//     commands.rs 는 get_app_info (1) 만 잔존.
//   - 2026-05-04 c40 후속 (review fix) — ARCH-001 dead `pub use *::*` 23 wildcard 제거.
use crate::storage::DbExt;

pub mod ai_commands;
pub mod alias_commands;
pub mod bisect_commands;
pub mod branch_commands;
pub mod commands;
pub mod commit_commands;
pub mod diagnostic_commands;
pub mod forge_commands;
pub mod graph_commands;
pub mod hide_commands;
pub mod hooks_commands;
pub mod importer_commands;
pub mod launchpad_commands;
pub mod lfs_commands;
pub mod merge_commands;
pub mod profile_commands;
pub mod pty_commands;
pub mod rebase_commands;
pub mod remote_commands;
pub mod repo_commands;
pub mod sparse_commands;
// v0.5 #11 (UltraPlan plan/31) — Unified 검색 skeleton (commit + file + branch + SHA).
pub mod search_commands;
pub mod stash_commands;
pub mod status_commands;
pub mod submodule_commands;
pub mod sync_commands;
pub mod tag_commands;
pub mod v02_commands;
pub mod workspace_commands;
pub mod worktree_commands;

// repo_id → 로컬 경로. 분해된 IPC 모듈들이 공유하는 헬퍼.
// `pub(crate)` 로 외부 노출 차단 + ipc/* 자유 사용.
pub(crate) async fn repo_path(
    state: &std::sync::Arc<crate::AppState>,
    repo_id: i64,
) -> crate::error::AppResult<std::path::PathBuf> {
    Ok(std::path::PathBuf::from(
        state.db.get_repo(repo_id).await?.local_path,
    ))
}
