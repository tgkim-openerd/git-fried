// Tauri IPC 핸들러 모듈.
//
// 모든 #[tauri::command] 함수는 카테고리별 *.rs 에 분산.
// generate_handler! 매크로 호출은 lib.rs 의 invoke_handler() 에서 직접.
// (Box<dyn Fn> 으로 감싸지 못하는 매크로 한계 우회)
//
// 분해 이력:
//   - 2026-05-04 c39 — v02_commands.rs 의 LFS / Bisect / Rebase 영역을
//     lfs_commands / bisect_commands / rebase_commands 로 분리.
//   - 2026-05-04 c40 Step 4 — Workspace 4 commands → workspace_commands 시범 분리.
//   - 2026-05-04 c40 후속 — branch (8) + stash (10) + repo (5) 추가 분리.
//   - 2026-05-04 c40 후속 (전체) — status (11) + commit (8) + graph (3) +
//     sync (7) + submodule (4) + remote (9) + tag (5) + importer (3) 분리.
//     commands.rs 는 get_app_info (1) 만 잔존.
pub mod alias_commands;
pub mod bisect_commands;
pub mod branch_commands;
pub mod commands;
pub mod commit_commands;
pub mod forge_commands;
pub mod graph_commands;
pub mod hide_commands;
pub mod importer_commands;
pub mod launchpad_commands;
pub mod lfs_commands;
pub mod profile_commands;
pub mod pty_commands;
pub mod rebase_commands;
pub mod remote_commands;
pub mod repo_commands;
pub mod stash_commands;
pub mod status_commands;
pub mod submodule_commands;
pub mod sync_commands;
pub mod tag_commands;
pub mod v02_commands;
pub mod workspace_commands;

pub use alias_commands::*;
pub use bisect_commands::*;
pub use branch_commands::*;
pub use commands::*;
pub use commit_commands::*;
pub use forge_commands::*;
pub use graph_commands::*;
pub use hide_commands::*;
pub use importer_commands::*;
pub use launchpad_commands::*;
pub use lfs_commands::*;
pub use profile_commands::*;
pub use pty_commands::*;
pub use rebase_commands::*;
pub use remote_commands::*;
pub use repo_commands::*;
pub use stash_commands::*;
pub use status_commands::*;
pub use submodule_commands::*;
pub use sync_commands::*;
pub use tag_commands::*;
pub use v02_commands::*;
pub use workspace_commands::*;

// repo_id → 로컬 경로. 분해된 IPC 모듈들이 공유하는 헬퍼.
// `pub(crate)` 로 외부 노출 차단 + ipc/* 자유 사용.
pub(crate) async fn repo_path(
    state: &std::sync::Arc<crate::AppState>,
    repo_id: i64,
) -> crate::error::AppResult<std::path::PathBuf> {
    use crate::storage::DbExt;
    Ok(std::path::PathBuf::from(
        state.db.get_repo(repo_id).await?.local_path,
    ))
}
