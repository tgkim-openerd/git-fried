// Sprint c30 / HIGH 2 — Launchpad 검색쿼리 파서 + 필터 매처.
//
// 배경:
//   pages/launchpad.vue 700 LOC 의 검색 syntax 로직 (parseQuery / matchesQuery /
//   FILTER_HELPERS / appendFilter) 을 추출. 회사 50+ 레포 PR 통합 보드의
//   author/state/repo/is:* 토큰 기반 필터링.
//
// 검색 syntax (`docs/plan/14 §7 F2`):
//   author:<sub>   — pr.author.username substring
//   state:<v>      — open|closed|merged|draft 정확
//   repo:<sub>     — repoName substring
//   is:pinned      — meta.isPinned
//   is:snoozed     — meta.snoozeRemaining != null
//   is:bot         — isBot()
//   그 외 token    — pr.title substring (case-insensitive)
//   여러 token = AND.

import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { PrState, PullRequest } from '@/api/git'

export interface ParsedQuery {
  author: string[]
  state: string[]
  repo: string[]
  is: string[]
  free: string[]
}

export interface FilterRow {
  repoName: string
  pr: PullRequest
}

export interface FilterContext {
  /** pr 가 pin 되어있는지. */
  isPinned: (pr: PullRequest) => boolean
  /** snooze 남은 초. null = snooze 없음. */
  snoozeRemaining: (pr: PullRequest) => number | null
  /** bot 작성 여부. */
  isBot: (pr: PullRequest) => boolean
}

export interface FilterHelper {
  label: string
  insert: string
}

/**
 * 사용자 입력 search input 끝에 append 할 토큰 목록.
 * 변경하지 마세요 — UI 보존.
 */
export const LAUNCHPAD_FILTER_HELPERS: ReadonlyArray<FilterHelper> = Object.freeze([
  { label: '+author:', insert: 'author:' },
  { label: '+state:open', insert: 'state:open' },
  { label: '+repo:', insert: 'repo:' },
  { label: '+is:pinned', insert: 'is:pinned' },
  { label: '+is:snoozed', insert: 'is:snoozed' },
  { label: '+is:bot', insert: 'is:bot' },
])

const KNOWN_KEYS = ['author', 'state', 'repo', 'is'] as const
type KnownKey = (typeof KNOWN_KEYS)[number]
const KNOWN_KEY_RE = /^(author|state|repo|is):(.+)$/i

/**
 * 검색쿼리 문자열 → ParsedQuery.
 * 알 수 없는 키는 free text 로 간주 (예: `foo:bar` → free=['foo:bar']).
 */
export function parseQuery(q: string): ParsedQuery {
  const out: ParsedQuery = { author: [], state: [], repo: [], is: [], free: [] }
  if (!q) return out
  const tokens = q.split(/\s+/).filter((t) => t.length > 0)
  for (const t of tokens) {
    const m = KNOWN_KEY_RE.exec(t)
    if (m) {
      const key = m[1].toLowerCase() as KnownKey
      const val = m[2].toLowerCase()
      out[key].push(val)
    } else {
      out.free.push(t.toLowerCase())
    }
  }
  return out
}

/**
 * row 가 ParsedQuery 의 모든 조건을 만족하는지.
 * AND 매칭 (모든 절 통과해야 true).
 */
export function matchesQuery(row: FilterRow, q: ParsedQuery, ctx: FilterContext): boolean {
  if (q.author.length > 0) {
    const u = row.pr.author.username.toLowerCase()
    if (!q.author.some((a) => u.includes(a))) return false
  }
  if (q.state.length > 0 && !q.state.includes(row.pr.state)) {
    return false
  }
  if (q.repo.length > 0) {
    const r = row.repoName.toLowerCase()
    if (!q.repo.some((s) => r.includes(s))) return false
  }
  for (const tag of q.is) {
    if (tag === 'pinned' && !ctx.isPinned(row.pr)) return false
    if (tag === 'snoozed' && ctx.snoozeRemaining(row.pr) == null) return false
    if (tag === 'bot' && !ctx.isBot(row.pr)) return false
  }
  if (q.free.length > 0) {
    const t = row.pr.title.toLowerCase()
    for (const f of q.free) {
      if (!t.includes(f)) return false
    }
  }
  return true
}

/**
 * Launchpad 페이지가 사용하는 reactive wrapper.
 *
 * 사용:
 *   const { searchQuery, parsedQuery, matches, appendFilter } =
 *     useLaunchpadFilter(() => ({ isPinned, snoozeRemaining, isBot }))
 *
 * `matches(row)` 를 list.filter() 에 직접 전달.
 */
export function useLaunchpadFilter(getCtx: () => FilterContext): {
  searchQuery: Ref<string>
  parsedQuery: ComputedRef<ParsedQuery>
  matches: (row: FilterRow) => boolean
  appendFilter: (token: string) => void
  helpers: typeof LAUNCHPAD_FILTER_HELPERS
} {
  const searchQuery = ref<string>('')
  const parsedQuery = computed<ParsedQuery>(() => parseQuery(searchQuery.value))

  function matches(row: FilterRow): boolean {
    return matchesQuery(row, parsedQuery.value, getCtx())
  }

  function appendFilter(token: string): void {
    const cur = searchQuery.value.trimEnd()
    searchQuery.value = cur ? `${cur} ${token}` : token
  }

  return { searchQuery, parsedQuery, matches, appendFilter, helpers: LAUNCHPAD_FILTER_HELPERS }
}

/** 외부 사용 편의를 위한 PrState 재export. */
export type { PrState, PullRequest }
