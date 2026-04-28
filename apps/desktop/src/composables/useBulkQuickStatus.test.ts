import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { BulkResult, QuickStatus } from '@/api/git'

const dataRef = ref<BulkResult<QuickStatus>[] | undefined>(undefined)
const isFetchingRef = ref(false)

vi.mock('@tanstack/vue-query', () => ({
  useQuery: () => ({
    data: dataRef,
    isFetching: isFetchingRef,
  }),
}))

vi.mock('@/api/git', () => ({
  bulkQuickStatus: vi.fn(),
}))

vi.mock('@/api/queryClient', () => ({
  STALE_TIME: { STATIC: 0, NORMAL: 0, REALTIME: 0 },
}))

import { useBulkQuickStatus } from './useBulkQuickStatus'

function qs(over: Partial<QuickStatus> = {}): QuickStatus {
  return { branch: 'main', ahead: 0, behind: 0, ...over } as QuickStatus
}

function ok(repoId: number, data: QuickStatus): BulkResult<QuickStatus> {
  return { repoId, repoName: `r${repoId}`, success: true, data, error: null }
}

function fail(repoId: number): BulkResult<QuickStatus> {
  return { repoId, repoName: `r${repoId}`, success: false, data: null, error: 'fail' }
}

describe('useBulkQuickStatus', () => {
  beforeEach(() => {
    dataRef.value = undefined
    isFetchingRef.value = false
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('data undefined → 빈 Map', () => {
    const result = useBulkQuickStatus(() => 1)
    expect(result.value.byId.size).toBe(0)
    expect(result.value.isFetching).toBe(false)
  })

  it('성공한 결과만 Map 에 포함', () => {
    dataRef.value = [
      ok(1, qs({ branch: 'main', ahead: 2 })),
      fail(2),
      ok(3, qs({ branch: 'develop' })),
    ]
    const result = useBulkQuickStatus(() => 1)
    expect(result.value.byId.size).toBe(2)
    expect(result.value.byId.get(1)?.ahead).toBe(2)
    expect(result.value.byId.get(3)?.branch).toBe('develop')
    expect(result.value.byId.has(2)).toBe(false)
  })

  it('isFetching 반영', () => {
    isFetchingRef.value = true
    const result = useBulkQuickStatus(() => 1)
    expect(result.value.isFetching).toBe(true)
  })

  it('성공인데 data null 인 경우 제외', () => {
    dataRef.value = [
      { repoId: 1, repoName: 'r1', success: true, data: null, error: null },
    ] as BulkResult<QuickStatus>[]
    const result = useBulkQuickStatus(() => 1)
    expect(result.value.byId.size).toBe(0)
  })
})
