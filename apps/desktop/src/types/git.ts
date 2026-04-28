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
  forgeKind: ForgeKind | 'mixed'
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
  isClean: boolean
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

export interface CommitArgs {
  repoId: number
  message: string
  amend?: boolean
  allowEmpty?: boolean
  noVerify?: boolean
  signoff?: boolean
  author?: string | null
}

export interface CommitResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number | null
  newSha: string | null
}

export interface SyncResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number | null
}

export interface DiffArgs {
  repoId: number
  staged: boolean
  path?: string | null
  rev?: string | null
  context?: number | null
}

export interface PushArgs {
  repoId: number
  remote?: string | null
  branch?: string | null
  forceWithLease?: boolean
  setUpstream?: boolean
  tags?: boolean
}

export interface PullArgs {
  repoId: number
  remote?: string | null
  branch?: string | null
}

// === Conventional Commits ===
export type ConventionalType =
  | 'feat'
  | 'fix'
  | 'chore'
  | 'docs'
  | 'refactor'
  | 'perf'
  | 'test'
  | 'ci'
  | 'build'
  | 'style'
  | 'revert'

export const CONVENTIONAL_TYPES: ConventionalType[] = [
  'feat',
  'fix',
  'chore',
  'docs',
  'refactor',
  'perf',
  'test',
  'ci',
  'build',
  'style',
  'revert',
]

// TYPE-007 fix — type guard 추출. CommitMessageInput 의 amend prefill + AI commit 결과 파싱
// 두 곳에서 동일한 `m[1] as ConventionalType` 캐스트 중복 제거.
export function isConventionalType(s: string): s is ConventionalType {
  return (CONVENTIONAL_TYPES as string[]).includes(s)
}

export interface ConventionalParts {
  type: ConventionalType
  scope: string
  breaking: boolean
  subject: string
  body: string
  footer: string
}

/**
 * Conventional Commit 메시지 빌더.
 * 형식: `<type>(<scope>)!: <subject>\n\n<body>\n\n<footer>`
 */
export function buildConventional(parts: ConventionalParts): string {
  const scope = parts.scope.trim() ? `(${parts.scope.trim()})` : ''
  const breaking = parts.breaking ? '!' : ''
  const head = `${parts.type}${scope}${breaking}: ${parts.subject.trim()}`
  const sections = [head]
  if (parts.body.trim()) sections.push(parts.body.trim())
  if (parts.footer.trim()) sections.push(parts.footer.trim())
  return sections.join('\n\n')
}
