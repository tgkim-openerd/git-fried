/**
 * Dev-only IPC mock layer (`docs/plan/23` Sprint 23).
 *
 * 목적: Tauri 부재 환경 (브라우저 직접 띄움 — `bun run dev`) 에서 모든 화면이
 * 데이터로 채워진 상태로 렌더되도록 한다. 디자이너 캡처 / Playwright 스크린샷
 * 자동화 / Storybook 미도입 시점의 임시 fixture 역할.
 *
 * 활성 조건: `import.meta.env.DEV` AND `window.__TAURI_INTERNALS__` 부재.
 * 실 Tauri webview 안에서는 절대 활성화되지 않는다 (production 도 자동 우회).
 *
 * Fixture 정체성:
 *  - 한글 commit subject (시각폭 검증)
 *  - 회사 Gitea + 개인 GitHub 듀얼 워크스페이스
 *  - ahead/behind / conflict / submodule / LFS / worktree 모두 표현
 *  - 50+ 레포 시나리오는 launchpad fail 케이스로 일부 표현
 */

const NOW = Date.now()
const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const t = (offsetMs: number) => Math.floor((NOW + offsetMs) / 1000)

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures

const WORKSPACES = [
  { id: 1, name: '회사 (opnd)', color: '#3B82F6', forgeKind: 'gitea' as const, createdAt: t(-30 * DAY) },
  { id: 2, name: '개인 (GitHub)', color: '#8B5CF6', forgeKind: 'github' as const, createdAt: t(-90 * DAY) },
  { id: 3, name: 'OSS 기여', color: '#10B981', forgeKind: 'mixed' as const, createdAt: t(-14 * DAY) },
]

const REPOS = [
  { id: 1, workspaceId: 1, name: 'frontend', localPath: 'C:/work/opnd/frontend', defaultRemote: 'origin', defaultBranch: 'main', forgeKind: 'gitea' as const, forgeOwner: 'opnd', forgeRepo: 'frontend', lastFetchedAt: t(-3 * MINUTE), isPinned: true },
  { id: 2, workspaceId: 1, name: 'frontend-admin', localPath: 'C:/work/opnd/frontend-admin', defaultRemote: 'origin', defaultBranch: 'main', forgeKind: 'gitea' as const, forgeOwner: 'opnd', forgeRepo: 'frontend-admin', lastFetchedAt: t(-3 * MINUTE), isPinned: true },
  { id: 3, workspaceId: 1, name: 'backend-api', localPath: 'C:/work/opnd/backend-api', defaultRemote: 'origin', defaultBranch: 'develop', forgeKind: 'gitea' as const, forgeOwner: 'opnd', forgeRepo: 'backend-api', lastFetchedAt: t(-12 * MINUTE), isPinned: false },
  { id: 4, workspaceId: 1, name: 'design-system', localPath: 'C:/work/opnd/design-system', defaultRemote: 'origin', defaultBranch: 'main', forgeKind: 'gitea' as const, forgeOwner: 'opnd', forgeRepo: 'design-system', lastFetchedAt: t(-1 * HOUR), isPinned: false },
  { id: 5, workspaceId: 1, name: 'mobile-app', localPath: 'C:/work/opnd/mobile-app', defaultRemote: 'origin', defaultBranch: 'main', forgeKind: 'gitea' as const, forgeOwner: 'opnd', forgeRepo: 'mobile-app', lastFetchedAt: t(-2 * HOUR), isPinned: false },
  { id: 6, workspaceId: 2, name: 'git-fried', localPath: 'D:/01.Work/08.rf/git-fried', defaultRemote: 'origin', defaultBranch: 'main', forgeKind: 'github' as const, forgeOwner: 'tgkim', forgeRepo: 'git-fried', lastFetchedAt: t(-5 * MINUTE), isPinned: true },
  { id: 7, workspaceId: 2, name: 'dotfiles', localPath: 'D:/personal/dotfiles', defaultRemote: 'origin', defaultBranch: 'main', forgeKind: 'github' as const, forgeOwner: 'tgkim', forgeRepo: 'dotfiles', lastFetchedAt: t(-1 * DAY), isPinned: false },
  { id: 8, workspaceId: 3, name: 'tauri', localPath: 'D:/oss/tauri', defaultRemote: 'origin', defaultBranch: 'dev', forgeKind: 'github' as const, forgeOwner: 'tauri-apps', forgeRepo: 'tauri', lastFetchedAt: t(-3 * HOUR), isPinned: false },
]

const ACTIVE_REPO_ID = 1

// 한글 + 영문 섞인 commit log (실 회사 패턴 기반)
const LOG: Array<{
  sha: string
  parentShas: string[]
  authorName: string
  authorEmail: string
  authorAt: number
  subject: string
  body?: string
  refs?: string[]
}> = [
  { sha: '6ef63e0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e', parentShas: ['59a2f0e7777'], authorName: 'tgkim', authorEmail: 'oharapass@gmail.com', authorAt: t(-15 * MINUTE), subject: 'feat(r2a): plan/22 UI Polish v2 + R-2A CRITICAL 5건', body: 'docs/plan/22 §2 — bulk fetch 결과 절단, 한글 visual width, hunk-stage 진입점, IPC timeout, conflict marker 거부', refs: ['HEAD', 'main', 'origin/main'] },
  { sha: '59a2f0e7777111222333444555666777888999aa', parentShas: ['1acdc4f8888'], authorName: 'tgkim', authorEmail: 'oharapass@gmail.com', authorAt: t(-2 * HOUR), subject: 'feat(c14-3): F1 PR Code Suggestions — plan/14 100%', body: 'docs/plan/14 §7 F1 — ForgeClient::add_review_comment trait + GitHub/Gitea impl', refs: [] },
  { sha: '1acdc4f8888aaa111bbb222ccc333ddd444eee555', parentShas: ['550e50f9999'], authorName: '김태길', authorEmail: 'tgkim@opnd.io', authorAt: t(-5 * HOUR), subject: 'feat(c14-2): Clone with options (E1+E2) + PR Filter syntax (F2)', body: 'sparse-checkout cone + --depth + --shallow-since + --single-branch', refs: [] },
  { sha: '550e50f99990aaa1bbb2ccc3ddd4eee5fff6aaa78', parentShas: ['719c2469999'], authorName: '김태길', authorEmail: 'tgkim@opnd.io', authorAt: t(-1 * DAY), subject: 'feat(c14): Sprint C14-1 — Author filter (G2) + Edit stash msg (D2) + Tag panel (G1)', refs: [] },
  { sha: '719c2469999aaa1bbb2ccc3ddd4eee5fff6aaa789', parentShas: ['8a4b3c2dddd'], authorName: '김태길', authorEmail: 'tgkim@opnd.io', authorAt: t(-1 * DAY - 3 * HOUR), subject: 'feat(repo-config): Sprint B14-3 — Repository-Specific Preferences', body: 'docs/plan/14 §3 B1~B4 + A3 + A4', refs: [] },
  { sha: '8a4b3c2ddddeee1fff2aaa3bbb4ccc5ddd6eee78', parentShas: ['9c5d4e3eeee'], authorName: '이영희', authorEmail: 'yhlee@opnd.io', authorAt: t(-2 * DAY), subject: 'fix(launchpad): bot PR 필터에서 dependabot/renovate 분리', refs: [] },
  { sha: '9c5d4e3eeeefff1aaa2bbb3ccc4ddd5eee6fff789', parentShas: ['ad6e5f4ffff'], authorName: '이영희', authorEmail: 'yhlee@opnd.io', authorAt: t(-2 * DAY - 5 * HOUR), subject: 'refactor(StatusPanel): hunk-stage 진입점 visible (✂ hunk 텍스트)', body: 'plan/22 sprint 22-1 C3 해결 — 신규 사용자 발견성', refs: [] },
  { sha: 'ad6e5f4ffff111aaa2bbb3ccc4ddd5eee6fff7890', parentShas: ['bd7f6a5aaaa'], authorName: '박철수', authorEmail: 'pcs@opnd.io', authorAt: t(-3 * DAY), subject: 'docs(plan/22): UI Polish v2 — 우클릭 ContextMenu 17 위치 catalog', refs: [] },
  { sha: 'bd7f6a5aaaaaaa1bbb2ccc3ddd4eee5fff6aaa789', parentShas: ['ce8a7b6bbbb', 'df9b8c7cccc'], authorName: 'tgkim', authorEmail: 'oharapass@gmail.com', authorAt: t(-3 * DAY - 4 * HOUR), subject: "Merge pull request #42 from feature/bulk-fetch", body: '회사 50+ 레포 동시 fetch 결과 모달', refs: [] },
  { sha: 'ce8a7b6bbbbbbb1ccc2ddd3eee4fff5aaa6bbb789', parentShas: ['df9b8c7cccc'], authorName: '박철수', authorEmail: 'pcs@opnd.io', authorAt: t(-4 * DAY), subject: 'feat(bulk-fetch): 결과 모달 + 실패 N개 badge', refs: [] },
  { sha: 'df9b8c7ccccccc1ddd2eee3fff4aaa5bbb6ccc789', parentShas: ['ea0c9d8dddd'], authorName: '박철수', authorEmail: 'pcs@opnd.io', authorAt: t(-4 * DAY - 6 * HOUR), subject: 'chore(deps): bun 1.1.45 → 1.2.0 업그레이드', refs: [] },
  { sha: 'ea0c9d8ddddddd1eee2fff3aaa4bbb5ccc6ddd789', parentShas: ['fb1d0e9eeee'], authorName: 'tgkim', authorEmail: 'oharapass@gmail.com', authorAt: t(-5 * DAY), subject: 'feat(commit-msg): 한글 visual width 환산 (CJK=2 cell, 36자=72)', body: 'plan/22 C2 — 한글로만 작성 시 100자+ 까지 통과되던 문제', refs: [] },
  { sha: 'fb1d0e9eeeeefff1aaa2bbb3ccc4ddd5eee6fff789', parentShas: ['ac2e1f0ffff'], authorName: '이영희', authorEmail: 'yhlee@opnd.io', authorAt: t(-6 * DAY), subject: 'fix(ipc): timeout wrapper 30s/5min 자동 적용', refs: [] },
  { sha: 'ac2e1f0ffffaaa1bbb2ccc3ddd4eee5fff6aaa789', parentShas: ['bd3f201aaaa'], authorName: '김태길', authorEmail: 'tgkim@opnd.io', authorAt: t(-7 * DAY), subject: 'feat(ai): Claude/Codex CLI 위임 + ai_explain_commit', refs: [] },
  { sha: 'bd3f201aaaa111ccc2ddd3eee4fff5aaa6bbb789c', parentShas: ['ce4031bbbb'], authorName: '김태길', authorEmail: 'tgkim@opnd.io', authorAt: t(-7 * DAY - 5 * HOUR), subject: 'docs: README 한글 안전 / Gitea 1급 / Tauri-light 정체성 정리', refs: ['v0.2.5'] },
  { sha: 'ce4031bbbb111ddd2eee3fff4aaa5bbb6ccc789de', parentShas: ['df5142cccc'], authorName: '박철수', authorEmail: 'pcs@opnd.io', authorAt: t(-9 * DAY), subject: 'perf(graph): 1k commit 렌더 220ms → 95ms (lane 병합)', refs: [] },
  { sha: 'df5142cccc111eee2fff3aaa4bbb5ccc6ddd789ef', parentShas: ['ea6253dddd'], authorName: '박철수', authorEmail: 'pcs@opnd.io', authorAt: t(-10 * DAY), subject: 'fix(forge): Gitea 401 시 useToast 에 재인증 CTA', refs: [] },
  { sha: 'ea6253dddd111fff2aaa3bbb4ccc5ddd6eee789f0', parentShas: ['fb7364eeee'], authorName: '이영희', authorEmail: 'yhlee@opnd.io', authorAt: t(-12 * DAY), subject: 'feat(stash): edit message + 단일 파일 apply', refs: [] },
  { sha: 'fb7364eeee111aaa2bbb3ccc4ddd5eee6fff7890ab', parentShas: ['ac8475ffff'], authorName: 'tgkim', authorEmail: 'oharapass@gmail.com', authorAt: t(-15 * DAY), subject: 'feat: TipTap 기반 PR description rich editor', refs: [] },
  { sha: 'ac8475ffff111bbb2ccc3ddd4eee5fff6aaa7890bc', parentShas: ['bd9586aaaa'], authorName: 'tgkim', authorEmail: 'oharapass@gmail.com', authorAt: t(-21 * DAY), subject: 'chore(release): v0.2.0', refs: ['v0.2.0'] },
]

const COMMIT_SUMMARIES = LOG.map((c) => ({
  sha: c.sha,
  shortSha: c.sha.slice(0, 7),
  parentShas: c.parentShas,
  authorName: c.authorName,
  authorEmail: c.authorEmail,
  authorAt: c.authorAt,
  committerAt: c.authorAt,
  subject: c.subject,
  body: c.body ?? '',
  signed: false,
  refs: c.refs ?? [],
}))

const STATUS = {
  branch: 'feature/plan-23-design-system',
  upstream: 'origin/feature/plan-23-design-system',
  ahead: 3,
  behind: 1,
  staged: [
    { path: 'docs/plan/23-design-system-extraction.md', oldPath: null, status: 'added' as const },
    { path: 'docs/design-context/00-product-brief.md', oldPath: null, status: 'added' as const },
    { path: 'docs/design-context/01-design-tokens.md', oldPath: null, status: 'added' as const },
  ],
  unstaged: [
    { path: 'apps/desktop/src/api/invokeWithTimeout.ts', oldPath: null, status: 'modified' as const },
    { path: 'apps/desktop/src/components/CommitMessageInput.vue', oldPath: null, status: 'modified' as const },
    { path: 'CHANGELOG.md', oldPath: null, status: 'modified' as const },
    { path: 'apps/desktop/src/composables/useToast.ts', oldPath: null, status: 'modified' as const },
    { path: 'apps/desktop/src/i18n/한글-안전-처리.ts', oldPath: null, status: 'modified' as const },
  ],
  untracked: [
    'apps/desktop/src/api/devMock.ts',
    'scripts/capture-screens.ts',
    'docs/design-context/screenshots/',
  ],
  conflicted: ['apps/desktop/src/components/StatusPanel.vue'],
  isClean: false,
}

const BRANCHES = [
  { name: 'main', kind: 'local' as const, isHead: false, upstream: 'origin/main', lastCommitSha: '6ef63e0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e', lastCommitSubject: 'feat(r2a): plan/22 UI Polish v2 + R-2A CRITICAL 5건', ahead: 0, behind: 0 },
  { name: 'feature/plan-23-design-system', kind: 'local' as const, isHead: true, upstream: 'origin/feature/plan-23-design-system', lastCommitSha: '6ef63e0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e', lastCommitSubject: 'feat(r2a): plan/22 UI Polish v2 + R-2A CRITICAL 5건', ahead: 3, behind: 1 },
  { name: 'feature/한글-encoding-audit', kind: 'local' as const, isHead: false, upstream: null, lastCommitSha: 'ea0c9d8d', lastCommitSubject: 'feat(commit-msg): 한글 visual width 환산', ahead: 5, behind: 12 },
  { name: 'fix/bulk-fetch-failure-modal', kind: 'local' as const, isHead: false, upstream: 'origin/fix/bulk-fetch-failure-modal', lastCommitSha: 'ce8a7b6b', lastCommitSubject: 'feat(bulk-fetch): 결과 모달 + 실패 N개 badge', ahead: 0, behind: 0 },
  { name: 'develop', kind: 'local' as const, isHead: false, upstream: 'origin/develop', lastCommitSha: 'fb7364ee', lastCommitSubject: 'feat: TipTap 기반 PR description rich editor', ahead: 0, behind: 8 },
  { name: 'origin/main', kind: 'remote' as const, isHead: false, upstream: null, lastCommitSha: '6ef63e0a', lastCommitSubject: 'feat(r2a): plan/22 UI Polish v2', ahead: 0, behind: 0 },
  { name: 'origin/develop', kind: 'remote' as const, isHead: false, upstream: null, lastCommitSha: 'fb7364ee', lastCommitSubject: 'feat: TipTap 기반 PR description', ahead: 0, behind: 0 },
  { name: 'origin/feature/plan-23-design-system', kind: 'remote' as const, isHead: false, upstream: null, lastCommitSha: 'aabbccdd', lastCommitSubject: 'wip: design tokens fixture', ahead: 0, behind: 0 },
  { name: 'origin/release/v0.3.0', kind: 'remote' as const, isHead: false, upstream: null, lastCommitSha: 'bd3f201a', lastCommitSubject: 'docs: README 한글 안전', ahead: 0, behind: 0 },
]

const STASHES = [
  { index: 0, sha: 'aaaa1111bbbb2222', message: 'WIP on feature/plan-23: 한글 ellipsis 좌측 잘림 실험', branch: 'feature/plan-23-design-system', createdAt: t(-30 * MINUTE) },
  { index: 1, sha: 'bbbb2222cccc3333', message: 'Tooltip delay 500ms 시도 — 디자이너 review 후 결정', branch: 'feature/plan-23-design-system', createdAt: t(-3 * HOUR) },
  { index: 2, sha: 'cccc3333dddd4444', message: 'BaseModal POC — reka-ui Dialog 래핑', branch: 'main', createdAt: t(-2 * DAY) },
]

const TAGS = [
  { name: 'v0.2.5', commitSha: 'bd3f201aaaa', taggerName: 'tgkim', taggerAt: t(-7 * DAY), subject: 'v0.2.5 — Sprint 22-1 R-2A CRITICAL 5건 + plan/22 backlog', annotated: true },
  { name: 'v0.2.0', commitSha: 'ac8475ffff', taggerName: 'tgkim', taggerAt: t(-21 * DAY), subject: 'v0.2.0 — Forge integration + AI CLI 위임', annotated: true },
  { name: 'v0.1.0', commitSha: '0000000000', taggerName: 'tgkim', taggerAt: t(-90 * DAY), subject: 'v0.1.0 first public release', annotated: true },
  { name: 'release-2026q1', commitSha: 'aaaa00001111', taggerName: null, taggerAt: null, subject: null, annotated: false },
]

const PRS = [
  { forgeKind: 'gitea' as const, owner: 'opnd', repo: 'frontend', number: 142, title: 'feat(r2a): plan/22 UI Polish v2 — CRITICAL 5건 + 한글 width', bodyMd: '## 요약\n- C1 bulk fetch 결과 모달\n- C2 한글 commit subject visual width\n- C3 hunk-stage 진입점 visible\n- C4 IPC timeout wrapper\n- C5 conflict marker 거부 가이드', state: 'open' as const, headBranch: 'feature/plan-22-r2a', baseBranch: 'main', headSha: '6ef63e0a', author: { username: 'tgkim', displayName: '김태길', avatarUrl: null }, createdAt: t(-3 * HOUR), updatedAt: t(-15 * MINUTE), merged: false, mergeable: true, draft: false, labels: [{ name: 'critical', color: 'ef4444' }, { name: 'ui', color: '8b5cf6' }], comments: 4, additions: 387, deletions: 142, htmlUrl: 'https://git.dev.opnd.io/opnd/frontend/pulls/142' },
  { forgeKind: 'gitea' as const, owner: 'opnd', repo: 'frontend', number: 141, title: 'fix(launchpad): bot PR 필터 dependabot/renovate 분리', bodyMd: '...', state: 'open' as const, headBranch: 'fix/launchpad-bot-filter', baseBranch: 'main', headSha: 'aabbccdd', author: { username: 'yhlee', displayName: '이영희', avatarUrl: null }, createdAt: t(-1 * DAY), updatedAt: t(-2 * HOUR), merged: false, mergeable: null, draft: false, labels: [{ name: 'launchpad', color: '3b82f6' }], comments: 2, additions: 67, deletions: 23, htmlUrl: 'https://git.dev.opnd.io/opnd/frontend/pulls/141' },
  { forgeKind: 'gitea' as const, owner: 'opnd', repo: 'frontend-admin', number: 89, title: 'feat: 회사 워크스페이스 색 분리 picker', bodyMd: '...', state: 'open' as const, headBranch: 'feature/workspace-color', baseBranch: 'main', headSha: 'bbccddee', author: { username: 'pcs', displayName: '박철수', avatarUrl: null }, createdAt: t(-2 * DAY), updatedAt: t(-1 * DAY), merged: false, mergeable: true, draft: true, labels: [{ name: 'design', color: '10b981' }], comments: 7, additions: 245, deletions: 89, htmlUrl: 'https://git.dev.opnd.io/opnd/frontend-admin/pulls/89' },
  { forgeKind: 'gitea' as const, owner: 'opnd', repo: 'backend-api', number: 256, title: 'fix: 한글 파일명 인코딩 detection trust UX', bodyMd: '...', state: 'open' as const, headBranch: 'fix/korean-filename-trust', baseBranch: 'develop', headSha: 'ccddeeff', author: { username: 'yhlee', displayName: '이영희', avatarUrl: null }, createdAt: t(-3 * DAY), updatedAt: t(-12 * HOUR), merged: false, mergeable: true, draft: false, labels: [{ name: 'korean-safe', color: 'f59e0b' }], comments: 1, additions: 34, deletions: 12, htmlUrl: 'https://git.dev.opnd.io/opnd/backend-api/pulls/256' },
  { forgeKind: 'github' as const, owner: 'tgkim', repo: 'git-fried', number: 28, title: 'docs(plan/23): Design System Extraction — 6 design-context docs', bodyMd: '...', state: 'open' as const, headBranch: 'feature/plan-23-design-system', baseBranch: 'main', headSha: 'ddeefff0', author: { username: 'tgkim', displayName: 'tgkim', avatarUrl: null }, createdAt: t(-1 * HOUR), updatedAt: t(-15 * MINUTE), merged: false, mergeable: true, draft: false, labels: [{ name: 'docs', color: '6366f1' }, { name: 'design', color: '10b981' }], comments: 0, additions: 1842, deletions: 0, htmlUrl: 'https://github.com/tgkim/git-fried/pulls/28' },
  { forgeKind: 'github' as const, owner: 'tgkim', repo: 'git-fried', number: 26, title: 'chore(deps): bump tauri to 2.1.1', bodyMd: '...', state: 'merged' as const, headBranch: 'dependabot/cargo/tauri-2.1.1', baseBranch: 'main', headSha: 'eef00112', author: { username: 'dependabot[bot]', displayName: 'dependabot', avatarUrl: null }, createdAt: t(-5 * DAY), updatedAt: t(-2 * DAY), merged: true, mergeable: null, draft: false, labels: [{ name: 'dependencies', color: '94a3b8' }], comments: 0, additions: 23, deletions: 23, htmlUrl: 'https://github.com/tgkim/git-fried/pulls/26' },
]

const ISSUES = [
  { forgeKind: 'gitea' as const, owner: 'opnd', repo: 'frontend', number: 312, title: '[bug] 한글 commit message 가 GitKraken merge 후 mangled', bodyMd: '`���` 으로 영구 mangle 됨. force-push 금지로 복구 불가.', state: 'open' as const, author: { username: 'pcs', displayName: '박철수', avatarUrl: null }, labels: [{ name: 'critical', color: 'ef4444' }, { name: 'korean-encoding', color: 'f59e0b' }], createdAt: t(-2 * DAY), updatedAt: t(-3 * HOUR), comments: 5, htmlUrl: 'https://git.dev.opnd.io/opnd/frontend/issues/312' },
  { forgeKind: 'gitea' as const, owner: 'opnd', repo: 'frontend', number: 308, title: 'StatusPanel 에 검색 input 필요 (150+ 파일 시)', bodyMd: 'plan/22 IMPORTANT F-I1', state: 'open' as const, author: { username: 'yhlee', displayName: '이영희', avatarUrl: null }, labels: [{ name: 'enhancement', color: '10b981' }], createdAt: t(-5 * DAY), updatedAt: t(-1 * DAY), comments: 2, htmlUrl: 'https://git.dev.opnd.io/opnd/frontend/issues/308' },
  { forgeKind: 'gitea' as const, owner: 'opnd', repo: 'frontend', number: 295, title: 'Sidebar 50+ 레포 시 virtualization', bodyMd: 'plan/22 POLISH F-P2', state: 'open' as const, author: { username: 'tgkim', displayName: 'tgkim', avatarUrl: null }, labels: [{ name: 'performance', color: '8b5cf6' }], createdAt: t(-9 * DAY), updatedAt: t(-3 * DAY), comments: 1, htmlUrl: 'https://git.dev.opnd.io/opnd/frontend/issues/295' },
]

const RELEASES = [
  { forgeKind: 'github' as const, owner: 'tgkim', repo: 'git-fried', tag: 'v0.2.5', name: 'v0.2.5 — Sprint 22-1 R-2A CRITICAL', bodyMd: '## CRITICAL 5건 해결\n- C1 bulk fetch 결과\n- C2 한글 width\n- C3 hunk-stage\n- C4 IPC timeout\n- C5 conflict guide', draft: false, prerelease: false, createdAt: t(-7 * DAY), htmlUrl: 'https://github.com/tgkim/git-fried/releases/tag/v0.2.5' },
  { forgeKind: 'github' as const, owner: 'tgkim', repo: 'git-fried', tag: 'v0.2.0', name: 'v0.2.0 — Forge + AI CLI', bodyMd: 'Gitea + GitHub PR/Issue/Release 통합 + Claude/Codex CLI 위임', draft: false, prerelease: false, createdAt: t(-21 * DAY), htmlUrl: 'https://github.com/tgkim/git-fried/releases/tag/v0.2.0' },
]

const PROFILES = [
  { id: 1, name: '회사 (opnd)', gitUserName: '김태길', gitUserEmail: 'tgkim@opnd.io', signingKey: 'AABB1122', sshKeyPath: '~/.ssh/id_ed25519_opnd', defaultForgeAccountId: 1, isActive: true },
  { id: 2, name: '개인 (GitHub)', gitUserName: 'tgkim', gitUserEmail: 'oharapass@gmail.com', signingKey: null, sshKeyPath: '~/.ssh/id_ed25519', defaultForgeAccountId: 2, isActive: false },
]

const FORGE_ACCOUNTS = [
  { id: 1, forgeKind: 'gitea', baseUrl: 'https://git.dev.opnd.io', username: 'tgkim', keychainRef: 'forge_gitea|opnd|tgkim' },
  { id: 2, forgeKind: 'github', baseUrl: 'https://api.github.com', username: 'tgkim', keychainRef: 'forge_github|github|tgkim' },
]

const SUBMODULES = [
  { path: 'lib/shared-types', sha: 'aabbcc11', status: 'initialized' as const, flag: ' ' },
  { path: 'lib/design-tokens', sha: 'ddee2233', status: 'initialized' as const, flag: ' ' },
  { path: 'lib/ai-prompts', sha: 'ff445566', status: 'modified' as const, flag: '+' },
  { path: 'lib/internal-sdk', sha: null, status: 'uninitialized' as const, flag: '-' },
  { path: 'lib/protobuf', sha: '99887766', status: 'initialized' as const, flag: ' ' },
  { path: 'tools/scaffolder', sha: 'aabbccdd', status: 'initialized' as const, flag: ' ' },
]

const WORKTREES = [
  { path: 'C:/work/opnd/frontend', branch: 'feature/plan-23-design-system', headSha: '6ef63e0a', isMain: true, isLocked: false, isPrunable: false, sizeBytes: 245_000_000 },
  { path: 'C:/work/opnd/frontend.wt-main', branch: 'main', headSha: '6ef63e0a', isMain: false, isLocked: false, isPrunable: false, sizeBytes: 195_000_000 },
  { path: 'C:/work/opnd/frontend.wt-hotfix', branch: 'hotfix/한글-encoding-cp949', headSha: 'fb7364ee', isMain: false, isLocked: true, isPrunable: false, sizeBytes: 198_000_000 },
  { path: 'C:/work/opnd/frontend.wt-review-89', branch: 'feature/workspace-color', headSha: 'bbccddee', isMain: false, isLocked: false, isPrunable: false, sizeBytes: 203_000_000 },
  { path: 'C:/work/opnd/frontend.wt-old', branch: null, headSha: 'aaaa0000', isMain: false, isLocked: false, isPrunable: true, sizeBytes: 89_000_000 },
]

const REMOTES = [
  { name: 'origin', fetchUrl: 'https://git.dev.opnd.io/opnd/frontend.git', pushUrl: 'https://git.dev.opnd.io/opnd/frontend.git' },
  { name: 'upstream', fetchUrl: 'https://git.dev.opnd.io/template/frontend.git', pushUrl: null },
]

const LFS_STATUS = { installed: true, version: 'git-lfs/3.4.0', trackedPatterns: ['*.psd', '*.zip', 'assets/**/*.png'] }
const LFS_FILES = [
  { path: 'assets/hero/main-banner.png', oid: 'sha256:aabbccdd...', downloaded: true, size: 4_823_117 },
  { path: 'assets/hero/dark-banner.png', oid: 'sha256:eeff0011...', downloaded: true, size: 4_912_834 },
  { path: 'assets/products/01-detail.psd', oid: 'sha256:22334455...', downloaded: false, size: 87_234_001 },
  { path: 'assets/products/02-detail.psd', oid: 'sha256:66778899...', downloaded: false, size: 92_001_344 },
]

const PR_METAS = [
  { id: 1, forgeKind: 'gitea', baseUrl: 'gitea-default', owner: 'opnd', repo: 'frontend', number: 142, pinned: true, snoozedUntil: null, updatedAt: t(-15 * MINUTE) },
  { id: 2, forgeKind: 'github', baseUrl: 'github.com', owner: 'tgkim', repo: 'git-fried', number: 28, pinned: true, snoozedUntil: null, updatedAt: t(-15 * MINUTE) },
  { id: 3, forgeKind: 'gitea', baseUrl: 'gitea-default', owner: 'opnd', repo: 'frontend-admin', number: 89, pinned: false, snoozedUntil: t(2 * DAY), updatedAt: t(-1 * DAY) },
]

const SAVED_VIEWS = [
  { id: 1, viewKind: 'launchpad', name: '내 PR (회사)', filterJson: '{"author":"tgkim","forge":"gitea"}', sortJson: '{"updated":"desc"}', createdAt: t(-7 * DAY), updatedAt: t(-7 * DAY) },
  { id: 2, viewKind: 'launchpad', name: 'Critical 라벨', filterJson: '{"label":"critical"}', sortJson: null, createdAt: t(-3 * DAY), updatedAt: t(-3 * DAY) },
]

const REFLOG = [
  { sha: '6ef63e0a', shortSha: '6ef63e0', refLabel: 'HEAD@{0}', action: 'commit', subject: 'feat(r2a): plan/22 UI Polish v2', at: t(-15 * MINUTE) },
  { sha: '59a2f0e7', shortSha: '59a2f0e', refLabel: 'HEAD@{1}', action: 'commit', subject: 'feat(c14-3): F1 PR Code Suggestions', at: t(-2 * HOUR) },
  { sha: '1acdc4f8', shortSha: '1acdc4f', refLabel: 'HEAD@{2}', action: 'rebase finish', subject: '', at: t(-3 * HOUR) },
  { sha: '550e50f9', shortSha: '550e50f', refLabel: 'HEAD@{3}', action: 'commit', subject: 'feat(c14): G2 + D2 + G1', at: t(-1 * DAY) },
]

const HIDDEN_REFS = [
  { refName: 'feature/old-poc-virtual-branch', refKind: 'branch' as const, hiddenAt: t(-30 * DAY) },
  { refName: 'origin/dependabot/cargo/tauri-1.5.0', refKind: 'remote' as const, hiddenAt: t(-60 * DAY) },
]

const APP_INFO = { version: '0.2.5', gitVersion: '2.45.1.windows.1', platform: 'windows-x86_64' }

const AI_CLIS = [
  { cli: 'claude' as const, installed: true, version: '2.1.120' },
  { cli: 'codex' as const, installed: true, version: '1.0.2' },
]

// 한글 + 영문 hunk 다수 포함된 commit diff 샘플
const SAMPLE_DIFF = `diff --git a/apps/desktop/src/components/CommitMessageInput.vue b/apps/desktop/src/components/CommitMessageInput.vue
index 1234567..abcdefg 100644
--- a/apps/desktop/src/components/CommitMessageInput.vue
+++ b/apps/desktop/src/components/CommitMessageInput.vue
@@ -55,7 +55,17 @@
   const subjectLength = computed(() => formData.value.subject.length)
+  // 한글 visual width 환산 (CJK=2 cell, ASCII=1 cell)
+  // plan/22 sprint 22-1 C2 — 한글 36자 = 영문 72자 amber warning
+  function visualWidth(s: string): number {
+    let w = 0
+    for (const ch of s) {
+      const cp = ch.codePointAt(0) ?? 0
+      // Hangul Syllables / CJK Unified / Hiragana / Katakana / Emoji
+      w += (cp >= 0xAC00 && cp <= 0xD7A3) || (cp >= 0x4E00 && cp <= 0x9FFF) ? 2 : 1
+    }
+    return w
+  }
   const subjectVisualWidth = computed(() => visualWidth(formData.value.subject))
@@ -120,8 +130,12 @@
-  <span :class="[subjectLength > 50 ? 'text-amber-500' : 'text-muted-foreground']">
-    {{ subjectLength }} / 72
+  <span :class="[
+    subjectVisualWidth > 72 ? 'text-destructive' :
+    subjectVisualWidth > 50 ? 'text-amber-500' :
+    'text-muted-foreground'
+  ]">
+    {{ subjectVisualWidth }} cell / 72 (한글=2)
   </span>
`

// ─────────────────────────────────────────────────────────────────────────────
// Dispatcher

type MockHandler = (args?: Record<string, unknown>) => unknown

const HANDLERS: Record<string, MockHandler> = {
  // 워크스페이스 / 레포
  list_workspaces: () => WORKSPACES,
  list_repos: (args) => {
    const wsId = args?.workspaceId as number | null | undefined
    if (wsId == null) return REPOS
    return REPOS.filter((r) => r.workspaceId === wsId)
  },

  // Profiles / Forge
  list_profiles: () => PROFILES,
  forge_list_accounts: () => FORGE_ACCOUNTS,

  // Status / Branches / Log
  get_status: () => STATUS,
  list_branches: () => BRANCHES,
  get_log: () => COMMIT_SUMMARIES,
  get_graph: () => ({
    rows: COMMIT_SUMMARIES.map((c, i) => ({
      commit: c,
      lane: i === 8 ? 1 : 0,
      parentLanes: [0],
      crossingLanes: [],
      isMerge: c.parentShas.length > 1,
    })),
    maxLane: 1,
  }),
  last_commit_message: () => COMMIT_SUMMARIES[0]?.subject ?? '',

  // Sprint c25-1.5 — Undo last action mock.
  undo_last_action: () => ({
    action: 'commit',
    message: COMMIT_SUMMARIES[0]?.subject ?? '',
    executed: true,
    rejectionReason: null,
    newHeadSha: 'mock-undo-' + Date.now().toString(16).slice(-7),
  }),

  // Diff
  get_diff: () => SAMPLE_DIFF,
  get_commit_diff: () => SAMPLE_DIFF,

  // Stash / Tags
  list_stash: () => STASHES,
  list_tags: () => TAGS,

  // Forge
  list_pull_requests: () => PRS.filter((p) => p.repo === 'frontend' && (p as { state: string }).state === 'open'),
  list_issues: () => ISSUES,
  list_releases: () => RELEASES,

  // Submodule / Worktree / Remote / LFS
  list_submodules: () => SUBMODULES,
  list_worktrees: () => WORKTREES,
  list_remotes: () => REMOTES,
  lfs_status: () => LFS_STATUS,
  lfs_list_files: () => LFS_FILES,
  lfs_push_size: () => ({ commitCount: 3, fileCount: 12, totalBytes: 24_536_788, note: null }),

  // Launchpad
  launchpad_list_active: () => PR_METAS,
  launchpad_list_views: () => SAVED_VIEWS,
  launchpad_list_for_repo: () => PR_METAS.filter((m) => m.repo === 'frontend'),

  // Bulk
  bulk_fetch: () =>
    REPOS.map((r) => ({
      repoId: r.id,
      repoName: r.name,
      success: r.id !== 5,
      data: r.id !== 5 ? { success: true, stdout: '', stderr: '', exitCode: 0 } : null,
      error: r.id === 5 ? 'remote: Permission denied — token expired' : null,
    })),
  bulk_status: () =>
    REPOS.map((r) => ({
      repoId: r.id,
      repoName: r.name,
      success: true,
      data: { ...STATUS, branch: r.defaultBranch, ahead: r.id === ACTIVE_REPO_ID ? 3 : 0, behind: r.id === ACTIVE_REPO_ID ? 1 : 0 },
      error: null,
    })),
  bulk_list_prs: () =>
    REPOS.map((r) => ({
      repoId: r.id,
      repoName: r.name,
      success: true,
      data: PRS.filter((p) => p.repo === r.name && p.state === 'open'),
      error: null,
    })),

  // Reflog / Hidden / Bisect / Rebase
  list_reflog: () => REFLOG,
  list_hidden_refs: () => HIDDEN_REFS,
  bisect_status: () => ({ inProgress: false, currentSha: null, good: [], bad: [], lastOutput: '' }),
  rebase_status: () => ({ inProgress: false, currentStep: null, totalSteps: null, stoppedAt: null, conflict: false, headName: null }),

  // Repo alias / Conflict prediction
  list_all_repo_aliases: () => [],
  resolve_repo_alias: () => null,
  predict_target_conflict: () => ({ ok: true, target: 'origin/main', conflictFiles: [], note: null }),

  // App / AI
  get_app_info: () => APP_INFO,
  ai_detect_clis: () => AI_CLIS,

  // Repo config
  read_repo_config: () => ({
    hooksPath: '.husky',
    commitEncoding: 'utf-8',
    logOutputEncoding: 'utf-8',
    gitflowBranchMaster: 'main',
    gitflowBranchDevelop: 'develop',
    gitflowPrefixFeature: 'feature/',
    gitflowPrefixRelease: 'release/',
    gitflowPrefixHotfix: 'hotfix/',
    commitGpgsign: 'false',
    userSigningkey: null,
    gpgFormat: 'openpgp',
    userName: '김태길',
    userEmail: 'tgkim@opnd.io',
  }),

  // GitKraken importer
  import_gitkraken_detect: () => null,
}

// 응답 없는 command 들 (mutation, void) — 빈 응답으로 무시
const VOID_PREFIXES = [
  'create_', 'update_', 'delete_', 'set_', 'unset_', 'add_', 'remove_', 'rename_',
  'stage_', 'unstage_', 'discard_', 'apply_', 'commit', 'fetch_', 'pull', 'push',
  'init_', 'sync_', 'switch_', 'reset', 'revert', 'merge_', 'rebase_', 'cherry_',
  'hide_', 'unhide_', 'launchpad_set', 'launchpad_save', 'launchpad_delete', 'launchpad_cleanup',
  'forge_save_token', 'forge_delete_account', 'open_in_explorer', 'pty_', 'lfs_',
  'maintenance_', 'lock_', 'unlock_', 'prune_', 'edit_stash_', 'show_stash',
  'submit_pr_', 'add_pr_', 'add_review_', 'merge_pr', 'close_pr', 'reopen_pr',
  'list_pr_comments', 'get_pull_request', 'create_pull_request',
  'compare_refs', 'get_file_history', 'get_file_blame',
  'read_conflicted', 'write_resolved', 'take_side', 'launch_mergetool',
  'bisect_start', 'bisect_mark', 'bisect_reset',
  'rebase_prepare_todo', 'rebase_run', 'rebase_continue', 'rebase_abort', 'rebase_skip',
  'apply_repo_config', 'clone_repo', 'create_tag', 'delete_tag', 'push_tag', 'delete_remote_tag',
  'forge_whoami', 'activate_profile',
  'import_gitkraken_dry_run', 'import_gitkraken_apply',
  'ai_',
]

function isVoidCommand(cmd: string): boolean {
  return VOID_PREFIXES.some((p) => cmd.startsWith(p) || cmd === p)
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API

export function isMockEnabled(): boolean {
  if (typeof window === 'undefined') return false
  if (!import.meta.env.DEV) return false
  // Tauri 2.x 는 `__TAURI_INTERNALS__` 를 webview 측에 inject 한다.
  return !(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
}

export function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  // 70~150ms 가짜 latency — Vue Query loading state 가 시각적으로 잠깐 보이도록
  const latency = 70 + Math.floor(Math.random() * 80)
  return new Promise<T>((resolve, reject) => {
    setTimeout(() => {
      const handler = HANDLERS[cmd]
      if (handler) {
        try {
          resolve(handler(args) as T)
        } catch (e) {
          reject(e)
        }
        return
      }
      if (isVoidCommand(cmd)) {
        resolve(undefined as T)
        return
      }
      // 알 수 없는 command — 빈 배열 fallback (대부분 list_* 류)
      console.warn(`[devMock] unhandled command: ${cmd}`, args)
      resolve([] as unknown as T)
    }, latency)
  })
}
