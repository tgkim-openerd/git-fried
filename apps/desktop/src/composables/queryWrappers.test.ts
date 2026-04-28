import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, type ComputedRef, type Ref } from 'vue'

// 6 query wrapper composables 통합 테스트 — 모두 동일 패턴:
//   useQuery({ queryKey: computed([key, repoId, ...]), queryFn, enabled: computed(repoId != null) })
//
// vue-query useQuery 를 spy mock 으로 capture, options 검증.

interface UseQueryArgs {
  queryKey: ComputedRef<unknown[]>
  queryFn: () => Promise<unknown>
  enabled: ComputedRef<boolean>
}

const useQuerySpy = vi.fn<(args: UseQueryArgs) => { data: Ref<unknown> }>(() => ({
  data: ref(undefined),
}))

vi.mock('@tanstack/vue-query', () => ({
  useQuery: (args: UseQueryArgs) => useQuerySpy(args),
}))

vi.mock('@/api/git', () => ({
  listStash: vi.fn(() => Promise.resolve(['stash1'])),
  listSubmodules: vi.fn(() => Promise.resolve(['mod1'])),
  listWorktrees: vi.fn(() => Promise.resolve(['wt1'])),
  listBranches: vi.fn(() => Promise.resolve(['main'])),
  listPullRequests: vi.fn((_id: number, _state: unknown) => Promise.resolve([])),
  getGraph: vi.fn(() => Promise.resolve({ rows: [], maxLane: 0 })),
}))

vi.mock('@/api/queryClient', () => ({
  STALE_TIME: { STATIC: 0, NORMAL: 0, REALTIME: 0 },
}))

import { useStash } from './useStash'
import { useSubmodules } from './useSubmodules'
import { useWorktrees } from './useWorktrees'
import { useBranches } from './useBranches'
import { usePullRequests } from './usePullRequests'
import { useGraph } from './useGraph'

function lastCall(): UseQueryArgs {
  const calls = useQuerySpy.mock.calls
  return calls[calls.length - 1][0]
}

describe('query wrapper composables', () => {
  beforeEach(() => {
    useQuerySpy.mockClear()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe.each([
    { name: 'useStash', fn: () => useStash(() => 1), key: 'stash', emptyKey: 'stash' },
    {
      name: 'useSubmodules',
      fn: () => useSubmodules(() => 1),
      key: 'submodules',
      emptyKey: 'submodules',
    },
    {
      name: 'useWorktrees',
      fn: () => useWorktrees(() => 1),
      key: 'worktrees',
      emptyKey: 'worktrees',
    },
    { name: 'useBranches', fn: () => useBranches(() => 1), key: 'branches', emptyKey: 'branches' },
  ])('$name', ({ name, fn, key }) => {
    it(`${name} — queryKey 첫 segment = "${key}"`, () => {
      fn()
      const args = lastCall()
      expect(args.queryKey.value[0]).toBe(key)
      expect(args.queryKey.value[1]).toBe(1) // repoId
    })

    it(`${name} — repoId null 시 enabled=false`, () => {
      const wrappers: Record<string, (g: () => number | null) => unknown> = {
        useStash,
        useSubmodules,
        useWorktrees,
        useBranches,
      } as unknown as Record<string, (g: () => number | null) => unknown>
      wrappers[name](() => null)
      const args = lastCall()
      expect(args.enabled.value).toBe(false)
    })

    it(`${name} — repoId null 시 queryFn 빈 배열 resolve`, async () => {
      const wrappers: Record<string, (g: () => number | null) => unknown> = {
        useStash,
        useSubmodules,
        useWorktrees,
        useBranches,
      } as unknown as Record<string, (g: () => number | null) => unknown>
      wrappers[name](() => null)
      const args = lastCall()
      const data = await args.queryFn()
      expect(data).toEqual([])
    })
  })

  describe('usePullRequests', () => {
    it('queryKey = ["prs", repoId, state]', () => {
      usePullRequests(
        () => 5,
        () => 'open',
      )
      const args = lastCall()
      expect(args.queryKey.value).toEqual(['prs', 5, 'open'])
    })

    it('repoId null → 빈 배열 + enabled false', async () => {
      usePullRequests(() => null)
      const args = lastCall()
      expect(args.enabled.value).toBe(false)
      expect(await args.queryFn()).toEqual([])
    })
  })

  describe('useGraph', () => {
    it('queryKey = ["graph", repoId, limit]', () => {
      useGraph(() => 7, 100)
      const args = lastCall()
      expect(args.queryKey.value).toEqual(['graph', 7, 100])
    })

    it('limit 기본값 = 500', () => {
      useGraph(() => 1)
      const args = lastCall()
      expect(args.queryKey.value[2]).toBe(500)
    })

    it('repoId null → 빈 graph 결과', async () => {
      useGraph(() => null)
      const args = lastCall()
      expect(args.enabled.value).toBe(false)
      const data = await args.queryFn()
      expect(data).toEqual({ rows: [], maxLane: 0 })
    })
  })
})
