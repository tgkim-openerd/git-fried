// c63-A — useBranchVisibilityActions 단위 테스트.
//
// isHidden / toggleHide / bulkHideKind / unhideAll helper 동작 + refKindOf 분기.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { BranchInfo } from '@/api/git'

const hiddenListRef = ref<Array<{ refName: string }> | undefined>(undefined)
const soloRefValue = ref<string | null>(null)
const hideMut = vi.fn()
const unhideMut = vi.fn()
const bulkHideMut = vi.fn()
const unhideAllMut = vi.fn()
const setSoloMock = vi.fn((name: string | null) => {
  soloRefValue.value = name
})

vi.mock('./useHiddenRefs', () => ({
  useHiddenRefs: () => ({ data: hiddenListRef }),
  useHiddenRefMutations: () => ({
    hide: { mutate: hideMut },
    unhide: { mutate: unhideMut },
    bulkHide: { mutate: bulkHideMut },
    unhideAll: { mutate: unhideAllMut },
  }),
  useSoloRef: () => ({ current: soloRefValue, setSolo: setSoloMock }),
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('./useToast', () => ({
  useToast: () => ({ success: toastSuccess, error: toastError, info: vi.fn(), warning: vi.fn() }),
}))

vi.mock('@/api/errors', () => ({
  describeError: (e: unknown) => String(e),
}))

vi.mock('@/i18n', () => ({
  i18n: { global: { t: (k: string) => k } },
}))

import { useBranchVisibilityActions } from './useBranchVisibilityActions'

function makeBranch(name: string, kind: 'local' | 'remote' = 'local'): BranchInfo {
  return {
    name,
    kind,
    isHead: false,
    ahead: 0,
    behind: 0,
    upstream: null,
    upstreamGone: false,
    lastCommitSubject: null,
    lastCommitSha: null,
  } as unknown as BranchInfo
}

describe('useBranchVisibilityActions — hiddenSet + isHidden', () => {
  beforeEach(() => {
    hiddenListRef.value = undefined
    soloRefValue.value = null
    toastSuccess.mockClear()
    toastError.mockClear()
    hideMut.mockClear()
    unhideMut.mockClear()
    bulkHideMut.mockClear()
    unhideAllMut.mockClear()
    setSoloMock.mockClear()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('hiddenList undefined → hiddenSet 빈 Set + isHidden 모두 false', () => {
    const m = useBranchVisibilityActions(() => 1)
    expect(m.hiddenSet.value.size).toBe(0)
    expect(m.isHidden('main')).toBe(false)
  })

  it('hiddenList 3개 → hiddenSet 에 모두 포함', () => {
    hiddenListRef.value = [
      { refName: 'feat/a' },
      { refName: 'origin/old' },
      { refName: 'archived' },
    ]
    const m = useBranchVisibilityActions(() => 1)
    expect(m.hiddenSet.value.size).toBe(3)
    expect(m.isHidden('feat/a')).toBe(true)
    expect(m.isHidden('main')).toBe(false)
  })
})

describe('useBranchVisibilityActions — toggleHide', () => {
  beforeEach(() => {
    hiddenListRef.value = undefined
    hideMut.mockClear()
    unhideMut.mockClear()
  })

  it('repoId null → no-op (mutate 미호출)', () => {
    const m = useBranchVisibilityActions(() => null)
    m.toggleHide(makeBranch('feat/a'))
    expect(hideMut).not.toHaveBeenCalled()
    expect(unhideMut).not.toHaveBeenCalled()
  })

  it('현재 hidden 아님 + local 브랜치 → hide.mutate({refKind:branch})', () => {
    hiddenListRef.value = []
    const m = useBranchVisibilityActions(() => 1)
    m.toggleHide(makeBranch('feat/a', 'local'))
    expect(hideMut).toHaveBeenCalledWith({ refName: 'feat/a', refKind: 'branch' })
  })

  it('현재 hidden 아님 + remote 브랜치 → hide.mutate({refKind:remote})', () => {
    hiddenListRef.value = []
    const m = useBranchVisibilityActions(() => 1)
    m.toggleHide(makeBranch('origin/main', 'remote'))
    expect(hideMut).toHaveBeenCalledWith({ refName: 'origin/main', refKind: 'remote' })
  })

  it('이미 hidden → unhide.mutate(name)', () => {
    hiddenListRef.value = [{ refName: 'feat/a' }]
    const m = useBranchVisibilityActions(() => 1)
    m.toggleHide(makeBranch('feat/a'))
    expect(unhideMut).toHaveBeenCalledWith('feat/a')
    expect(hideMut).not.toHaveBeenCalled()
  })
})

describe('useBranchVisibilityActions — bulkHideKind', () => {
  beforeEach(() => {
    hiddenListRef.value = []
    bulkHideMut.mockClear()
    toastSuccess.mockClear()
  })

  it('branches undefined → no-op', () => {
    const m = useBranchVisibilityActions(() => 1)
    m.bulkHideKind('branch', undefined)
    expect(bulkHideMut).not.toHaveBeenCalled()
  })

  it('모든 대상이 이미 hidden → bulkHide 미호출 + toast.success "already" 메시지', () => {
    hiddenListRef.value = [{ refName: 'a' }, { refName: 'b' }]
    const m = useBranchVisibilityActions(() => 1)
    m.bulkHideKind('branch', [makeBranch('a'), makeBranch('b')])
    expect(bulkHideMut).not.toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith('branch.toastBulkHideAlready', '')
  })

  it('일부 미hidden → 미hidden 만 bulkHide.mutate', () => {
    hiddenListRef.value = [{ refName: 'a' }]
    const m = useBranchVisibilityActions(() => 1)
    m.bulkHideKind('branch', [makeBranch('a'), makeBranch('b'), makeBranch('c')])
    const call = bulkHideMut.mock.calls[0][0]
    expect(call).toEqual([
      { refName: 'b', refKind: 'branch' },
      { refName: 'c', refKind: 'branch' },
    ])
  })

  it('kind 필터 — remote 만 호출 시 local 브랜치 제외', () => {
    hiddenListRef.value = []
    const m = useBranchVisibilityActions(() => 1)
    m.bulkHideKind('remote', [makeBranch('main', 'local'), makeBranch('origin/main', 'remote')])
    const call = bulkHideMut.mock.calls[0][0]
    expect(call).toEqual([{ refName: 'origin/main', refKind: 'remote' }])
  })
})

describe('useBranchVisibilityActions — toggleSolo + setSolo + unhideAll', () => {
  beforeEach(() => {
    soloRefValue.value = null
    setSoloMock.mockClear()
    unhideAllMut.mockClear()
  })

  it('toggleSolo(branch) → setSolo(branch.name)', () => {
    const m = useBranchVisibilityActions(() => 1)
    m.toggleSolo(makeBranch('feat/x'))
    expect(setSoloMock).toHaveBeenCalledWith('feat/x')
  })

  it('setSolo(null) → soloRef 갱신', () => {
    const m = useBranchVisibilityActions(() => 1)
    m.setSolo(null)
    expect(setSoloMock).toHaveBeenCalledWith(null)
    expect(m.soloRef.value).toBe(null)
  })

  it('unhideAll → repoId null 일 때 no-op', () => {
    const m = useBranchVisibilityActions(() => null)
    m.unhideAll()
    expect(unhideAllMut).not.toHaveBeenCalled()
  })

  it('unhideAll → repoId 보유 시 mutate() 호출', () => {
    const m = useBranchVisibilityActions(() => 1)
    m.unhideAll()
    expect(unhideAllMut).toHaveBeenCalled()
  })
})
