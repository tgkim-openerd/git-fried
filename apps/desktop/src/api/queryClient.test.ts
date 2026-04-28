import { describe, expect, it } from 'vitest'
import { queryClient, STALE_TIME } from './queryClient'

describe('STALE_TIME 3-tier 정책', () => {
  it('REALTIME: 2초', () => {
    expect(STALE_TIME.REALTIME).toBe(2_000)
  })
  it('NORMAL: 30초', () => {
    expect(STALE_TIME.NORMAL).toBe(30_000)
  })
  it('STATIC: 60초', () => {
    expect(STALE_TIME.STATIC).toBe(60_000)
  })
  it('REALTIME < NORMAL < STATIC 순서 보장', () => {
    expect(STALE_TIME.REALTIME).toBeLessThan(STALE_TIME.NORMAL)
    expect(STALE_TIME.NORMAL).toBeLessThan(STALE_TIME.STATIC)
  })
})

describe('queryClient defaultOptions', () => {
  it('queries default — staleTime = NORMAL, retry 1, gcTime 5min', () => {
    const opts = queryClient.getDefaultOptions().queries
    expect(opts?.staleTime).toBe(STALE_TIME.NORMAL)
    expect(opts?.retry).toBe(1)
    expect(opts?.retryDelay).toBe(500)
    expect(opts?.gcTime).toBe(5 * 60_000)
    expect(opts?.refetchOnWindowFocus).toBe(true)
    expect(opts?.refetchOnReconnect).toBe(false)
  })

  it('mutations default — retry 0', () => {
    const opts = queryClient.getDefaultOptions().mutations
    expect(opts?.retry).toBe(0)
  })
})
