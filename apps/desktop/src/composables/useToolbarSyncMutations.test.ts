// c61 Wave B — useToolbarSyncMutations 단위 테스트.
//
// fetchMut/pullMut/pushMut 의 onSuccess 분기 (success vs exit_code != 0) +
// pushMut.mutationFn 의 setUpstream 자동 결정 검증.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mutateMockFns: Array<ReturnType<typeof vi.fn>> = []
const mutationFns: Array<(...args: unknown[]) => unknown> = []
const onSuccessFns: Array<(...args: unknown[]) => void | Promise<void>> = []

vi.mock('@tanstack/vue-query', () => ({
  useMutation: (opts: {
    mutationFn: (...args: unknown[]) => unknown
    onSuccess?: (...args: unknown[]) => void | Promise<void>
  }) => {
    const mutate = vi.fn()
    mutateMockFns.push(mutate)
    mutationFns.push(opts.mutationFn)
    if (opts.onSuccess) onSuccessFns.push(opts.onSuccess)
    return { mutate, mutationFn: opts.mutationFn, isPending: { value: false } }
  },
}))

const fetchAllMock = vi.fn()
const pullMock = vi.fn()
const pushMock = vi.fn()
const updateSubmodulesMock = vi.fn()
vi.mock('@/api/git', () => ({
  fetchAll: (...a: unknown[]) => fetchAllMock(...a),
  pull: (...a: unknown[]) => pullMock(...a),
  push: (...a: unknown[]) => pushMock(...a),
  updateSubmodules: (...a: unknown[]) => updateSubmodulesMock(...a),
}))

vi.mock('@/api/errors', () => ({
  describeError: (e: unknown) => String(e),
  humanizeGitError: (s: string) => s,
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('./useToast', () => ({
  useToast: () => ({ success: toastSuccess, error: toastError, info: vi.fn(), warning: vi.fn() }),
}))

vi.mock('./useStatus', () => ({
  useInvalidateRepoQueries: () => vi.fn(),
}))

const generalRef = { value: { autoUpdateSubmodules: false } }
vi.mock('./useUserSettings', () => ({
  useGeneralSettings: () => generalRef,
}))

vi.mock('./usePullStrategy', () => ({
  usePullStrategy: () => ({
    pullStrategy: { value: 'rebase' },
    setPullStrategy: vi.fn(),
    pullStrategyLabel: { value: 'rebase' },
  }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (k: string, p?: Record<string, unknown>) => `${k}:${JSON.stringify(p ?? {})}`,
  }),
}))

import { useToolbarSyncMutations } from './useToolbarSyncMutations'

// 등록 순서: 0=fetchMut, 1=pullMut, 2=pushMut

describe('useToolbarSyncMutations — fetchMut.onSuccess', () => {
  beforeEach(() => {
    mutateMockFns.length = 0
    mutationFns.length = 0
    onSuccessFns.length = 0
    toastSuccess.mockClear()
    toastError.mockClear()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('성공 (success=true) → toast.success 호출', () => {
    useToolbarSyncMutations({ repoId: () => 1, upstream: () => null })
    onSuccessFns[0]({ success: true, stdout: '', stderr: '', exitCode: 0 })
    expect(toastSuccess).toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })

  it('실패 (success=false) → toast.error + stderr humanize', () => {
    useToolbarSyncMutations({ repoId: () => 1, upstream: () => null })
    onSuccessFns[0]({
      success: false,
      stdout: '',
      stderr: 'fatal: connection refused',
      exitCode: 128,
    })
    expect(toastError).toHaveBeenCalled()
    const call = toastError.mock.calls[0]
    expect(call[0]).toContain('128')
    expect(call[1]).toContain('connection refused')
  })
})

describe('useToolbarSyncMutations — pullMut.mutationFn (strategy 분기)', () => {
  beforeEach(() => {
    mutateMockFns.length = 0
    mutationFns.length = 0
    onSuccessFns.length = 0
    pullMock.mockReset()
  })

  it('strategy=rebase → pull({rebase:true, ffOnly:false, noRebase:false})', () => {
    useToolbarSyncMutations({ repoId: () => 1, upstream: () => 'origin/main' })
    const fn = mutationFns[1] as (a: { id: number; strategy: string }) => unknown
    fn({ id: 1, strategy: 'rebase' })
    expect(pullMock).toHaveBeenCalledWith({
      repoId: 1,
      rebase: true,
      ffOnly: false,
      noRebase: false,
    })
  })

  it('strategy=ff-only → pull({ffOnly:true})', () => {
    useToolbarSyncMutations({ repoId: () => 5, upstream: () => null })
    const fn = mutationFns[1] as (a: { id: number; strategy: string }) => unknown
    fn({ id: 5, strategy: 'ff-only' })
    expect(pullMock).toHaveBeenCalledWith({
      repoId: 5,
      rebase: false,
      ffOnly: true,
      noRebase: false,
    })
  })

  it('strategy=no-rebase → pull({noRebase:true})', () => {
    useToolbarSyncMutations({ repoId: () => 7, upstream: () => null })
    const fn = mutationFns[1] as (a: { id: number; strategy: string }) => unknown
    fn({ id: 7, strategy: 'no-rebase' })
    expect(pullMock).toHaveBeenCalledWith({
      repoId: 7,
      rebase: false,
      ffOnly: false,
      noRebase: true,
    })
  })
})

describe('useToolbarSyncMutations — pullMut.onSuccess (autoUpdateSubmodules)', () => {
  beforeEach(() => {
    mutateMockFns.length = 0
    mutationFns.length = 0
    onSuccessFns.length = 0
    updateSubmodulesMock.mockReset()
    toastSuccess.mockClear()
  })

  it('성공 + autoUpdateSubmodules=false → updateSubmodules 미호출', async () => {
    generalRef.value = { autoUpdateSubmodules: false }
    useToolbarSyncMutations({ repoId: () => 1, upstream: () => null })
    await onSuccessFns[1]({ success: true, stdout: '', stderr: '', exitCode: 0 })
    expect(updateSubmodulesMock).not.toHaveBeenCalled()
  })

  it('성공 + autoUpdateSubmodules=true → updateSubmodules(repoId, false) 호출', async () => {
    generalRef.value = { autoUpdateSubmodules: true }
    updateSubmodulesMock.mockResolvedValueOnce(undefined)
    useToolbarSyncMutations({ repoId: () => 9, upstream: () => null })
    await onSuccessFns[1]({ success: true, stdout: '', stderr: '', exitCode: 0 })
    expect(updateSubmodulesMock).toHaveBeenCalledWith(9, false)
  })
})

describe('useToolbarSyncMutations — pushMut.mutationFn (setUpstream 자동)', () => {
  beforeEach(() => {
    mutateMockFns.length = 0
    mutationFns.length = 0
    onSuccessFns.length = 0
    pushMock.mockReset()
  })

  it('upstream null → setUpstream:true (자동 -u)', () => {
    useToolbarSyncMutations({ repoId: () => 1, upstream: () => null })
    const fn = mutationFns[2] as (id: number) => unknown
    fn(1)
    expect(pushMock).toHaveBeenCalledWith({ repoId: 1, setUpstream: true })
  })

  it('upstream "origin/main" → setUpstream:false', () => {
    useToolbarSyncMutations({ repoId: () => 1, upstream: () => 'origin/main' })
    const fn = mutationFns[2] as (id: number) => unknown
    fn(1)
    expect(pushMock).toHaveBeenCalledWith({ repoId: 1, setUpstream: false })
  })
})
