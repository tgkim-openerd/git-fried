// 작업 디렉토리 상태 조회 (status / branch / ahead-behind).
//
// libgit2 API 사용 (git2-rs). git CLI 보다 빠르고 재시도 안정적.
// staged / unstaged / untracked / conflicted 분리.

use crate::error::{AppError, AppResult};
use git2::{BranchType, Repository, Status as GitStatus, StatusOptions};
use serde::{Deserialize, Serialize};
use std::path::Path;
use unicode_normalization::UnicodeNormalization;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoStatus {
    pub branch: Option<String>,
    pub upstream: Option<String>,
    pub ahead: usize,
    pub behind: usize,
    pub staged: Vec<FileChange>,
    pub unstaged: Vec<FileChange>,
    pub untracked: Vec<String>,
    pub conflicted: Vec<String>,
    /// 작업 디렉토리가 깨끗한지 (커밋할 변경 / 미추적 / 충돌이 모두 없음).
    pub is_clean: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChange {
    pub path: String,
    pub old_path: Option<String>,
    pub status: ChangeStatus,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChangeStatus {
    Added,
    Modified,
    Deleted,
    Renamed,
    Copied,
    Typechange,
    Unknown,
}

/// 레포의 브랜치 + upstream + ahead/behind 만 빠르게 조회 (file walk 생략).
/// Sprint 22-11 F-P3 — Sidebar 50+ repo 일괄 표시용.
/// read_status 대비 ~50× 빠름 (file walk 제거).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickStatus {
    pub branch: Option<String>,
    pub upstream: Option<String>,
    pub ahead: usize,
    pub behind: usize,
}

pub fn read_quick_status(path: &Path) -> AppResult<QuickStatus> {
    let repo = Repository::open(path).map_err(AppError::Git)?;
    let head_ref = repo.head().ok();
    let branch_name = head_ref
        .as_ref()
        .and_then(|r| r.shorthand().map(|s| s.to_string()));

    let (upstream, ahead, behind) = match branch_name.as_deref() {
        Some(name) => {
            let local = repo.find_branch(name, BranchType::Local).ok();
            let upstream_branch = local.as_ref().and_then(|b| b.upstream().ok());
            let upstream_name = upstream_branch
                .as_ref()
                .and_then(|b| b.name().ok().flatten().map(|s| s.to_string()));
            let (a, b) = match (
                local.as_ref().and_then(|b| b.get().target()),
                upstream_branch.as_ref().and_then(|b| b.get().target()),
            ) {
                (Some(local_oid), Some(up_oid)) => {
                    repo.graph_ahead_behind(local_oid, up_oid).unwrap_or((0, 0))
                }
                _ => (0, 0),
            };
            (upstream_name, a, b)
        }
        None => (None, 0, 0),
    };

    Ok(QuickStatus {
        branch: branch_name,
        upstream,
        ahead,
        behind,
    })
}

/// 레포의 작업 디렉토리 상태 + 브랜치 + ahead/behind 계산.
pub fn read_status(path: &Path) -> AppResult<RepoStatus> {
    let repo = Repository::open(path).map_err(AppError::Git)?;

    // 브랜치
    let head_ref = repo.head().ok();
    let branch_name = head_ref
        .as_ref()
        .and_then(|r| r.shorthand().map(|s| s.to_string()));

    // upstream + ahead/behind (브랜치가 있을 때만)
    let (upstream, ahead, behind) = match branch_name.as_deref() {
        Some(name) => {
            let local = repo.find_branch(name, BranchType::Local).ok();
            let upstream_branch = local.as_ref().and_then(|b| b.upstream().ok());
            let upstream_name = upstream_branch
                .as_ref()
                .and_then(|b| b.name().ok().flatten().map(|s| s.to_string()));
            let (a, b) = match (
                local.as_ref().and_then(|b| b.get().target()),
                upstream_branch.as_ref().and_then(|b| b.get().target()),
            ) {
                (Some(local_oid), Some(up_oid)) => {
                    repo.graph_ahead_behind(local_oid, up_oid).unwrap_or((0, 0))
                }
                _ => (0, 0),
            };
            (upstream_name, a, b)
        }
        None => (None, 0, 0),
    };

    // 파일 상태
    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    opts.recurse_untracked_dirs(true);
    opts.renames_head_to_index(true);
    opts.renames_index_to_workdir(true);
    opts.exclude_submodules(false);

    let statuses = repo.statuses(Some(&mut opts)).map_err(AppError::Git)?;

    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut untracked = Vec::new();
    let mut conflicted = Vec::new();

    for entry in statuses.iter() {
        let path_raw = entry.path().unwrap_or("");
        let path_norm: String = path_raw.nfc().collect();
        let s = entry.status();

        if s.is_conflicted() {
            conflicted.push(path_norm);
            continue;
        }
        if s.contains(GitStatus::WT_NEW) {
            untracked.push(path_norm.clone());
        }

        // staged (index)
        if let Some(stat) = match_index(s) {
            let old_path = entry
                .head_to_index()
                .and_then(|d| d.old_file().path())
                .map(|p| p.to_string_lossy().into_owned());
            staged.push(FileChange {
                path: path_norm.clone(),
                old_path,
                status: stat,
            });
        }
        // unstaged (workdir)
        if let Some(stat) = match_workdir(s) {
            let old_path = entry
                .index_to_workdir()
                .and_then(|d| d.old_file().path())
                .map(|p| p.to_string_lossy().into_owned());
            unstaged.push(FileChange {
                path: path_norm,
                old_path,
                status: stat,
            });
        }
    }

    let is_clean =
        staged.is_empty() && unstaged.is_empty() && untracked.is_empty() && conflicted.is_empty();

    Ok(RepoStatus {
        branch: branch_name,
        upstream,
        ahead,
        behind,
        staged,
        unstaged,
        untracked,
        conflicted,
        is_clean,
    })
}

fn match_index(s: GitStatus) -> Option<ChangeStatus> {
    if s.contains(GitStatus::INDEX_NEW) {
        Some(ChangeStatus::Added)
    } else if s.contains(GitStatus::INDEX_MODIFIED) {
        Some(ChangeStatus::Modified)
    } else if s.contains(GitStatus::INDEX_DELETED) {
        Some(ChangeStatus::Deleted)
    } else if s.contains(GitStatus::INDEX_RENAMED) {
        Some(ChangeStatus::Renamed)
    } else if s.contains(GitStatus::INDEX_TYPECHANGE) {
        Some(ChangeStatus::Typechange)
    } else {
        None
    }
}

fn match_workdir(s: GitStatus) -> Option<ChangeStatus> {
    if s.contains(GitStatus::WT_MODIFIED) {
        Some(ChangeStatus::Modified)
    } else if s.contains(GitStatus::WT_DELETED) {
        Some(ChangeStatus::Deleted)
    } else if s.contains(GitStatus::WT_RENAMED) {
        Some(ChangeStatus::Renamed)
    } else if s.contains(GitStatus::WT_TYPECHANGE) {
        Some(ChangeStatus::Typechange)
    } else {
        None
    }
}
