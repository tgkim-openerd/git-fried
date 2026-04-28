import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// useDiffMode 가 module-level state — vi.resetModules + dynamic import 패턴.

async function importFresh() {
  vi.resetModules()
  return await import('./useDiffMode')
}

describe('useDiffMode', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
  })

  it('default mode = "default" (-U3 git 기본)', async () => {
    const { useDiffMode } = await importFresh()
    const { mode, contextLines } = useDiffMode()
    expect(mode.value).toBe('default')
    expect(contextLines.value).toBe(null)
  })

  it('contextLines: compact=0, default=null, context=25, split=null', async () => {
    const { useDiffMode } = await importFresh()
    const { setMode, contextLines } = useDiffMode()
    setMode('compact')
    expect(contextLines.value).toBe(0)
    setMode('context')
    expect(contextLines.value).toBe(25)
    setMode('split')
    expect(contextLines.value).toBe(null)
    setMode('default')
    expect(contextLines.value).toBe(null)
  })

  it('setMode persists to localStorage', async () => {
    const { useDiffMode } = await importFresh()
    const { setMode } = useDiffMode()
    setMode('context')
    await new Promise((r) => setTimeout(r, 0))
    expect(localStorage.getItem('git-fried.diff-mode.v1')).toBe('context')
  })

  it('localStorage stored 우선 적용 (compact)', async () => {
    localStorage.setItem('git-fried.diff-mode.v1', 'compact')
    const { useDiffMode } = await importFresh()
    const { mode, contextLines } = useDiffMode()
    expect(mode.value).toBe('compact')
    expect(contextLines.value).toBe(0)
  })

  it('invalid stored value → default fallback', async () => {
    localStorage.setItem('git-fried.diff-mode.v1', 'banana')
    const { useDiffMode } = await importFresh()
    const { mode } = useDiffMode()
    expect(mode.value).toBe('default')
  })

  it('DIFF_MODE_LABELS 4 모드 모두 한글/영문 라벨', async () => {
    const { DIFF_MODE_LABELS } = await importFresh()
    expect(DIFF_MODE_LABELS.compact).toBe('Hunk')
    expect(DIFF_MODE_LABELS.default).toBe('Inline')
    expect(DIFF_MODE_LABELS.context).toBe('Context')
    expect(DIFF_MODE_LABELS.split).toBe('Split')
  })
})
