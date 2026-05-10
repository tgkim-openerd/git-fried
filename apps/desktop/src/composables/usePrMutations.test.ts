// c60 Wave B — usePrMutations 단위 테스트.
//
// onMerge / onClose confirm guard + suggestion.reset 만 검증.
// (mergeMut / closeMut 자체는 vue-query mock — mutationFn 분기 검증은 c61 에서 추가.)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const mutateMockFns: Array<ReturnType<typeof vi.fn>> = []

vi.mock('@tanstack/vue-query', () => ({
  useMutation: (opts: { mutationFn: unknown; onSuccess?: unknown; onError?: unknown }) => {
    const mutate = vi.fn()
    mutateMockFns.push(mutate)
    return { mutate, mutationFn: opts.mutationFn, isPending: ref(false) }
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

vi.mock('@/api/git', () => ({
  addPrComment: vi.fn(),
  addReviewComment: vi.fn(),
  closePr: vi.fn(),
  mergePr: vi.fn(),
  reopenPr: vi.fn(),
  submitPrReview: vi.fn(),
}))

vi.mock('@/api/errors', () => ({
  describeError: (e: unknown) => String(e),
}))

vi.mock('./useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}))

vi.mock('./useNotification', () => ({
  useNotification: () => ({ notify: vi.fn() }),
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

import { usePrMutations } from './usePrMutations'
import type { MergeMethod, ReviewVerdict } from '@/api/git'

function setup(overrides: Partial<{ repoId: number | null; number: number | null }> = {}) {
  const newComment = ref('')
  const reviewBody = ref('')
  const verdict = ref<ReviewVerdict>('comment')
  const mergeMethod = ref<MergeMethod>('squash')
  const onMergeClose = vi.fn()
  const m = usePrMutations({
    repoId: () => overrides.repoId ?? 1,
    number: () => overrides.number ?? 42,
    newComment,
    reviewBody,
    verdict,
    mergeMethod,
    onMergeClose,
  })
  return { m, onMergeClose }
}

// mutateMockFns 등록 순서 (usePrMutations 코드 기준):
//   0=suggestionMut, 1=addCommentMut, 2=reviewMut, 3=mergeMut, 4=closeMut, 5=reopenMut

describe('usePrMutations — onMerge confirm guard', () => {
  beforeEach(() => {
    mutateMockFns.length = 0
    confirmMock.mockReset()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('confirm cancel → mergeMut.mutate 미호출', async () => {
    confirmMock.mockResolvedValueOnce(false)
    const { m } = setup()
    await m.onMerge()
    expect(confirmMock).toHaveBeenCalledOnce()
    expect(mutateMockFns[3]).not.toHaveBeenCalled()
  })

  it('confirm OK → mergeMut.mutate() 호출', async () => {
    confirmMock.mockResolvedValueOnce(true)
    const { m } = setup()
    await m.onMerge()
    expect(mutateMockFns[3]).toHaveBeenCalled()
  })

  it('confirm message 에 method + number 인터폴레이션', async () => {
    confirmMock.mockResolvedValueOnce(false)
    const { m } = setup({ number: 123 })
    await m.onMerge()
    const call = confirmMock.mock.calls[0][0] as {
      title: string
      message: string
      danger: boolean
    }
    expect(call.danger).toBe(true)
    expect(call.message).toContain('123')
    expect(call.message).toContain('squash')
  })
})

describe('usePrMutations — onClose confirm guard', () => {
  beforeEach(() => {
    mutateMockFns.length = 0
    confirmMock.mockReset()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('confirm cancel → closeMut.mutate 미호출', async () => {
    confirmMock.mockResolvedValueOnce(false)
    const { m } = setup()
    await m.onClose()
    expect(mutateMockFns[4]).not.toHaveBeenCalled()
  })

  it('confirm OK → closeMut.mutate() 호출', async () => {
    confirmMock.mockResolvedValueOnce(true)
    const { m } = setup()
    await m.onClose()
    expect(mutateMockFns[4]).toHaveBeenCalled()
  })

  it('confirm message 에 number 인터폴레이션', async () => {
    confirmMock.mockResolvedValueOnce(false)
    const { m } = setup({ number: 99 })
    await m.onClose()
    const call = confirmMock.mock.calls[0][0] as { message: string; danger: boolean }
    expect(call.danger).toBe(true)
    expect(call.message).toContain('99')
  })
})

describe('usePrMutations — suggestion form state', () => {
  beforeEach(() => {
    mutateMockFns.length = 0
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('초기 상태 — open=false, path/code/context 빈 문자열, line=null', () => {
    const { m } = setup()
    expect(m.suggestion.open.value).toBe(false)
    expect(m.suggestion.path.value).toBe('')
    expect(m.suggestion.line.value).toBe(null)
    expect(m.suggestion.newCode.value).toBe('')
    expect(m.suggestion.context.value).toBe('')
  })

  it('reset() — 모든 필드 초기화', () => {
    const { m } = setup()
    m.suggestion.open.value = true
    m.suggestion.path.value = 'src/foo.ts'
    m.suggestion.line.value = 42
    m.suggestion.newCode.value = 'const x = 1'
    m.suggestion.context.value = '컨텍스트'
    m.suggestion.reset()
    expect(m.suggestion.open.value).toBe(false)
    expect(m.suggestion.path.value).toBe('')
    expect(m.suggestion.line.value).toBe(null)
    expect(m.suggestion.newCode.value).toBe('')
    expect(m.suggestion.context.value).toBe('')
  })
})
