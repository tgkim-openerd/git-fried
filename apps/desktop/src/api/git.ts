// Tauri IPC 래퍼. 모든 git 관련 호출은 본 모듈을 통과해야 한다.
// Rust 측 commands.rs 의 #[tauri::command] 함수와 1:1 대응.
import { invoke } from '@tauri-apps/api/core'
import type {
  AddRepoArgs,
  CommitArgs,
  CommitResult,
  CommitSummary,
  DiffArgs,
  GetLogArgs,
  PullArgs,
  PushArgs,
  Repo,
  RepoStatus,
  SyncResult,
  Workspace,
} from '@/types/git'

// --- 워크스페이스 ---
export const listWorkspaces = (): Promise<Workspace[]> => invoke('list_workspaces')

export const createWorkspace = (
  name: string,
  color?: string | null,
): Promise<Workspace> => invoke('create_workspace', { name, color })

// --- 레포 ---
export const listRepos = (workspaceId?: number | null): Promise<Repo[]> =>
  invoke('list_repos', { workspaceId })

export const addRepo = (args: AddRepoArgs): Promise<Repo> =>
  invoke('add_repo', { args })

export const removeRepo = (id: number): Promise<void> =>
  invoke('remove_repo', { id })

// --- Git read ---
export const getLog = (args: GetLogArgs): Promise<CommitSummary[]> =>
  invoke('get_log', { args })

export const getStatus = (repoId: number): Promise<RepoStatus> =>
  invoke('get_status', { repoId })

// --- Stage / Unstage / Discard ---
export const stagePaths = (repoId: number, paths: string[]): Promise<void> =>
  invoke('stage_paths', { args: { repoId, paths } })

export const stageAll = (repoId: number): Promise<void> =>
  invoke('stage_all', { repoId })

export const unstagePaths = (repoId: number, paths: string[]): Promise<void> =>
  invoke('unstage_paths', { args: { repoId, paths } })

export const discardPaths = (repoId: number, paths: string[]): Promise<void> =>
  invoke('discard_paths', { args: { repoId, paths } })

export const applyPatch = (
  repoId: number,
  patch: string,
  reverse: boolean,
): Promise<void> =>
  invoke('apply_patch', { args: { repoId, patch, reverse } })

// --- Diff ---
export const getDiff = (args: DiffArgs): Promise<string> =>
  invoke('get_diff', { args })

export const getCommitDiff = (repoId: number, sha: string): Promise<string> =>
  invoke('get_commit_diff', { args: { repoId, sha } })

// --- Commit ---
export const commit = (args: CommitArgs): Promise<CommitResult> =>
  invoke('commit', { args })

export const lastCommitMessage = (repoId: number): Promise<string> =>
  invoke('last_commit_message', { repoId })

// --- Sync ---
export const fetchAll = (repoId: number): Promise<SyncResult> =>
  invoke('fetch_all', { repoId })

export const pull = (args: PullArgs): Promise<SyncResult> =>
  invoke('pull', { args })

export const push = (args: PushArgs): Promise<SyncResult> =>
  invoke('push', { args })

// --- 진단 ---
export interface AppInfo {
  version: string
  gitVersion: string | null
  platform: string
}
export const getAppInfo = (): Promise<AppInfo> => invoke('get_app_info')
