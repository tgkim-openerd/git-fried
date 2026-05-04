// Tauri commands — Frontend (Vue) 에서 invoke() 로 호출하는 함수들.
//
// /analyze HIGH 1 후속 (Sprint c40) 도메인 분해 완료 후 본 파일은 거의 비어있음.
//   - app_info: 본 파일 (1 command)
//   - workspace: ipc/workspace_commands.rs (4)
//   - branch: ipc/branch_commands.rs (8)
//   - stash: ipc/stash_commands.rs (10)
//   - repo + clone: ipc/repo_commands.rs (5)
//   - status + stage + restore + diff + range_diff: ipc/status_commands.rs (11)
//   - commit + identity + history (compare/reset/revert/undo/redo): ipc/commit_commands.rs (8)
//   - graph (log + graph + search): ipc/graph_commands.rs (3)
//   - sync + bulk: ipc/sync_commands.rs (7)
//   - submodule: ipc/submodule_commands.rs (4)
//   - remote + maintenance + repo_config: ipc/remote_commands.rs (9)
//   - tag: ipc/tag_commands.rs (5)
//   - importer: ipc/importer_commands.rs (3)
//   - 기타 (forge / launchpad / hide / profile / pty / alias / bisect / lfs / rebase / v02): 별도

use crate::git::runner;
use serde::{Deserialize, Serialize};

// ====== App info ======

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub version: String,
    pub git_version: Option<String>,
    pub platform: String,
}

#[tauri::command]
pub async fn get_app_info() -> AppInfo {
    let git_version = runner::git_version().await.ok();
    AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        git_version,
        platform: std::env::consts::OS.to_string(),
    }
}
