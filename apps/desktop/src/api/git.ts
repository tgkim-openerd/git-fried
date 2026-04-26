// Tauri IPC 래퍼. 모든 git 관련 호출은 본 모듈을 통과해야 한다.
// Rust 측 commands.rs 의 #[tauri::command] 함수와 1:1 대응.
import { invoke } from '@tauri-apps/api/core'
import type {
  AddRepoArgs,
  CommitSummary,
  GetLogArgs,
  Repo,
  RepoStatus,
  Workspace,
} from '@/types/git'

// --- 워크스페이스 ---
export const listWorkspaces = (): Promise<Workspace[]> =>
  invoke('list_workspaces')

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

// --- 진단 ---
export interface AppInfo {
  version: string
  gitVersion: string | null
  platform: string
}
export const getAppInfo = (): Promise<AppInfo> => invoke('get_app_info')
