// Sprint c37 — useGraphSelection 단위 테스트.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { GraphRow } from '@/api/git'

// useShortcut mock — 등록된 handler 를 registered map 에 capture.
const registered = new Map<string, () => void>()
vi.mock('@/composables/useShortcuts', () => ({
  useShortcut: (action: string, handler: () => void) => {
    registered.set(action, handler)
  },
}))

// Mock 후 import (호출 시점이 mock 등록 후).
import { useGraphSelection } from './useGraphSelection'

function row(sha: string, subject = 's', author = 'A'): GraphRow {
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
      refs: [],
    },
    lane: 0,
    parentLanes: [],
    crossingLanes: [],
    isMerge: false,
  }
}

beforeEach(() => {
  registered.clear()
})

describe('useGraphSelection — selectRow', () => {
  it('selectRow(null) 은 no-op', () => {
    const onSelect = vi.fn()
    const sel = useGraphSelection({
      rows: ref([]),
      containerRef: ref(null),
      onSelectCommit: onSelect,
    })
    sel.selectRow(null)
    expect(sel.selectedSha.value).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('selectRow(row) → selectedSha 설정 + onSelectCommit 호출', () => {
    const onSelect = vi.fn()
    const sel = useGraphSelection({
      rows: ref([row('abc1234')]),
      containerRef: ref(null),
      onSelectCommit: onSelect,
    })
    sel.selectRow(row('abc1234'))
    expect(sel.selectedSha.value).toBe('abc1234')
    expect(onSelect).toHaveBeenCalledWith('abc1234')
  })
})

describe('useGraphSelection — selectWipRow', () => {
  it('selectWipRow → onSelectWip 호출', () => {
    const onSelect = vi.fn()
    const onWip = vi.fn()
    const sel = useGraphSelection({
      rows: ref([]),
      containerRef: ref(null),
      onSelectCommit: onSelect,
      onSelectWip: onWip,
    })
    sel.selectWipRow()
    expect(onWip).toHaveBeenCalledOnce()
  })

  it('onSelectWip 미제공이면 no-op', () => {
    const sel = useGraphSelection({
      rows: ref([]),
      containerRef: ref(null),
      onSelectCommit: vi.fn(),
    })
    expect(() => sel.selectWipRow()).not.toThrow()
  })
})

describe('useGraphSelection — moveSelection (vim J/K)', () => {
  it('빈 list → no-op', () => {
    const onSelect = vi.fn()
    const sel = useGraphSelection({
      rows: ref([]),
      containerRef: ref(null),
      onSelectCommit: onSelect,
    })
    sel.moveSelection(1)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('선택 없음 + delta=1 → 첫 번째 선택', () => {
    const onSelect = vi.fn()
    const rows = ref([row('a'), row('b'), row('c')])
    const sel = useGraphSelection({
      rows,
      containerRef: ref(null),
      onSelectCommit: onSelect,
    })
    sel.moveSelection(1)
    expect(sel.selectedSha.value).toBe('a')
    expect(onSelect).toHaveBeenCalledWith('a')
  })

  it('선택 없음 + delta=-1 → 마지막 선택', () => {
    const onSelect = vi.fn()
    const rows = ref([row('a'), row('b'), row('c')])
    const sel = useGraphSelection({
      rows,
      containerRef: ref(null),
      onSelectCommit: onSelect,
    })
    sel.moveSelection(-1)
    expect(sel.selectedSha.value).toBe('c')
  })

  it('선택 있음 + delta=1 → 다음 행', () => {
    const onSelect = vi.fn()
    const rows = ref([row('a'), row('b'), row('c')])
    const sel = useGraphSelection({
      rows,
      containerRef: ref(null),
      onSelectCommit: onSelect,
    })
    sel.selectRow(row('a'))
    sel.moveSelection(1)
    expect(sel.selectedSha.value).toBe('b')
  })

  it('마지막 행에서 delta=1 → 그대로 (clamp)', () => {
    const onSelect = vi.fn()
    const rows = ref([row('a'), row('b')])
    const sel = useGraphSelection({
      rows,
      containerRef: ref(null),
      onSelectCommit: onSelect,
    })
    sel.selectRow(row('b'))
    sel.moveSelection(1)
    expect(sel.selectedSha.value).toBe('b')
  })

  it('첫 행에서 delta=-1 → 그대로 (clamp)', () => {
    const onSelect = vi.fn()
    const rows = ref([row('a'), row('b')])
    const sel = useGraphSelection({
      rows,
      containerRef: ref(null),
      onSelectCommit: onSelect,
    })
    sel.selectRow(row('a'))
    sel.moveSelection(-1)
    expect(sel.selectedSha.value).toBe('a')
  })
})

describe('useGraphSelection — useShortcut 등록', () => {
  it('vimDown / vimUp / vimLeft 모두 등록', () => {
    useGraphSelection({
      rows: ref([]),
      containerRef: ref(null),
      onSelectCommit: vi.fn(),
    })
    expect(registered.has('vimDown')).toBe(true)
    expect(registered.has('vimUp')).toBe(true)
    expect(registered.has('vimLeft')).toBe(true)
  })

  it('vimDown handler 가 moveSelection(1) 효과', () => {
    const onSelect = vi.fn()
    const rows = ref([row('a'), row('b')])
    const sel = useGraphSelection({
      rows,
      containerRef: ref(null),
      onSelectCommit: onSelect,
    })
    registered.get('vimDown')!()
    expect(sel.selectedSha.value).toBe('a')
  })

  it('vimLeft handler → selectedSha = null', () => {
    const onSelect = vi.fn()
    const rows = ref([row('a')])
    const sel = useGraphSelection({
      rows,
      containerRef: ref(null),
      onSelectCommit: onSelect,
    })
    sel.selectRow(row('a'))
    expect(sel.selectedSha.value).toBe('a')
    registered.get('vimLeft')!()
    expect(sel.selectedSha.value).toBeNull()
  })
})
