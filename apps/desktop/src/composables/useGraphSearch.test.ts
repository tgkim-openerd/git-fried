// Sprint c31 — useGraphSearch 단위 테스트.
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { GraphRow } from '@/api/git'
import { useGraphSearch } from './useGraphSearch'

function row(subject: string, author = 'Alice', sha = 'abc1234567', refs: string[] = []): GraphRow {
  return {
    commit: {
      sha,
      shortSha: sha.slice(0, 7),
      parentShas: [],
      authorName: author,
      authorEmail: '',
      authorAt: 0,
      committerAt: 0,
      subject,
      body: '',
      signed: false,
      refs,
    },
    lane: 0,
    parentLanes: [],
    crossingLanes: [],
    isMerge: false,
  }
}

describe('useGraphSearch — initial state', () => {
  it('초기 state — open=false / query="" / matchCount=0', () => {
    const rows = ref<GraphRow[]>([row('feat: a'), row('fix: b')])
    const s = useGraphSearch(rows)
    expect(s.searchOpen.value).toBe(false)
    expect(s.searchQuery.value).toBe('')
    expect(s.matchCount.value).toBe(0)
  })
})

describe('useGraphSearch — isMatch', () => {
  it('빈 query 는 true (모든 row 통과)', () => {
    const rows = ref<GraphRow[]>([])
    const s = useGraphSearch(rows)
    expect(s.isMatch(row('any'), '')).toBe(true)
  })

  it('subject 부분일치 (case-insensitive)', () => {
    const rows = ref<GraphRow[]>([])
    const s = useGraphSearch(rows)
    expect(s.isMatch(row('Feat: Add Feature'), 'feat')).toBe(true)
    expect(s.isMatch(row('Feat: Add Feature'), 'FEATURE')).toBe(true)
    expect(s.isMatch(row('Fix: Bug'), 'feat')).toBe(false)
  })

  it('authorName 부분일치', () => {
    const rows = ref<GraphRow[]>([])
    const s = useGraphSearch(rows)
    expect(s.isMatch(row('x', 'tgkim'), 'gkim')).toBe(true)
    expect(s.isMatch(row('x', 'Bob'), 'tgkim')).toBe(false)
  })

  it('sha prefix 매치 (부분일치 X — startsWith)', () => {
    const rows = ref<GraphRow[]>([])
    const s = useGraphSearch(rows)
    expect(s.isMatch(row('x', 'a', 'abc1234567'), 'abc')).toBe(true)
    expect(s.isMatch(row('x', 'a', 'abc1234567'), '1234')).toBe(false)
  })

  it('refs 부분일치', () => {
    const rows = ref<GraphRow[]>([])
    const s = useGraphSearch(rows)
    expect(s.isMatch(row('x', 'a', 'abc', ['main', 'origin/main']), 'main')).toBe(true)
    expect(s.isMatch(row('x', 'a', 'abc', ['feature/foo']), 'foo')).toBe(true)
    expect(s.isMatch(row('x', 'a', 'abc', []), 'main')).toBe(false)
  })
})

describe('useGraphSearch — matchCount', () => {
  it('query 가 있을 때 매치된 row 수', () => {
    const rows = ref<GraphRow[]>([row('feat: a'), row('feat: b'), row('fix: c')])
    const s = useGraphSearch(rows)
    s.searchQuery.value = 'feat'
    expect(s.matchCount.value).toBe(2)
    s.searchQuery.value = 'fix'
    expect(s.matchCount.value).toBe(1)
    s.searchQuery.value = 'nope'
    expect(s.matchCount.value).toBe(0)
  })

  it('빈 query 면 0 반환 (display 용 — UI 가 "matched 0" 안 보이게)', () => {
    const rows = ref<GraphRow[]>([row('feat')])
    const s = useGraphSearch(rows)
    expect(s.matchCount.value).toBe(0)
  })
})

describe('useGraphSearch — open / close', () => {
  it('openSearch 는 open=true', () => {
    const rows = ref<GraphRow[]>([])
    const s = useGraphSearch(rows)
    s.openSearch()
    expect(s.searchOpen.value).toBe(true)
  })

  it('closeSearch 는 open=false + query 클리어 + onClose callback 호출', () => {
    const rows = ref<GraphRow[]>([])
    const onClose = vi.fn()
    const s = useGraphSearch(rows, { onClose })
    s.openSearch()
    s.searchQuery.value = 'feat'
    s.closeSearch()
    expect(s.searchOpen.value).toBe(false)
    expect(s.searchQuery.value).toBe('')
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('useGraphSearch — onKeydown', () => {
  function key(k: string, mods: { meta?: boolean; ctrl?: boolean } = {}): KeyboardEvent {
    const e = new KeyboardEvent('keydown', {
      key: k,
      metaKey: mods.meta ?? false,
      ctrlKey: mods.ctrl ?? false,
    })
    return e
  }

  it('⌘F 토글 (open ↔ close)', () => {
    const rows = ref<GraphRow[]>([])
    const s = useGraphSearch(rows)
    s.onKeydown(key('f', { meta: true }))
    expect(s.searchOpen.value).toBe(true)
    s.onKeydown(key('f', { meta: true }))
    expect(s.searchOpen.value).toBe(false)
  })

  it('Ctrl+F 도 동일 토글 (Windows)', () => {
    const rows = ref<GraphRow[]>([])
    const s = useGraphSearch(rows)
    s.onKeydown(key('f', { ctrl: true }))
    expect(s.searchOpen.value).toBe(true)
  })

  it('Esc 는 open 일 때만 close', () => {
    const rows = ref<GraphRow[]>([])
    const s = useGraphSearch(rows)
    s.onKeydown(key('Escape'))
    expect(s.searchOpen.value).toBe(false) // 무시 (이미 close)
    s.openSearch()
    s.onKeydown(key('Escape'))
    expect(s.searchOpen.value).toBe(false)
  })

  it('일반 키는 무시 (open 상태 변경 없음)', () => {
    const rows = ref<GraphRow[]>([])
    const s = useGraphSearch(rows)
    s.onKeydown(key('a'))
    expect(s.searchOpen.value).toBe(false)
    s.openSearch()
    s.onKeydown(key('b'))
    expect(s.searchOpen.value).toBe(true)
  })
})
