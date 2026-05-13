// v0.5 #11 (UltraPlan plan/31) — Commit + 통합 검색 skeleton.
//
// 기존 search_commits_by_message (graph_commands.rs) 는 `git log --grep` 동등
// — subject + body 만. v0.5 #11 의 목적: file content / branch / SHA / 통합.
//
// 본 모듈은 **skeleton + 타입 정의만** — 실 구현은 ripgrep wrapper + commit content
// search 통합. v0.5 phase 별 sprint.
//
// 외부 ref:
//   - ripgrep: https://github.com/BurntSushi/ripgrep
//   - git grep / git log --pickaxe: 코드 차이 검색

use crate::error::AppResult;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedSearchArgs {
    pub repo_id: i64,
    pub pattern: String,
    pub scope: SearchScope,
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SearchScope {
    /// commit subject + body (`git log --grep`, 기존 search_commits_by_message)
    CommitMessage,
    /// 워킹트리 file content (ripgrep 또는 git grep)
    FileContent,
    /// branch name (refs/heads/*)
    Branch,
    /// SHA prefix
    Sha,
    /// 모두 (priority: SHA > branch > commit message > file content)
    Unified,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedSearchHit {
    pub kind: SearchScope,
    pub label: String,
    pub detail: String,
    pub sha: Option<String>,
    pub path: Option<String>,
    pub line: Option<u32>,
}

/// v0.5 #11 — 통합 검색 entry. 실 구현은 별도 sprint.
#[tauri::command]
pub async fn unified_search(_args: UnifiedSearchArgs) -> AppResult<Vec<UnifiedSearchHit>> {
    // v0.5 — ripgrep wrapper (FileContent) + git grep + git log --pickaxe 통합.
    // 본 skeleton 은 빈 결과만 반환 (UI 진입점은 v0.5 별도 sprint).
    Ok(Vec::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn unified_search_skeleton_returns_empty() {
        let args = UnifiedSearchArgs {
            repo_id: 1,
            pattern: "test".to_string(),
            scope: SearchScope::Unified,
            limit: Some(50),
        };
        let r = unified_search(args).await.unwrap();
        assert_eq!(r.len(), 0);
    }
}
