// Tauri IPC 래퍼. 모든 git 관련 호출은 본 모듈을 통과해야 한다.
// Rust 측 commands.rs 의 #[tauri::command] 함수와 1:1 대응.
//
// `invoke` 는 자체 timeout wrapper 사용 (`docs/plan/22 §2 C4`):
//   - 일반: 30s
//   - bulk_* / clone_ / fetch_ / push / pull / ai_ / maintenance_ / import_gitkraken_apply: 5min
import { invoke } from './invokeWithTimeout'
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

export const updateWorkspace = (
  id: number,
  name?: string | null,
  color?: string | null,
): Promise<Workspace> =>
  invoke('update_workspace', { args: { id, name, color } })

export const deleteWorkspace = (id: number): Promise<void> =>
  invoke('delete_workspace', { id })

// --- 레포 ---
export const listRepos = (workspaceId?: number | null): Promise<Repo[]> =>
  invoke('list_repos', { workspaceId })

export const addRepo = (args: AddRepoArgs): Promise<Repo> =>
  invoke('add_repo', { args })

export const removeRepo = (id: number): Promise<void> =>
  invoke('remove_repo', { id })

export const setRepoPinned = (id: number, pinned: boolean): Promise<Repo> =>
  invoke('set_repo_pinned', { args: { id, pinned } })

/** Sprint F4 — OS 파일 매니저로 레포 경로 열기 (⌥O). */
export const openInExplorer = (repoId: number): Promise<void> =>
  invoke('open_in_explorer', { repoId })

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

export const getCommitDiff = (
  repoId: number,
  sha: string,
  context?: number | null,
): Promise<string> =>
  invoke('get_commit_diff', { args: { repoId, sha, context } })

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
/** stash@{n} 의 단일 파일만 working tree 에 apply (`docs/plan/14 §5 D1`). */
export const applyStashFile = (
  repoId: number,
  index: number,
  path: string,
): Promise<void> =>
  invoke('apply_stash_file', { args: { repoId, index, path } })

/** stash@{n} 메시지 수정 (`docs/plan/14 §5 D2`). 새 entry 가 stash@{0} 으로 이동. */
export const editStashMessage = (
  repoId: number,
  index: number,
  message: string,
): Promise<void> =>
  invoke('edit_stash_message', { args: { repoId, index, message } })

// --- Compare (`docs/plan/14 §2 A1`) ---
export interface CompareCommit {
  sha: string
  author: string
  authorAt: number
  summary: string
}
export interface CompareResult {
  commits: CompareCommit[]
  diff: string
  leftCount: number
  rightCount: number
}
export const compareRefs = (
  repoId: number,
  ref1: string,
  ref2: string,
): Promise<CompareResult> =>
  invoke('compare_refs', { args: { repoId, ref1, ref2 } })

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

// === 3-way merge ===
export interface ConflictedFile {
  path: string
  base: string | null
  ours: string | null
  theirs: string | null
  working: string | null
}
export type SideTake = 'ours' | 'theirs'
export const readConflicted = (repoId: number, path: string): Promise<ConflictedFile> =>
  invoke('read_conflicted', { args: { repoId, path } })
export const writeResolved = (
  repoId: number,
  path: string,
  content: string,
): Promise<void> => invoke('write_resolved', { args: { repoId, path, content } })
export const takeSide = (
  repoId: number,
  path: string,
  side: SideTake,
): Promise<void> => invoke('take_side', { args: { repoId, path, side } })

// Sprint C6 — 외부 merge tool launch
export interface MergetoolResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number | null
}

export const launchMergetool = (
  repoId: number,
  file?: string | null,
  tool?: string | null,
): Promise<MergetoolResult> =>
  invoke('launch_mergetool', { args: { repoId, file, tool } })

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

// === LFS ===
export interface LfsStatus {
  installed: boolean
  version: string | null
  trackedPatterns: string[]
}
export interface LfsFile {
  path: string
  oid: string
  downloaded: boolean
  size: number | null
}
export const lfsStatus = (repoId: number): Promise<LfsStatus> =>
  invoke('lfs_status', { repoId })
export const lfsListFiles = (repoId: number): Promise<LfsFile[]> =>
  invoke('lfs_list_files', { repoId })
export const lfsTrack = (repoId: number, pattern: string): Promise<void> =>
  invoke('lfs_track', { args: { repoId, pattern } })
export const lfsUntrack = (repoId: number, pattern: string): Promise<void> =>
  invoke('lfs_untrack', { args: { repoId, pattern } })
export const lfsFetch = (repoId: number): Promise<void> =>
  invoke('lfs_fetch', { repoId })
export const lfsPull = (repoId: number): Promise<void> =>
  invoke('lfs_pull', { repoId })
export const lfsPrune = (repoId: number): Promise<void> =>
  invoke('lfs_prune', { repoId })

// Sprint C2 — pre-push size estimation
export interface LfsPushSize {
  commitCount: number
  fileCount: number
  totalBytes: number
  note: string | null
}

export const lfsPushSize = (repoId: number): Promise<LfsPushSize> =>
  invoke('lfs_push_size', { repoId })

// === Bisect ===
export type BisectMark = 'good' | 'bad' | 'skip'
export interface BisectStatus {
  inProgress: boolean
  currentSha: string | null
  good: string[]
  bad: string[]
  lastOutput: string
}
export const getBisectStatus = (repoId: number): Promise<BisectStatus> =>
  invoke('bisect_status', { repoId })
export const bisectStart = (repoId: number): Promise<string> =>
  invoke('bisect_start', { repoId })
export const bisectMark = (
  repoId: number,
  mark: BisectMark,
  sha?: string,
): Promise<string> => invoke('bisect_mark', { args: { repoId, mark, sha } })
export const bisectReset = (repoId: number): Promise<void> =>
  invoke('bisect_reset', { repoId })

// === Reflog ===
export interface ReflogEntry {
  sha: string
  shortSha: string
  refLabel: string
  action: string
  subject: string
  at: number
}
export const listReflog = (
  repoId: number,
  refName?: string,
  limit?: number,
): Promise<ReflogEntry[]> =>
  invoke('list_reflog', { args: { repoId, refName, limit } })

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

// Sprint C1
export const lockWorktree = (
  repoId: number,
  path: string,
  reason?: string | null,
): Promise<void> =>
  invoke('lock_worktree', { args: { repoId, path, reason } })

export const unlockWorktree = (repoId: number, path: string): Promise<void> =>
  invoke('unlock_worktree', { args: { repoId, path } })

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
export const aiResolveConflict = (
  repoId: number,
  cli: AiCli,
  path: string,
  userApproved: boolean,
): Promise<AiOutput> =>
  invoke('ai_resolve_conflict', { args: { repoId, cli, path, userApproved } })

export const aiCodeReview = (args: {
  repoId: number
  cli: AiCli
  headBranch: string
  baseBranch: string
  prTitle: string
  prBody: string
  userApproved: boolean
}): Promise<AiOutput> => invoke('ai_code_review', { args })

// === Sprint B7 — AI Explain / Stash message (docs/plan/11 §18) ===
export const aiExplainCommit = (
  repoId: number,
  cli: AiCli,
  sha: string,
  userApproved: boolean,
): Promise<AiOutput> =>
  invoke('ai_explain_commit', { args: { repoId, cli, sha, userApproved } })

export const aiExplainBranch = (
  repoId: number,
  cli: AiCli,
  headBranch: string,
  baseBranch: string,
  userApproved: boolean,
): Promise<AiOutput> =>
  invoke('ai_explain_branch', {
    args: { repoId, cli, headBranch, baseBranch, userApproved },
  })

export const aiStashMessage = (
  repoId: number,
  cli: AiCli,
  includeUntracked: boolean,
  userApproved: boolean,
): Promise<AiOutput> =>
  invoke('ai_stash_message', {
    args: { repoId, cli, includeUntracked, userApproved },
  })

// === Sprint B3 — Commit Composer AI ===
export const aiComposerPlan = (
  repoId: number,
  cli: AiCli,
  count: number,
  userApproved: boolean,
): Promise<AiOutput> =>
  invoke('ai_composer_plan', { args: { repoId, cli, count, userApproved } })

// === Interactive rebase (docs/plan/09 옵션 A) ===
export type RebaseAction = 'pick' | 'reword' | 'squash' | 'fixup' | 'drop'

export interface RebaseTodoEntry {
  action: RebaseAction
  sha: string
  subject: string
  newMessage: string | null
}

export interface RebaseStatus {
  inProgress: boolean
  currentStep: number | null
  totalSteps: number | null
  stoppedAt: string | null
  conflict: boolean
  headName: string | null
}

export interface RebaseRunResult {
  success: boolean
  exitCode: number | null
  stdout: string
  stderr: string
  status: RebaseStatus
}

export const rebasePrepareTodo = (
  repoId: number,
  count: number,
): Promise<RebaseTodoEntry[]> =>
  invoke('rebase_prepare_todo', { args: { repoId, count } })

export const rebaseRun = (
  repoId: number,
  base: string,
  todo: RebaseTodoEntry[],
): Promise<RebaseRunResult> =>
  invoke('rebase_run', { args: { repoId, base, todo } })

export const getRebaseStatus = (repoId: number): Promise<RebaseStatus> =>
  invoke('rebase_status', { repoId })

export const rebaseContinue = (repoId: number): Promise<RebaseRunResult> =>
  invoke('rebase_continue', { repoId })

export const rebaseAbort = (repoId: number): Promise<void> =>
  invoke('rebase_abort', { repoId })

export const rebaseSkip = (repoId: number): Promise<RebaseRunResult> =>
  invoke('rebase_skip', { repoId })

// === Launchpad PR meta + Saved Views (docs/plan/11 §14 / Sprint A4) ===
export interface PrIdentifier {
  forgeKind: string
  baseUrl: string
  owner: string
  repo: string
  number: number
}

export interface PrMeta {
  id: number
  forgeKind: string
  baseUrl: string
  owner: string
  repo: string
  number: number
  pinned: boolean
  /** unix ts; null = active. 만료된 시각이면 클라이언트가 active 로 처리. */
  snoozedUntil: number | null
  updatedAt: number
}

export interface SavedView {
  id: number
  viewKind: string
  name: string
  filterJson: string
  sortJson: string | null
  createdAt: number
  updatedAt: number
}

export const launchpadListActive = (): Promise<PrMeta[]> =>
  invoke('launchpad_list_active')

export const launchpadListForRepo = (
  forgeKind: string,
  baseUrl: string,
  owner: string,
  repo: string,
): Promise<PrMeta[]> =>
  invoke('launchpad_list_for_repo', {
    args: { forgeKind, baseUrl, owner, repo },
  })

export const launchpadSetPinned = (
  id: PrIdentifier,
  pinned: boolean,
): Promise<PrMeta> =>
  invoke('launchpad_set_pinned', { args: { ...id, pinned } })

export const launchpadSetSnooze = (
  id: PrIdentifier,
  snoozedUntil: number | null,
): Promise<PrMeta> =>
  invoke('launchpad_set_snooze', { args: { ...id, snoozedUntil } })

export const launchpadCleanupDefaults = (): Promise<number> =>
  invoke('launchpad_cleanup_defaults')

export const launchpadListViews = (viewKind: string): Promise<SavedView[]> =>
  invoke('launchpad_list_views', { args: { viewKind } })

export const launchpadSaveView = (args: {
  viewKind: string
  name: string
  filterJson: string
  sortJson?: string | null
}): Promise<SavedView> =>
  invoke('launchpad_save_view', {
    args: {
      viewKind: args.viewKind,
      name: args.name,
      filterJson: args.filterJson,
      sortJson: args.sortJson ?? null,
    },
  })

export const launchpadDeleteView = (id: number): Promise<void> =>
  invoke('launchpad_delete_view', { id })

/**
 * v1 단순화 — `(forgeKind, baseUrl, owner, repo, number)` 5-tuple 의 baseUrl
 * 채움. PullRequest 응답에 baseUrl 이 없으므로 forge_kind 별 단일 instance 가정.
 * 다중 instance 지원은 v1.x.
 */
export function inferBaseUrl(forgeKind: string): string {
  return forgeKind === 'gitea' ? 'gitea-default' : 'github.com'
}

// === Sprint B8 — Branch / Commit drag-drop ops ===
export interface MergeOpResult {
  success: boolean
  conflicted: boolean
  stdout: string
  stderr: string
}

export const mergeBranch = (
  repoId: number,
  source: string,
  noFf: boolean = true,
  noCommit: boolean = false,
): Promise<MergeOpResult> =>
  invoke('merge_branch', { args: { repoId, source, noFf, noCommit } })

export const rebaseBranch = (
  repoId: number,
  upstream: string,
): Promise<MergeOpResult> =>
  invoke('rebase_branch', { args: { repoId, upstream } })

export const cherryPickSha = (
  repoId: number,
  sha: string,
  targetBranch?: string | null,
): Promise<MergeOpResult> =>
  invoke('cherry_pick_sha', { args: { repoId, sha, targetBranch } })

// === Conflict Prediction (Sprint B2 / docs/plan/11 §20) ===
export interface ConflictPrediction {
  ok: boolean
  target: string
  conflictFiles: string[]
  note: string | null
}

export const predictTargetConflict = (
  repoId: number,
  target?: string | null,
): Promise<ConflictPrediction> =>
  invoke('predict_target_conflict', { args: { repoId, target } })

// === Repo alias (Sprint B4 / docs/plan/11 §15) ===
export interface RepoAlias {
  profileId: number | null
  repoId: number
  alias: string
  updatedAt: number
}

export const listAllRepoAliases = (): Promise<RepoAlias[]> =>
  invoke('list_all_repo_aliases')

export const resolveRepoAlias = (
  repoId: number,
  profileId: number | null,
): Promise<string | null> =>
  invoke('resolve_repo_alias', { args: { repoId, profileId } })

export const setRepoAlias = (
  repoId: number,
  profileId: number | null,
  alias: string,
): Promise<RepoAlias> =>
  invoke('set_repo_alias', { args: { repoId, profileId, alias } })

export const unsetRepoAlias = (
  repoId: number,
  profileId: number | null,
): Promise<void> =>
  invoke('unset_repo_alias', { args: { repoId, profileId } })

// === Hide branches (docs/plan/11 §5d / Sprint A1) ===
export type HiddenRefKind = 'branch' | 'remote' | 'tag' | 'stash'

export interface HiddenRef {
  refName: string
  refKind: HiddenRefKind
  hiddenAt: number
}

export const listHiddenRefs = (repoId: number): Promise<HiddenRef[]> =>
  invoke('list_hidden_refs', { repoId })

export const hideRef = (
  repoId: number,
  refName: string,
  refKind: HiddenRefKind,
): Promise<void> =>
  invoke('hide_ref', { args: { repoId, refName, refKind } })

export const unhideRef = (repoId: number, refName: string): Promise<void> =>
  invoke('unhide_ref', { args: { repoId, refName } })

export const hideRefsBulk = (
  repoId: number,
  refs: { refName: string; refKind: HiddenRefKind }[],
): Promise<number> => invoke('hide_refs_bulk', { args: { repoId, refs } })

export const unhideRefsByKind = (
  repoId: number,
  refKind: HiddenRefKind,
): Promise<number> =>
  invoke('unhide_refs_by_kind', { args: { repoId, refKind } })

export const unhideAllRefs = (repoId: number): Promise<number> =>
  invoke('unhide_all_refs', { repoId })

// === 통합 터미널 (docs/plan/10 옵션 A) — Tauri Channel<Vec<u8>> stream ===
import { Channel } from '@tauri-apps/api/core'

export const ptyOpen = (
  cwd: string,
  shell: string,
  cols: number,
  rows: number,
  onData: Channel<number[]>,
): Promise<number> =>
  invoke('pty_open', { args: { cwd, shell, cols, rows }, onData })

export const ptyWrite = (id: number, data: number[]): Promise<void> =>
  invoke('pty_write', { args: { id, data } })

export const ptyResize = (
  id: number,
  cols: number,
  rows: number,
): Promise<void> => invoke('pty_resize', { args: { id, cols, rows } })

export const ptyClose = (id: number): Promise<void> =>
  invoke('pty_close', { id })

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

// === PR Review / Comments / Merge ===
export type ReviewVerdict = 'comment' | 'approve' | 'request_changes'
export type MergeMethod = 'merge' | 'squash' | 'rebase'

export interface PrComment {
  id: number
  author: ForgeAuthor
  bodyMd: string
  createdAt: number
  htmlUrl: string
}

export const listPrComments = (repoId: number, number: number): Promise<PrComment[]> =>
  invoke('list_pr_comments', { args: { repoId, number } })

export const addPrComment = (
  repoId: number,
  number: number,
  body: string,
): Promise<PrComment> => invoke('add_pr_comment', { args: { repoId, number, body } })

/** PR diff line-level suggestion 코멘트 (`docs/plan/14 §7 F1`).
 *  - body 는 호출자가 ```suggestion wrap 까지 포함해서 전달.
 *  - line 은 RIGHT side (PR 새 코드) 의 1-based file line 번호.
 *  - commitId=null 이면 GitHub 가 PR head SHA 자동 조회. */
export const addReviewComment = (
  repoId: number,
  number: number,
  path: string,
  line: number,
  body: string,
  commitId: string | null = null,
): Promise<void> =>
  invoke('add_review_comment', {
    args: { repoId, number, commitId, path, line, body },
  })

export const submitPrReview = (
  repoId: number,
  number: number,
  verdict: ReviewVerdict,
  body: string,
): Promise<void> =>
  invoke('submit_pr_review', { args: { repoId, number, verdict, body } })

export const mergePr = (
  repoId: number,
  number: number,
  method: MergeMethod,
  title?: string,
  message?: string,
): Promise<void> =>
  invoke('merge_pr', { args: { repoId, number, method, title, message } })

export const closePr = (repoId: number, number: number): Promise<void> =>
  invoke('close_pr', { args: { repoId, number } })

export const reopenPr = (repoId: number, number: number): Promise<void> =>
  invoke('reopen_pr', { args: { repoId, number } })

// --- 진단 ---
export interface AppInfo {
  version: string
  gitVersion: string | null
  platform: string
}
export const getAppInfo = (): Promise<AppInfo> => invoke('get_app_info')

// --- Clone with options (`docs/plan/14 §6 E1+E2` Sprint C14-2) ---

export interface CloneOptions {
  sparsePaths?: string[] | null
  depth?: number | null
  shallowSince?: string | null
  singleBranch?: string | null
  bare?: boolean
}

export interface CloneResult {
  targetPath: string
  stdout: string
  stderr: string
}

export interface CloneRepoResult {
  clone: CloneResult
  registeredRepo: Repo | null
  warning: string | null
}

export const cloneRepo = (
  url: string,
  targetPath: string,
  options: CloneOptions = {},
  autoRegister = true,
  workspaceId: number | null = null,
): Promise<CloneRepoResult> =>
  invoke('clone_repo', {
    args: { url, targetPath, options, autoRegister, workspaceId },
  })

// --- Tag panel (`docs/plan/14 §8 G1` Sprint C14) ---

export interface TagInfo {
  name: string
  commitSha: string | null
  taggerName: string | null
  taggerAt: number | null
  subject: string | null
  annotated: boolean
}

export const listTags = (repoId: number): Promise<TagInfo[]> =>
  invoke('list_tags', { repoId })

export const createTag = (
  repoId: number,
  name: string,
  target?: string | null,
  message?: string | null,
): Promise<void> =>
  invoke('create_tag', { args: { repoId, name, target, message } })

export const deleteTag = (repoId: number, name: string): Promise<void> =>
  invoke('delete_tag', { args: { repoId, name } })

export const pushTag = (
  repoId: number,
  remote: string,
  name: string,
): Promise<void> =>
  invoke('push_tag', { args: { repoId, remote, name } })

export const deleteRemoteTag = (
  repoId: number,
  remote: string,
  name: string,
): Promise<void> =>
  invoke('delete_remote_tag', { args: { repoId, remote, name } })

// --- Repository-Specific Preferences (`docs/plan/14 §3` Sprint B14-3) ---

export interface RepoConfigSnapshot {
  hooksPath: string | null
  commitEncoding: string | null
  logOutputEncoding: string | null
  gitflowBranchMaster: string | null
  gitflowBranchDevelop: string | null
  gitflowPrefixFeature: string | null
  gitflowPrefixRelease: string | null
  gitflowPrefixHotfix: string | null
  commitGpgsign: string | null
  userSigningkey: string | null
  gpgFormat: string | null
  userName: string | null
  userEmail: string | null
}

export const readRepoConfig = (repoId: number): Promise<RepoConfigSnapshot> =>
  invoke('read_repo_config', { repoId })

export const applyRepoConfig = (
  repoId: number,
  snapshot: RepoConfigSnapshot,
): Promise<void> =>
  invoke('apply_repo_config', { args: { repoId, snapshot } })

// --- Repo Maintenance (`docs/plan/14 §2 A2` Sprint B14-2) ---

export interface MaintenanceResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number | null
}

export const maintenanceGc = (
  repoId: number,
  aggressive: boolean,
): Promise<MaintenanceResult> =>
  invoke('maintenance_gc', { args: { repoId, aggressive } })

export const maintenanceFsck = (repoId: number): Promise<MaintenanceResult> =>
  invoke('maintenance_fsck', { repoId })

export const lfsInstall = (repoId: number): Promise<void> =>
  invoke('lfs_install', { repoId })

// --- Remote 관리 (`docs/plan/14 §4` Sprint B14-1) ---

export interface RemoteInfo {
  name: string
  fetchUrl: string | null
  pushUrl: string | null
}

export const listRemotes = (repoId: number): Promise<RemoteInfo[]> =>
  invoke('list_remotes', { repoId })

export const addRemote = (
  repoId: number,
  name: string,
  url: string,
): Promise<void> => invoke('add_remote', { args: { repoId, name, url } })

export const removeRemote = (repoId: number, name: string): Promise<void> =>
  invoke('remove_remote', { args: { repoId, name } })

export const renameRemote = (
  repoId: number,
  oldName: string,
  newName: string,
): Promise<void> =>
  invoke('rename_remote', { args: { repoId, oldName, newName } })

export const setRemoteUrl = (
  repoId: number,
  name: string,
  url: string,
): Promise<void> => invoke('set_remote_url', { args: { repoId, name, url } })

// --- GitKraken importer (`docs/plan/21`) ---

export interface GitKrakenDetect {
  profileDir: string
  repoCount: number
  workspaceCount: number
  favoriteCount: number
  tabCount: number
}

export interface GitKrakenImportPlan {
  workspacesToCreate: string[]
  reposToAdd: number
  reposToPin: string[]
  tabsToOpen: string[]
  skippedPaths: string[]
}

export interface GitKrakenApplyResult {
  workspacesCreated: number
  reposAdded: number
  reposPinned: number
  tabsToOpen: string[]
  skippedPaths: string[]
  warnings: string[]
}

export const importGitKrakenDetect = (): Promise<GitKrakenDetect | null> =>
  invoke('import_gitkraken_detect')

export const importGitKrakenDryRun = (
  profileDir: string,
): Promise<GitKrakenImportPlan> =>
  invoke('import_gitkraken_dry_run', { args: { profileDir } })

export const importGitKrakenApply = (
  profileDir: string,
): Promise<GitKrakenApplyResult> =>
  invoke('import_gitkraken_apply', { args: { profileDir } })
