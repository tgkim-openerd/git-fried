// Rust IPC 와 1:1 매핑되는 타입 정의 (serde 직렬화 대상).
// Rust 측 변경 시 본 파일도 같이 업데이트해야 함.

export type ForgeKind = 'gitea' | 'github' | 'unknown'

export interface Repo {
  id: number
  workspaceId: number | null
  name: string
  localPath: string
  defaultRemote: string | null
  defaultBranch: string | null
  forgeKind: ForgeKind
  forgeOwner: string | null
  forgeRepo: string | null
  lastFetchedAt: number | null
  isPinned: boolean
}

export interface Workspace {
  id: number
  name: string
  color: string | null
  forgeKind: ForgeKind
  createdAt: number
}

export interface CommitSummary {
  sha: string
  shortSha: string
  parentShas: string[]
  authorName: string
  authorEmail: string
  authorAt: number
  committerAt: number
  subject: string
  body: string
  signed: boolean
  refs: string[]
}

export interface RepoStatus {
  branch: string | null
  upstream: string | null
  ahead: number
  behind: number
  staged: FileChange[]
  unstaged: FileChange[]
  untracked: string[]
  conflicted: string[]
}

export interface FileChange {
  path: string
  oldPath: string | null
  status: ChangeStatus
}

export type ChangeStatus =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'typechange'
  | 'unknown'

export interface AddRepoArgs {
  localPath: string
  workspaceId?: number | null
  name?: string | null
}

export interface GetLogArgs {
  repoId: number
  limit?: number
  skip?: number
  branch?: string | null
}
