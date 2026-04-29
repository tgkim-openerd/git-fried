import { describe, expect, it } from 'vitest'
import {
  LAUNCHPAD_FILTER_HELPERS,
  matchesQuery,
  parseQuery,
  useLaunchpadFilter,
  type FilterContext,
  type FilterRow,
} from './useLaunchpadFilter'
import type { PullRequest } from '@/api/git'

function pr(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    number: 1,
    title: 'feat: implement X',
    state: 'open',
    htmlUrl: 'https://example.com/pr/1',
    author: { username: 'alice', displayName: null, avatarUrl: null },
    headRef: 'feat/x',
    baseRef: 'main',
    isDraft: false,
    createdAt: 0,
    updatedAt: 0,
    mergedAt: null,
    closedAt: null,
    ...overrides,
  } as PullRequest
}

const stubCtx: FilterContext = {
  isPinned: () => false,
  snoozeRemaining: () => null,
  isBot: () => false,
}

describe('parseQuery', () => {
  it('빈 문자열 → 모든 배열 empty', () => {
    expect(parseQuery('')).toEqual({ author: [], state: [], repo: [], is: [], free: [] })
  })

  it('author:alice → author 배열', () => {
    const q = parseQuery('author:alice')
    expect(q.author).toEqual(['alice'])
    expect(q.free).toEqual([])
  })

  it('state:open repo:frontend → 두 키 분리', () => {
    const q = parseQuery('state:open repo:frontend')
    expect(q.state).toEqual(['open'])
    expect(q.repo).toEqual(['frontend'])
  })

  it('is:pinned is:bot → is 배열에 누적', () => {
    const q = parseQuery('is:pinned is:bot')
    expect(q.is).toEqual(['pinned', 'bot'])
  })

  it('free token (제목 substring)', () => {
    const q = parseQuery('refactor 한글')
    expect(q.free).toEqual(['refactor', '한글'])
    expect(q.author).toEqual([])
  })

  it('알 수 없는 키 (foo:bar) → free 로 폴백', () => {
    const q = parseQuery('foo:bar baz')
    // 정규식 매칭 실패 → free 로 떨어짐.
    expect(q.free).toEqual(['foo:bar', 'baz'])
  })

  it('값 lowercase 변환', () => {
    const q = parseQuery('author:Alice state:Open')
    expect(q.author).toEqual(['alice'])
    expect(q.state).toEqual(['open'])
  })

  it('복수 토큰 (multiple author)', () => {
    const q = parseQuery('author:alice author:bob')
    expect(q.author).toEqual(['alice', 'bob'])
  })
})

describe('matchesQuery', () => {
  const row: FilterRow = { repoName: 'frontend', pr: pr({ title: 'feat: 추가' }) }

  it('빈 query → 모든 row 통과', () => {
    expect(matchesQuery(row, parseQuery(''), stubCtx)).toBe(true)
  })

  it('author 매칭 (substring)', () => {
    expect(matchesQuery(row, parseQuery('author:ali'), stubCtx)).toBe(true)
    expect(matchesQuery(row, parseQuery('author:bob'), stubCtx)).toBe(false)
  })

  it('state 매칭 (정확)', () => {
    expect(matchesQuery(row, parseQuery('state:open'), stubCtx)).toBe(true)
    expect(matchesQuery(row, parseQuery('state:merged'), stubCtx)).toBe(false)
  })

  it('repo 매칭 (substring + lowercase)', () => {
    expect(
      matchesQuery({ repoName: 'frontend-app', pr: row.pr }, parseQuery('repo:Front'), stubCtx),
    ).toBe(true)
  })

  it('is:pinned — ctx.isPinned 호출', () => {
    const ctx: FilterContext = { ...stubCtx, isPinned: () => true }
    expect(matchesQuery(row, parseQuery('is:pinned'), ctx)).toBe(true)
    expect(matchesQuery(row, parseQuery('is:pinned'), stubCtx)).toBe(false)
  })

  it('is:snoozed — ctx.snoozeRemaining', () => {
    const ctx: FilterContext = { ...stubCtx, snoozeRemaining: () => 60 }
    expect(matchesQuery(row, parseQuery('is:snoozed'), ctx)).toBe(true)
    expect(matchesQuery(row, parseQuery('is:snoozed'), stubCtx)).toBe(false)
  })

  it('is:bot — ctx.isBot', () => {
    const ctx: FilterContext = { ...stubCtx, isBot: () => true }
    expect(matchesQuery(row, parseQuery('is:bot'), ctx)).toBe(true)
  })

  it('free text — 제목 substring', () => {
    expect(matchesQuery(row, parseQuery('추가'), stubCtx)).toBe(true)
    expect(matchesQuery(row, parseQuery('삭제'), stubCtx)).toBe(false)
  })

  it('AND 매칭 — 모든 절 통과', () => {
    const q = parseQuery('author:ali state:open 추가')
    expect(matchesQuery(row, q, stubCtx)).toBe(true)
    const q2 = parseQuery('author:ali state:closed 추가')
    expect(matchesQuery(row, q2, stubCtx)).toBe(false)
  })
})

describe('LAUNCHPAD_FILTER_HELPERS', () => {
  it('6개 헬퍼 정의', () => {
    expect(LAUNCHPAD_FILTER_HELPERS).toHaveLength(6)
    const labels = LAUNCHPAD_FILTER_HELPERS.map((h) => h.label)
    expect(labels).toContain('+author:')
    expect(labels).toContain('+state:open')
    expect(labels).toContain('+is:pinned')
  })

  it('readonly (Object.freeze)', () => {
    expect(Object.isFrozen(LAUNCHPAD_FILTER_HELPERS)).toBe(true)
  })
})

describe('useLaunchpadFilter (composable)', () => {
  it('초기 searchQuery 빈 문자열, 모든 row 매치', () => {
    const f = useLaunchpadFilter(() => stubCtx)
    expect(f.searchQuery.value).toBe('')
    const row: FilterRow = { repoName: 'r', pr: pr() }
    expect(f.matches(row)).toBe(true)
  })

  it('searchQuery 변경 시 parsedQuery / matches 동기 갱신', () => {
    const f = useLaunchpadFilter(() => stubCtx)
    f.searchQuery.value = 'author:alice'
    expect(f.parsedQuery.value.author).toEqual(['alice'])
    expect(f.matches({ repoName: 'r', pr: pr() })).toBe(true)
    expect(
      f.matches({
        repoName: 'r',
        pr: pr({ author: { username: 'bob', displayName: null, avatarUrl: null } }),
      }),
    ).toBe(false)
  })

  it('appendFilter 빈 input 에 추가', () => {
    const f = useLaunchpadFilter(() => stubCtx)
    f.appendFilter('author:alice')
    expect(f.searchQuery.value).toBe('author:alice')
  })

  it('appendFilter 기존 input 끝에 공백 + 토큰', () => {
    const f = useLaunchpadFilter(() => stubCtx)
    f.searchQuery.value = 'state:open'
    f.appendFilter('is:pinned')
    expect(f.searchQuery.value).toBe('state:open is:pinned')
  })

  it('appendFilter 끝 공백 trim 후 추가', () => {
    const f = useLaunchpadFilter(() => stubCtx)
    f.searchQuery.value = 'state:open   '
    f.appendFilter('is:pinned')
    expect(f.searchQuery.value).toBe('state:open is:pinned')
  })

  it('helpers === LAUNCHPAD_FILTER_HELPERS (식별 보존)', () => {
    const f = useLaunchpadFilter(() => stubCtx)
    expect(f.helpers).toBe(LAUNCHPAD_FILTER_HELPERS)
  })
})
