// GitKraken importer (`docs/plan/21`).
//
// 사용자의 로컬 GitKraken 데이터 (`%APPDATA%/.gitkraken/profiles/<id>/`) 를
// git-fried 의 SQLite (workspaces / repos) 로 이행한다.
//
// 마이그 대상 (스키마는 plan/21 §3 참조):
//   - localRepoCache : 모든 로컬 레포 path 배열
//   - profile.favoriteRepositories : 즐겨찾기 path 배열
//   - profile.tabInfo.tabs : 활성 탭 path (FE 가 useReposStore 에 주입)
//   - projectCache.projectsById : Workspace (type=local 만)
//
// PAT (httpCreds.secFile) 는 GitKraken 자체 암호화라 마이그 불가 — 사용자 재입력.
// SSH / GPG 는 OS 표준이라 마이그 무관.

use crate::error::{AppError, AppResult};
use crate::git::repository::{self as repo, ForgeKindLite};
use crate::storage::{Db, DbExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

// ====== JSON 스키마 ======

#[derive(Debug, Deserialize)]
struct LocalRepoCacheFile {
    #[serde(rename = "localRepoCache")]
    paths: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct ProfileFile {
    #[serde(default, rename = "favoriteRepositories")]
    favorites: Vec<String>,
    #[serde(default, rename = "tabInfo")]
    tab_info: TabInfo,
}

#[derive(Debug, Default, Deserialize)]
struct TabInfo {
    #[serde(default)]
    tabs: Vec<TabEntry>,
}

#[derive(Debug, Deserialize)]
struct TabEntry {
    #[serde(rename = "type")]
    kind: String,
    #[serde(rename = "repoPath")]
    repo_path: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ProjectCacheFile {
    #[serde(rename = "projectsById")]
    projects: HashMap<String, ProjectEntry>,
}

#[derive(Debug, Deserialize)]
struct ProjectEntry {
    name: String,
    #[serde(default, rename = "syncPath")]
    sync_path: Option<String>,
    #[serde(default, rename = "type")]
    kind: Option<String>,
}

// ====== 외부 노출 타입 ======

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectResult {
    pub profile_dir: String,
    pub repo_count: usize,
    pub workspace_count: usize,
    pub favorite_count: usize,
    pub tab_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPlan {
    pub workspaces_to_create: Vec<String>,
    pub repos_to_add: usize,
    pub repos_to_pin: Vec<String>,
    pub tabs_to_open: Vec<String>,
    pub skipped_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyResult {
    pub workspaces_created: usize,
    pub repos_added: usize,
    pub repos_pinned: usize,
    pub tabs_to_open: Vec<String>,
    pub skipped_paths: Vec<String>,
    pub warnings: Vec<String>,
}

// ====== 내부 payload ======

#[derive(Debug)]
pub struct Payload {
    pub local_repo_paths: Vec<PathBuf>,
    pub favorites: Vec<PathBuf>,
    pub tabs: Vec<PathBuf>,
    /// (project name, syncPath) — type=local 만
    pub projects: Vec<(String, PathBuf)>,
}

// ====== 탐지 ======

/// `%APPDATA%/.gitkraken/profiles/*/profile` 중 mtime 가장 최신인 디렉토리.
pub fn detect_profile_dir() -> AppResult<Option<PathBuf>> {
    let appdata = match std::env::var_os("APPDATA") {
        Some(v) => PathBuf::from(v),
        None => return Ok(None),
    };
    let profiles_root = appdata.join(".gitkraken").join("profiles");
    if !profiles_root.exists() {
        return Ok(None);
    }

    let mut best: Option<(PathBuf, std::time::SystemTime)> = None;
    for entry in std::fs::read_dir(&profiles_root).map_err(AppError::Io)? {
        let entry = entry.map_err(AppError::Io)?;
        let p = entry.path();
        let profile_file = p.join("profile");
        if !profile_file.is_file() {
            continue;
        }
        let mtime = std::fs::metadata(&profile_file)
            .and_then(|m| m.modified())
            .unwrap_or(std::time::UNIX_EPOCH);
        match &best {
            None => best = Some((p, mtime)),
            Some((_, prev)) if mtime > *prev => best = Some((p, mtime)),
            _ => {}
        }
    }

    Ok(best.map(|(p, _)| p))
}

// ====== Parse ======

pub fn read_payload(profile_dir: &Path) -> AppResult<Payload> {
    let local_repo_path = profile_dir.join("localRepoCache");
    let profile_path = profile_dir.join("profile");
    let project_cache_path = profile_dir.join("projectCache");

    let local: LocalRepoCacheFile = read_json(&local_repo_path)?;
    let profile: ProfileFile = read_json(&profile_path)?;
    let projects_file: ProjectCacheFile = read_json(&project_cache_path)?;

    // localRepoCache: 끝에 `.git` 또는 `/.git` 붙어 있을 수 있음 — strip + canonical
    let local_repo_paths: Vec<PathBuf> = local
        .paths
        .into_iter()
        .map(|s| canonical_repo_path(&s))
        .collect();

    let favorites: Vec<PathBuf> = profile
        .favorites
        .into_iter()
        .map(|s| canonical_repo_path(&s))
        .collect();

    let tabs: Vec<PathBuf> = profile
        .tab_info
        .tabs
        .into_iter()
        .filter(|t| t.kind == "REPO")
        .filter_map(|t| t.repo_path.map(|p| canonical_repo_path(&p)))
        .collect();

    let projects: Vec<(String, PathBuf)> = projects_file
        .projects
        .into_values()
        .filter(|p| p.kind.as_deref() == Some("local"))
        .filter_map(|p| {
            p.sync_path
                .as_ref()
                .map(|s| (p.name.clone(), canonical_repo_path(s)))
        })
        .collect();

    Ok(Payload {
        local_repo_paths,
        favorites,
        tabs,
        projects,
    })
}

fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> AppResult<T> {
    let bytes = std::fs::read(path).map_err(AppError::Io)?;
    serde_json::from_slice(&bytes).map_err(AppError::Json)
}

/// `.../foo/.git` → `.../foo`. 백슬래시 → 슬래시. 끝 슬래시 trim.
fn canonical_repo_path(s: &str) -> PathBuf {
    let normalized = s.replace('\\', "/");
    let trimmed = normalized.trim_end_matches('/');
    let stripped = trimmed
        .strip_suffix("/.git")
        .or_else(|| trimmed.strip_suffix(".git"))
        .unwrap_or(trimmed);
    let stripped = stripped.trim_end_matches('/');
    PathBuf::from(stripped)
}

// ====== Detect summary (앱 시작 시 1회 호출 — 사용자에게 모달 띄울지 결정) ======

pub fn detect_summary() -> AppResult<Option<DetectResult>> {
    let dir = match detect_profile_dir()? {
        Some(d) => d,
        None => return Ok(None),
    };
    let payload = read_payload(&dir)?;
    Ok(Some(DetectResult {
        profile_dir: dir.to_string_lossy().to_string(),
        repo_count: payload.local_repo_paths.len(),
        workspace_count: payload.projects.len(),
        favorite_count: payload.favorites.len(),
        tab_count: payload.tabs.len(),
    }))
}

// ====== Plan / Apply 공통 ======

/// 입력 path → 가장 길게 매칭되는 syncPath 의 project name.
fn assign_workspace<'a>(
    repo_path: &Path,
    projects: &'a [(String, PathBuf)],
) -> Option<&'a str> {
    let repo_str = repo_path.to_string_lossy().to_lowercase();
    let mut best: Option<(&str, usize)> = None;
    for (name, sync) in projects {
        let sync_str = sync.to_string_lossy().to_lowercase();
        if sync_str.is_empty() {
            continue;
        }
        if repo_str.starts_with(&sync_str) {
            let len = sync_str.len();
            match best {
                None => best = Some((name.as_str(), len)),
                Some((_, prev_len)) if len > prev_len => best = Some((name.as_str(), len)),
                _ => {}
            }
        }
    }
    best.map(|(n, _)| n)
}

fn last_path_component(p: &Path) -> String {
    p.file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| p.to_string_lossy().to_string())
}

// ====== Dry-run ======

pub async fn dry_run(db: &Db, payload: &Payload) -> AppResult<ImportPlan> {
    // 기존 워크스페이스 이름 set — 충돌 시 suffix
    let existing = db.list_workspaces().await?;
    let mut existing_names: std::collections::HashSet<String> =
        existing.iter().map(|w| w.name.clone()).collect();

    let mut workspaces_to_create: Vec<String> = Vec::new();
    let mut planned_names: std::collections::HashSet<String> = std::collections::HashSet::new();
    for (name, _sync) in &payload.projects {
        let final_name = resolve_name_conflict(name, &existing_names, &planned_names);
        planned_names.insert(final_name.clone());
        existing_names.insert(final_name.clone());
        workspaces_to_create.push(final_name);
    }

    // skipped: path 존재 안 함
    let mut skipped_paths: Vec<String> = Vec::new();
    let mut repos_to_add = 0usize;
    for p in &payload.local_repo_paths {
        if !p.exists() {
            skipped_paths.push(p.to_string_lossy().to_string());
        } else {
            repos_to_add += 1;
        }
    }

    let repos_to_pin: Vec<String> = payload
        .favorites
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect();
    let tabs_to_open: Vec<String> = payload
        .tabs
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect();

    Ok(ImportPlan {
        workspaces_to_create,
        repos_to_add,
        repos_to_pin,
        tabs_to_open,
        skipped_paths,
    })
}

fn resolve_name_conflict(
    name: &str,
    existing: &std::collections::HashSet<String>,
    planned: &std::collections::HashSet<String>,
) -> String {
    if !existing.contains(name) && !planned.contains(name) {
        return name.to_string();
    }
    let suffixed = format!("{name} (GitKraken)");
    if !existing.contains(&suffixed) && !planned.contains(&suffixed) {
        return suffixed;
    }
    // 마지막 안전장치: 숫자 suffix
    for n in 2..1000 {
        let candidate = format!("{name} (GitKraken {n})");
        if !existing.contains(&candidate) && !planned.contains(&candidate) {
            return candidate;
        }
    }
    format!("{name} (GitKraken duplicate)")
}

// ====== Apply ======

pub async fn apply(db: &Db, payload: &Payload) -> AppResult<ApplyResult> {
    let mut warnings: Vec<String> = Vec::new();

    // 1) Workspace 생성 (이름 충돌 회피)
    let existing = db.list_workspaces().await?;
    let mut existing_names: std::collections::HashSet<String> =
        existing.iter().map(|w| w.name.clone()).collect();

    // syncPath (lowercase) → workspace_id
    let mut ws_by_sync: Vec<(PathBuf, i64)> = Vec::new();
    let mut workspaces_created = 0usize;

    for (orig_name, sync_path) in &payload.projects {
        let final_name =
            resolve_name_conflict(orig_name, &existing_names, &std::collections::HashSet::new());
        existing_names.insert(final_name.clone());
        match db.create_workspace(&final_name, None).await {
            Ok(ws) => {
                ws_by_sync.push((sync_path.clone(), ws.id));
                workspaces_created += 1;
            }
            Err(e) => {
                warnings.push(format!(
                    "Workspace 생성 실패 (name='{final_name}'): {e}"
                ));
            }
        }
    }

    // 2) Repo 추가
    let mut repos_added = 0usize;
    let mut skipped_paths: Vec<String> = Vec::new();
    // path 정규화 후 중복 제거 (GitKraken 이 같은 레포를 중복 등록할 수 있음)
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();

    for repo_path in &payload.local_repo_paths {
        let path_str = repo_path.to_string_lossy().to_string();
        let key = path_str.to_lowercase();
        if !seen.insert(key) {
            continue;
        }
        if !repo_path.exists() {
            skipped_paths.push(path_str);
            continue;
        }

        // workspace 매칭
        let ws_id = ws_by_sync
            .iter()
            .filter(|(sync, _)| {
                let s = sync.to_string_lossy().to_lowercase();
                !s.is_empty() && path_str.to_lowercase().starts_with(&s)
            })
            .max_by_key(|(sync, _)| sync.to_string_lossy().len())
            .map(|(_, id)| *id);

        let fallback_name = last_path_component(repo_path);

        // forge 메타 추론 (`docs/plan/21` M14 fix-up):
        //   - `.git/config` 의 origin URL 에서 forge_kind / owner / repo 추출
        //   - 실패 시 Unknown + warning 후 진행 (단일 레포 실패가 159 import 막지
        //     않도록 graceful degradation)
        let (name, default_branch, default_remote, forge_kind, forge_owner, forge_repo) =
            match repo::detect_meta(repo_path) {
                Ok(m) => (
                    m.name,
                    m.default_branch,
                    m.default_remote,
                    m.forge_kind,
                    m.forge_owner,
                    m.forge_repo,
                ),
                Err(e) => {
                    warnings.push(format!("detect_meta 실패 ({path_str}): {e}"));
                    (fallback_name, None, None, ForgeKindLite::Unknown, None, None)
                }
            };

        match db
            .add_repo(
                &path_str,
                ws_id,
                Some(&name),
                default_branch.as_deref(),
                default_remote.as_deref(),
                forge_kind,
                forge_owner.as_deref(),
                forge_repo.as_deref(),
            )
            .await
        {
            Ok(_) => repos_added += 1,
            Err(e) => warnings.push(format!("add_repo 실패 ({path_str}): {e}")),
        }
    }

    // 3) Pin
    let mut repos_pinned = 0usize;
    if !payload.favorites.is_empty() {
        let all_repos = db.list_repos(None).await?;
        let by_path: HashMap<String, i64> = all_repos
            .into_iter()
            .map(|r| (r.local_path.to_lowercase(), r.id))
            .collect();
        for fav in &payload.favorites {
            let key = fav.to_string_lossy().to_lowercase();
            if let Some(&id) = by_path.get(&key) {
                if let Err(e) = db.set_repo_pinned(id, true).await {
                    warnings.push(format!("pin 실패 (id={id}): {e}"));
                } else {
                    repos_pinned += 1;
                }
            } else {
                warnings.push(format!(
                    "favorite path 매칭 실패: {}",
                    fav.to_string_lossy()
                ));
            }
        }
    }

    let tabs_to_open: Vec<String> = payload
        .tabs
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect();

    Ok(ApplyResult {
        workspaces_created,
        repos_added,
        repos_pinned,
        tabs_to_open,
        skipped_paths,
        warnings,
    })
}

// ====== Tests ======

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonical_repo_path_strips_dot_git() {
        assert_eq!(
            canonical_repo_path("D:/repo/.git"),
            PathBuf::from("D:/repo")
        );
        assert_eq!(
            canonical_repo_path("D:\\repo\\.git"),
            PathBuf::from("D:/repo")
        );
        assert_eq!(canonical_repo_path("D:/repo/"), PathBuf::from("D:/repo"));
        assert_eq!(canonical_repo_path("D:/repo"), PathBuf::from("D:/repo"));
        assert_eq!(canonical_repo_path("D:/repo.git"), PathBuf::from("D:/repo"));
    }

    #[test]
    fn assign_workspace_uses_longest_prefix() {
        let projects = vec![
            ("Outer".to_string(), PathBuf::from("D:/01.Work")),
            (
                "Inner".to_string(),
                PathBuf::from("D:/01.Work/01.Projects"),
            ),
        ];
        let repo = PathBuf::from("D:/01.Work/01.Projects/foo");
        assert_eq!(assign_workspace(&repo, &projects), Some("Inner"));

        let outside = PathBuf::from("D:/02.Personal/bar");
        assert_eq!(assign_workspace(&outside, &projects), None);
    }

    #[test]
    fn resolve_name_conflict_appends_suffix() {
        let existing: std::collections::HashSet<String> = ["MyWorkspace".to_string()].into();
        let planned = std::collections::HashSet::new();
        assert_eq!(
            resolve_name_conflict("MyWorkspace", &existing, &planned),
            "MyWorkspace (GitKraken)"
        );
        assert_eq!(
            resolve_name_conflict("Brand-new", &existing, &planned),
            "Brand-new"
        );
    }

    #[test]
    fn parse_local_repo_cache_strips_dot_git() {
        let json = r#"{ "localRepoCache": ["D:/a/.git", "C:\\b\\.git"] }"#;
        let parsed: LocalRepoCacheFile = serde_json::from_str(json).unwrap();
        let canon: Vec<PathBuf> = parsed
            .paths
            .into_iter()
            .map(|s| canonical_repo_path(&s))
            .collect();
        assert_eq!(
            canon,
            vec![PathBuf::from("D:/a"), PathBuf::from("C:/b")]
        );
    }

    #[test]
    fn parse_profile_extracts_favorites_and_tabs() {
        let json = r#"{
            "favoriteRepositories": ["D:/fav"],
            "tabInfo": {
                "tabs": [
                    { "type": "REPO", "repoPath": "D:/tab1/" },
                    { "type": "FOCUS_VIEW", "repoPath": null },
                    { "type": "REPO", "repoPath": "D:/tab2" }
                ]
            }
        }"#;
        let parsed: ProfileFile = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.favorites, vec!["D:/fav".to_string()]);
        assert_eq!(parsed.tab_info.tabs.len(), 3);
        let repo_tabs: Vec<_> = parsed
            .tab_info
            .tabs
            .into_iter()
            .filter(|t| t.kind == "REPO")
            .filter_map(|t| t.repo_path)
            .collect();
        assert_eq!(repo_tabs, vec!["D:/tab1/", "D:/tab2"]);
    }

    #[test]
    fn parse_project_cache_filters_local() {
        let json = r#"{
            "projectsById": {
                "a": { "id": "a", "name": "Local A", "syncPath": "D:/A", "type": "local" },
                "b": { "id": "b", "name": "Cloud B", "type": "cloud" },
                "c": { "id": "c", "name": "Local C", "syncPath": "D:/C", "type": "local" }
            }
        }"#;
        let parsed: ProjectCacheFile = serde_json::from_str(json).unwrap();
        let mut names: Vec<_> = parsed
            .projects
            .into_values()
            .filter(|p| p.kind.as_deref() == Some("local"))
            .map(|p| p.name)
            .collect();
        names.sort();
        assert_eq!(names, vec!["Local A".to_string(), "Local C".to_string()]);
    }
}
