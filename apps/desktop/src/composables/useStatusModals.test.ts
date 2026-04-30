// Sprint c31 — useStatusModals 단위 테스트.
import { describe, expect, it } from 'vitest'
import { useStatusModals } from './useStatusModals'

describe('useStatusModals — initial state', () => {
  it('모든 modal 이 닫힌 상태로 시작', () => {
    const m = useStatusModals()
    expect(m.historyOpen.value).toBe(false)
    expect(m.mergeOpen.value).toBe(false)
    expect(m.hunkOpen.value).toBe(false)
  })

  it('path / staged 초기값 null / false', () => {
    const m = useStatusModals()
    expect(m.historyPath.value).toBeNull()
    expect(m.mergePath.value).toBeNull()
    expect(m.hunkPath.value).toBeNull()
    expect(m.hunkStaged.value).toBe(false)
  })
})

describe('useStatusModals — File history', () => {
  it('openHistory(path) 는 path + open=true 동시 설정', () => {
    const m = useStatusModals()
    m.openHistory('src/foo.ts')
    expect(m.historyPath.value).toBe('src/foo.ts')
    expect(m.historyOpen.value).toBe(true)
  })

  it('closeHistory 는 open=false (path 보존)', () => {
    const m = useStatusModals()
    m.openHistory('src/foo.ts')
    m.closeHistory()
    expect(m.historyOpen.value).toBe(false)
    expect(m.historyPath.value).toBe('src/foo.ts') // path 는 보존 — modal 재열기 시 prefill 가능
  })
})

describe('useStatusModals — 3-way merge', () => {
  it('openMerge(path) 는 path + open=true', () => {
    const m = useStatusModals()
    m.openMerge('conflicted.ts')
    expect(m.mergePath.value).toBe('conflicted.ts')
    expect(m.mergeOpen.value).toBe(true)
  })

  it('closeMerge 는 open=false', () => {
    const m = useStatusModals()
    m.openMerge('conflicted.ts')
    m.closeMerge()
    expect(m.mergeOpen.value).toBe(false)
  })
})

describe('useStatusModals — Hunk-level', () => {
  it('openHunk(path, true) staged=true', () => {
    const m = useStatusModals()
    m.openHunk('staged.ts', true)
    expect(m.hunkPath.value).toBe('staged.ts')
    expect(m.hunkStaged.value).toBe(true)
    expect(m.hunkOpen.value).toBe(true)
  })

  it('openHunk(path, false) staged=false', () => {
    const m = useStatusModals()
    m.openHunk('unstaged.ts', false)
    expect(m.hunkStaged.value).toBe(false)
    expect(m.hunkOpen.value).toBe(true)
  })

  it('closeHunk 는 open=false', () => {
    const m = useStatusModals()
    m.openHunk('x.ts', false)
    m.closeHunk()
    expect(m.hunkOpen.value).toBe(false)
  })
})

describe('useStatusModals — 인스턴스 격리', () => {
  it('호출마다 신규 인스턴스 (singleton 아님)', () => {
    const a = useStatusModals()
    const b = useStatusModals()
    a.openHistory('a.ts')
    expect(a.historyOpen.value).toBe(true)
    expect(b.historyOpen.value).toBe(false)
  })
})
