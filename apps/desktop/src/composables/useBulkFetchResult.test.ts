import { describe, expect, it, vi } from 'vitest'
import type { BulkResult } from '@/api/git'
import type { SyncResult } from '@/types/git'

async function importFresh() {
  vi.resetModules()
  return await import('./useBulkFetchResult')
}

function syncResult(over: Partial<SyncResult> = {}): SyncResult {
  return { fetched: 0, pulled: 0, ahead: 0, behind: 0, ...over } as SyncResult
}

function ok(repoId: number, repoName: string): BulkResult<SyncResult> {
  return {
    repoId,
    repoName,
    success: true,
    error: null,
    data: syncResult(),
  } as BulkResult<SyncResult>
}

function fail(repoId: number, repoName: string, error: string): BulkResult<SyncResult> {
  return {
    repoId,
    repoName,
    success: false,
    error,
    data: null,
  } as BulkResult<SyncResult>
}

describe('useBulkFetchResult', () => {
  it('initial last 는 null', async () => {
    const { useBulkFetchResult } = await importFresh()
    const { last } = useBulkFetchResult()
    expect(last.value).toBe(null)
  })

  it('set 호출 시 ranAt + results 저장', async () => {
    const { useBulkFetchResult } = await importFresh()
    const { last, set } = useBulkFetchResult()
    const before = Date.now()
    set([ok(1, 'frontend'), fail(2, 'backend', 'auth')])
    const after = Date.now()
    expect(last.value).not.toBe(null)
    expect(last.value!.results.length).toBe(2)
    expect(last.value!.ranAt).toBeGreaterThanOrEqual(before)
    expect(last.value!.ranAt).toBeLessThanOrEqual(after)
  })

  it('clear 후 null 복귀', async () => {
    const { useBulkFetchResult } = await importFresh()
    const { last, set, clear } = useBulkFetchResult()
    set([ok(1, 'a')])
    expect(last.value).not.toBe(null)
    clear()
    expect(last.value).toBe(null)
  })

  it('singleton — 두 번 호출 시 같은 ref', async () => {
    const { useBulkFetchResult } = await importFresh()
    const a = useBulkFetchResult()
    const b = useBulkFetchResult()
    a.set([ok(1, 'a')])
    expect(b.last.value).not.toBe(null)
    expect(b.last.value!.results.length).toBe(1)
  })
})
