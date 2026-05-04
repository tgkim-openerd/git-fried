// Tauri IPC 핸들러 모듈.
//
// 모든 #[tauri::command] 함수는 카테고리별 *.rs 에 분산.
// generate_handler! 매크로 호출은 lib.rs 의 invoke_handler() 에서 직접.
// (Box<dyn Fn> 으로 감싸지 못하는 매크로 한계 우회)
//
// 분해 이력:
//   - 2026-05-04 /analyze 후속 — v02_commands.rs 1077 LOC 의 LFS / Bisect / Rebase
//     영역을 각각 lfs_commands / bisect_commands / rebase_commands 로 분리.
//     v02_commands.rs 는 cherry-pick / merge / worktree / reflog / file_history / AI 보유.
pub mod alias_commands;
pub mod bisect_commands;
pub mod commands;
pub mod forge_commands;
pub mod hide_commands;
pub mod launchpad_commands;
pub mod lfs_commands;
pub mod profile_commands;
pub mod pty_commands;
pub mod rebase_commands;
pub mod v02_commands;

pub use alias_commands::*;
pub use bisect_commands::*;
pub use commands::*;
pub use forge_commands::*;
pub use hide_commands::*;
pub use launchpad_commands::*;
pub use lfs_commands::*;
pub use profile_commands::*;
pub use pty_commands::*;
pub use rebase_commands::*;
pub use v02_commands::*;

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
