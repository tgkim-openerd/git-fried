// c60 Wave B — useStashPopMutation 단위 테스트.
//
// caller decision (guard) 만 검증. mutation.mutate 자체는 vue-query mock.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const mutateMockFns: Array<ReturnType<typeof vi.fn>> = []

vi.mock('@tanstack/vue-query', () => ({
  useMutation: (opts: { mutationFn: unknown; onSuccess?: unknown; onError?: unknown }) => {
    const mutate = vi.fn()
    mutateMockFns.push(mutate)
    return {
      mutate,
      mutationFn: opts.mutationFn,
      isPending: ref(false),
    }
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

vi.mock('@/api/git', () => ({
  popStash: vi.fn(),
  pushStash: vi.fn(),
}))

vi.mock('@/api/errors', () => ({
  describeError: (e: unknown) => String(e),
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
const toastInfo = vi.fn()
const toastWarning = vi.fn()
vi.mock('./useToast', () => ({
  useToast: () => ({
    success: toastSuccess,
    error: toastError,
    info: toastInfo,
    warning: toastWarning,
  }),
}))

vi.mock('./useStatus', () => ({
  useInvalidateRepoQueries: () => vi.fn(),
}))

const confirmMock = vi.fn()
vi.mock('./useConfirm', () => ({
  confirmDialog: (opts: unknown) => confirmMock(opts),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (k: string, p?: Record<string, unknown>) => `${k}:${JSON.stringify(p ?? {})}`,
  }),
}))

import { useStashPopMutation } from './useStashPopMutation'

describe('useStashPopMutation — onStash guards', () => {
  beforeEach(() => {
    mutateMockFns.length = 0
    confirmMock.mockReset()
    toastSuccess.mockClear()
    toastError.mockClear()
    toastInfo.mockClear()
    toastWarning.mockClear()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('repoId null → toast.warning + mutate 미호출', async () => {
    const m = useStashPopMutation({
      repoId: () => null,
      hasChanges: ref(true),
      stashCount: ref(0),
    })
    await m.onStash()
    expect(toastWarning).toHaveBeenCalledOnce()
    // stashMut 은 mutateMockFns[0]
    expect(mutateMockFns[0]).not.toHaveBeenCalled()
  })

  it('hasChanges=false → toast.info + mutate 미호출', async () => {
    const m = useStashPopMutation({
      repoId: () => 1,
      hasChanges: ref(false),
      stashCount: ref(0),
    })
    await m.onStash()
    expect(toastInfo).toHaveBeenCalledOnce()
    expect(mutateMockFns[0]).not.toHaveBeenCalled()
  })

  it('confirm cancel → mutate 미호출', async () => {
    confirmMock.mockResolvedValueOnce(false)
    const m = useStashPopMutation({
      repoId: () => 1,
      hasChanges: ref(true),
      stashCount: ref(0),
    })
    await m.onStash()
    expect(confirmMock).toHaveBeenCalledOnce()
    expect(mutateMockFns[0]).not.toHaveBeenCalled()
  })

  it('confirm OK → stashMut.mutate(repoId) 호출', async () => {
    confirmMock.mockResolvedValueOnce(true)
    const m = useStashPopMutation({
      repoId: () => 42,
      hasChanges: ref(true),
      stashCount: ref(0),
    })
    await m.onStash()
    expect(mutateMockFns[0]).toHaveBeenCalledWith(42)
  })
})

describe('useStashPopMutation — onPop guards', () => {
  beforeEach(() => {
    mutateMockFns.length = 0
    confirmMock.mockReset()
    toastSuccess.mockClear()
    toastError.mockClear()
    toastInfo.mockClear()
    toastWarning.mockClear()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('repoId null → toast.warning + mutate 미호출', async () => {
    const m = useStashPopMutation({
      repoId: () => null,
      hasChanges: ref(false),
      stashCount: ref(3),
    })
    await m.onPop()
    expect(toastWarning).toHaveBeenCalledOnce()
    // popMut 은 mutateMockFns[1]
    expect(mutateMockFns[1]).not.toHaveBeenCalled()
  })

  it('stashCount=0 → toast.info + mutate 미호출', async () => {
    const m = useStashPopMutation({
      repoId: () => 1,
      hasChanges: ref(false),
      stashCount: ref(0),
    })
    await m.onPop()
    expect(toastInfo).toHaveBeenCalledOnce()
    expect(mutateMockFns[1]).not.toHaveBeenCalled()
  })

  it('confirm cancel → mutate 미호출', async () => {
    confirmMock.mockResolvedValueOnce(false)
    const m = useStashPopMutation({
      repoId: () => 1,
      hasChanges: ref(false),
      stashCount: ref(2),
    })
    await m.onPop()
    expect(mutateMockFns[1]).not.toHaveBeenCalled()
  })

  it('confirm OK → popMut.mutate(repoId) 호출', async () => {
    confirmMock.mockResolvedValueOnce(true)
    const m = useStashPopMutation({
      repoId: () => 7,
      hasChanges: ref(false),
      stashCount: ref(2),
    })
    await m.onPop()
    expect(mutateMockFns[1]).toHaveBeenCalledWith(7)
  })

  it('stashCount 인터폴레이션 — confirmDialog message 에 remaining 전달', async () => {
    confirmMock.mockResolvedValueOnce(false)
    const m = useStashPopMutation({
      repoId: () => 1,
      hasChanges: ref(false),
      stashCount: ref(5),
    })
    await m.onPop()
    expect(confirmMock).toHaveBeenCalledOnce()
    // remaining=5 가 t() 호출에 전달됐는지 — 우리 mock 은 JSON 으로 직렬화
    const call = confirmMock.mock.calls[0][0] as { message: string }
    expect(call.message).toContain('5')
  })
})
