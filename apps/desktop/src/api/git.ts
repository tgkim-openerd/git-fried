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

// --- Commit graph ---
export interface GraphRow {
  commit: CommitSummary
  lane: number
  parentLanes: number[]
  crossingLanes: number[]
  isMerge: boolean
}
export interface GraphResult {
  rows: GraphRow[]
  maxLane: number
}
export const getGraph = (repoId: number, limit?: number): Promise<GraphResult> =>
  invoke('get_graph', { args: { repoId, limit } })

// --- Branches ---
export interface BranchInfo {
  name: string
  kind: 'local' | 'remote'
  isHead: boolean
  upstream: string | null
  lastCommitSha: string | null
  lastCommitSubject: string | null
  ahead: number
  behind: number
}
export const listBranches = (repoId: number): Promise<BranchInfo[]> =>
  invoke('list_branches', { repoId })
export const switchBranch = (repoId: number, name: string, create = false): Promise<void> =>
  invoke('switch_branch', { args: { repoId, name, create } })
export const createBranch = (repoId: number, name: string, start?: string): Promise<void> =>
  invoke('create_branch', { args: { repoId, name, start } })
export const deleteBranch = (repoId: number, name: string, force = false): Promise<void> =>
  invoke('delete_branch', { args: { repoId, name, force } })
export const renameBranch = (repoId: number, oldName: string, newName: string): Promise<void> =>
  invoke('rename_branch', { args: { repoId, oldName, newName } })

// --- Stash ---
export interface StashEntry {
  index: number
  sha: string
  message: string
  branch: string | null
  createdAt: number
}
export const listStash = (repoId: number): Promise<StashEntry[]> =>
  invoke('list_stash', { repoId })
export const pushStash = (
  repoId: number,
  message?: string | null,
  includeUntracked = false,
): Promise<void> =>
  invoke('push_stash', { args: { repoId, message, includeUntracked } })
export const applyStash = (repoId: number, index: number): Promise<void> =>
  invoke('apply_stash', { args: { repoId, index } })
export const popStash = (repoId: number, index: number): Promise<void> =>
  invoke('pop_stash', { args: { repoId, index } })
export const dropStash = (repoId: number, index: number): Promise<void> =>
  invoke('drop_stash', { args: { repoId, index } })
export const showStash = (repoId: number, index: number): Promise<string> =>
  invoke('show_stash', { args: { repoId, index } })

// --- Submodule ---
export interface SubmoduleEntry {
  path: string
  sha: string | null
  status: 'uninitialized' | 'initialized' | 'modified' | 'conflicted' | 'unknown'
  flag: string
}
export const listSubmodules = (repoId: number): Promise<SubmoduleEntry[]> =>
  invoke('list_submodules', { repoId })
export const initSubmodules = (repoId: number): Promise<void> =>
  invoke('init_submodules', { repoId })
export const updateSubmodules = (repoId: number, remote = false): Promise<void> =>
  invoke('update_submodules', { args: { repoId, remote } })
export const syncSubmodules = (repoId: number): Promise<void> =>
  invoke('sync_submodules', { repoId })

// --- Bulk (multi-repo) ---
export interface BulkResult<T> {
  repoId: number
  repoName: string
  success: boolean
  data: T | null
  error: string | null
}
export const bulkFetch = (
  workspaceId?: number | null,
): Promise<BulkResult<SyncResult>[]> => invoke('bulk_fetch', { workspaceId })
export const bulkStatus = (
  workspaceId?: number | null,
): Promise<BulkResult<RepoStatus>[]> => invoke('bulk_status', { workspaceId })

export const bulkListPrs = (
  workspaceId?: number | null,
  stateFilter?: PrState | null,
): Promise<BulkResult<PullRequest[]>[]> =>
  invoke('bulk_list_prs', { args: { workspaceId, stateFilter } })

// --- Reset / Revert ---
export type ResetMode = 'soft' | 'mixed' | 'hard' | 'keep'
export const reset = (repoId: number, mode: ResetMode, target: string): Promise<void> =>
  invoke('reset', { args: { repoId, mode, target } })
export const revert = (repoId: number, sha: string, noCommit = false): Promise<void> =>
  invoke('revert', { args: { repoId, sha, noCommit } })

// === File history / Blame ===
export interface BlameLine {
  sha: string
  shortSha: string
  authorName: string
  authorAt: number
  summary: string
  originalLine: number
  finalLine: number
  content: string
}
export const getFileHistory = (
  repoId: number,
  path: string,
  limit?: number,
): Promise<CommitSummary[]> =>
  invoke('get_file_history', { args: { repoId, path, limit } })
export const getFileBlame = (repoId: number, path: string): Promise<BlameLine[]> =>
  invoke('get_file_blame', { args: { repoId, path } })

// === Profiles (개인 ↔ 회사 1-click 토글) ===
export interface Profile {
  id: number
  name: string
  gitUserName: string | null
  gitUserEmail: string | null
  signingKey: string | null
  sshKeyPath: string | null
  defaultForgeAccountId: number | null
  isActive: boolean
}
export interface ProfileInput {
  name: string
  gitUserName?: string | null
  gitUserEmail?: string | null
  signingKey?: string | null
  sshKeyPath?: string | null
  defaultForgeAccountId?: number | null
}
export const listProfiles = (): Promise<Profile[]> => invoke('list_profiles')
export const createProfile = (input: ProfileInput): Promise<Profile> =>
  invoke('create_profile', { input })
export const updateProfile = (id: number, input: ProfileInput): Promise<Profile> =>
  invoke('update_profile', { args: { id, input } })
export const deleteProfile = (id: number): Promise<void> =>
  invoke('delete_profile', { id })
export const activateProfile = (id: number): Promise<Profile> =>
  invoke('activate_profile', { id })

// === Worktree ===
export interface WorktreeEntry {
  path: string
  branch: string | null
  headSha: string | null
  isMain: boolean
  isLocked: boolean
  isPrunable: boolean
  sizeBytes: number | null
}
export const listWorktrees = (repoId: number): Promise<WorktreeEntry[]> =>
  invoke('list_worktrees', { repoId })
export const addWorktree = (args: {
  repoId: number
  path: string
  createBranch?: string
  branch?: string
  startPoint?: string
}): Promise<void> => invoke('add_worktree', { args })
export const removeWorktree = (
  repoId: number,
  path: string,
  force = false,
): Promise<void> =>
  invoke('remove_worktree', { args: { repoId, path, force } })
export const pruneWorktrees = (repoId: number): Promise<void> =>
  invoke('prune_worktrees', { repoId })

// === Cherry-pick (멀티 레포) ===
export type CherryPickStrategy = 'default' | 'mainlineParent'
export interface CherryPickResult {
  repoId: number
  repoName: string
  success: boolean
  stdout: string
  stderr: string
  conflicted: boolean
}
export const bulkCherryPick = (args: {
  repoIds: number[]
  sha: string
  strategy: CherryPickStrategy
  noCommit?: boolean
}): Promise<CherryPickResult[]> => invoke('bulk_cherry_pick', { args })

// === AI (Claude / Codex CLI subprocess) ===
export type AiCli = 'claude' | 'codex'
export interface AiProbe {
  cli: AiCli
  installed: boolean
  version: string | null
}
export interface AiOutput {
  success: boolean
  text: string
  stderr: string
  tookMs: number
}
export const aiDetectClis = (): Promise<AiProbe[]> => invoke('ai_detect_clis')
export const aiCommitMessage = (
  repoId: number,
  cli: AiCli,
  userApproved: boolean,
): Promise<AiOutput> =>
  invoke('ai_commit_message', { args: { repoId, cli, userApproved } })
export const aiPrBody = (
  repoId: number,
  cli: AiCli,
  headBranch: string,
  baseBranch: string,
  userApproved: boolean,
): Promise<AiOutput> =>
  invoke('ai_pr_body', {
    args: { repoId, cli, headBranch, baseBranch, userApproved },
  })

// === Forge (Gitea + GitHub) ===
export type PrState = 'open' | 'closed' | 'merged' | 'draft'
export type IssueState = 'open' | 'closed'
export type ForgeKindWide = 'gitea' | 'github'

export interface ForgeAuthor {
  username: string
  displayName: string | null
  avatarUrl: string | null
}
export interface ForgeLabel {
  name: string
  color: string
}
export interface PullRequest {
  forgeKind: ForgeKindWide
  owner: string
  repo: string
  number: number
  title: string
  bodyMd: string
  state: PrState
  headBranch: string
  baseBranch: string
  headSha: string | null
  author: ForgeAuthor
  createdAt: number
  updatedAt: number
  merged: boolean
  mergeable: boolean | null
  draft: boolean
  labels: ForgeLabel[]
  comments: number
  additions: number | null
  deletions: number | null
  htmlUrl: string
}
export interface ForgeIssue {
  forgeKind: ForgeKindWide
  owner: string
  repo: string
  number: number
  title: string
  bodyMd: string
  state: IssueState
  author: ForgeAuthor
  labels: ForgeLabel[]
  createdAt: number
  updatedAt: number
  comments: number
  htmlUrl: string
}
export interface ForgeRelease {
  forgeKind: ForgeKindWide
  owner: string
  repo: string
  tag: string
  name: string
  bodyMd: string
  draft: boolean
  prerelease: boolean
  createdAt: number
  htmlUrl: string
}
export interface ForgeAccount {
  id: number
  forgeKind: string
  baseUrl: string
  username: string | null
  keychainRef: string
}

export const forgeSaveToken = (
  forgeKind: 'gitea' | 'github',
  baseUrl: string,
  username: string | null,
  token: string,
): Promise<ForgeAccount> =>
  invoke('forge_save_token', {
    args: { forgeKind, baseUrl, username, token },
  })

export const forgeListAccounts = (): Promise<ForgeAccount[]> =>
  invoke('forge_list_accounts')

export const forgeDeleteAccount = (id: number): Promise<void> =>
  invoke('forge_delete_account', { id })

export const forgeWhoami = (
  forgeKind: 'gitea' | 'github',
  baseUrl: string,
  token: string,
): Promise<ForgeAuthor> =>
  invoke('forge_whoami', { args: { forgeKind, baseUrl, token } })

export const listPullRequests = (
  repoId: number,
  stateFilter?: PrState | null,
): Promise<PullRequest[]> =>
  invoke('list_pull_requests', { args: { repoId, stateFilter } })

export const getPullRequest = (repoId: number, number: number): Promise<PullRequest> =>
  invoke('get_pull_request', { args: { repoId, number } })

export const createPullRequest = (args: {
  repoId: number
  title: string
  body: string
  head: string
  base: string
  draft?: boolean
}): Promise<PullRequest> => invoke('create_pull_request', { args })

export const listForgeIssues = (repoId: number): Promise<ForgeIssue[]> =>
  invoke('list_issues', { repoId })

export const listForgeReleases = (repoId: number): Promise<ForgeRelease[]> =>
  invoke('list_releases', { repoId })

// --- 진단 ---
export interface AppInfo {
  version: string
  gitVersion: string | null
  platform: string
}
export const getAppInfo = (): Promise<AppInfo> => invoke('get_app_info')
