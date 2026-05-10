// c60 Wave B — useStageMutations 단위 테스트.
//
// helper 함수 (stageOne/unstageOne/discardOne/stageAll/unstageAll) 의 caller decision
// (repoId guard, confirmDialog, paths derive) 만 검증.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RepoStatus } from '@/types/git'

const mutateMockFns: Array<ReturnType<typeof vi.fn>> = []

vi.mock('@tanstack/vue-query', () => ({
  useMutation: (opts: { mutationFn: unknown; onSuccess?: unknown }) => {
    const mutate = vi.fn()
    mutateMockFns.push(mutate)
    return { mutate, mutationFn: opts.mutationFn, isPending: { value: false } }
  },
}))

vi.mock('@/api/git', () => ({
  stagePaths: vi.fn(),
  unstagePaths: vi.fn(),
  discardPaths: vi.fn(),
  stageAll: vi.fn(),
}))

vi.mock('./useStatus', () => ({
  useInvalidateRepoQueries: () => vi.fn(),
}))

const confirmMock = vi.fn()
vi.mock('./useConfirm', () => ({
  confirmDialog: (opts: unknown) => confirmMock(opts),
}))

vi.mock('@/i18n', () => ({
  i18n: {
    global: { t: (k: string, p?: Record<string, unknown>) => `${k}:${JSON.stringify(p ?? {})}` },
  },
}))

import { useStageMutations } from './useStageMutations'

function makeStatus(staged: string[] = []): RepoStatus {
  return {
    staged: staged.map((p) => ({ path: p, status: 'modified' })),
    unstaged: [],
    untracked: [],
    conflicted: [],
    isClean: staged.length === 0,
  } as unknown as RepoStatus
}

describe('useStageMutations — guard + paths derive', () => {
  beforeEach(() => {
    mutateMockFns.length = 0
    confirmMock.mockReset()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  // mutateMockFns 인덱스 (등록 순서):
  //   0=stageMut, 1=unstageMut, 2=discardMut, 3=stageAllMut

  it('repoId null → stageOne / unstageOne / stageAll / unstageAll noop', () => {
    const m = useStageMutations(
      () => null,
      () => makeStatus(['a']),
    )
    m.stageOne('a')
    m.unstageOne('a')
    m.stageAll()
    m.unstageAll()
    for (const fn of mutateMockFns) expect(fn).not.toHaveBeenCalled()
  })

  it('stageOne(path) → stageMut.mutate({ id, paths: [path] })', () => {
    const m = useStageMutations(
      () => 1,
      () => makeStatus(),
    )
    m.stageOne('foo.ts')
    expect(mutateMockFns[0]).toHaveBeenCalledWith({ id: 1, paths: ['foo.ts'] })
  })

  it('unstageOne(path) → unstageMut.mutate({ id, paths: [path] })', () => {
    const m = useStageMutations(
      () => 2,
      () => makeStatus(),
    )
    m.unstageOne('bar.ts')
    expect(mutateMockFns[1]).toHaveBeenCalledWith({ id: 2, paths: ['bar.ts'] })
  })

  it('stageAll() → stageAllMut.mutate(repoId)', () => {
    const m = useStageMutations(
      () => 3,
      () => makeStatus(),
    )
    m.stageAll()
    expect(mutateMockFns[3]).toHaveBeenCalledWith(3)
  })

  it('unstageAll — staged 비었을 때 mutate 미호출', () => {
    const m = useStageMutations(
      () => 1,
      () => makeStatus([]),
    )
    m.unstageAll()
    expect(mutateMockFns[1]).not.toHaveBeenCalled()
  })

  it('unstageAll — staged paths 모아 unstageMut.mutate', () => {
    const m = useStageMutations(
      () => 9,
      () => makeStatus(['a.ts', 'b.ts', 'c.ts']),
    )
    m.unstageAll()
    expect(mutateMockFns[1]).toHaveBeenCalledWith({ id: 9, paths: ['a.ts', 'b.ts', 'c.ts'] })
  })
})

describe('useStageMutations — discardOne (confirm)', () => {
  beforeEach(() => {
    mutateMockFns.length = 0
    confirmMock.mockReset()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('repoId null → confirm 미호출 + mutate 미호출', async () => {
    const m = useStageMutations(
      () => null,
      () => makeStatus(),
    )
    await m.discardOne('foo.ts')
    expect(confirmMock).not.toHaveBeenCalled()
    expect(mutateMockFns[2]).not.toHaveBeenCalled()
  })

  it('confirm cancel → mutate 미호출', async () => {
    confirmMock.mockResolvedValueOnce(false)
    const m = useStageMutations(
      () => 1,
      () => makeStatus(),
    )
    await m.discardOne('foo.ts')
    expect(confirmMock).toHaveBeenCalledOnce()
    expect(mutateMockFns[2]).not.toHaveBeenCalled()
  })

  it('confirm OK → discardMut.mutate({ id, paths: [path] })', async () => {
    confirmMock.mockResolvedValueOnce(true)
    const m = useStageMutations(
      () => 5,
      () => makeStatus(),
    )
    await m.discardOne('foo.ts')
    expect(mutateMockFns[2]).toHaveBeenCalledWith({ id: 5, paths: ['foo.ts'] })
  })

  it('confirm message 에 path 인터폴레이션 전달', async () => {
    confirmMock.mockResolvedValueOnce(false)
    const m = useStageMutations(
      () => 1,
      () => makeStatus(),
    )
    await m.discardOne('src/foo/bar.ts')
    const call = confirmMock.mock.calls[0][0] as { message: string; danger: boolean }
    expect(call.danger).toBe(true)
    expect(call.message).toContain('src/foo/bar.ts')
  })
})
