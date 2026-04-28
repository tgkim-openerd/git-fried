import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetForTest,
  completeOperation,
  registerOperation,
  useLongRunningProgress,
} from './useLongRunningProgress'

describe('useLongRunningProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-28T17:00:00Z'))
    __resetForTest()
  })

  afterEach(() => {
    __resetForTest()
    vi.useRealTimers()
  })

  it('initial state is empty', () => {
    const lrp = useLongRunningProgress()
    expect(lrp.activeOperations.value.length).toBe(0)
    expect(lrp.visibleOperations.value.length).toBe(0)
  })

  it('register adds operation in idle stage', () => {
    const lrp = useLongRunningProgress()
    const id = registerOperation('clone_repo')
    expect(typeof id).toBe('number')
    expect(lrp.activeOperations.value.length).toBe(1)
    expect(lrp.activeOperations.value[0].label).toBe('clone_repo')
    expect(lrp.activeOperations.value[0].stage).toBe('idle')
    // idle 은 visible 에서 제외
    expect(lrp.visibleOperations.value.length).toBe(0)
  })

  it('stage transitions through over30s / over1m / over4m', () => {
    const lrp = useLongRunningProgress()
    registerOperation('bulk_fetch')

    // 29s — still idle
    vi.advanceTimersByTime(29_000)
    expect(lrp.activeOperations.value[0].stage).toBe('idle')
    expect(lrp.visibleOperations.value.length).toBe(0)

    // 30s — over30s
    vi.advanceTimersByTime(1_000)
    expect(lrp.activeOperations.value[0].stage).toBe('over30s')
    expect(lrp.visibleOperations.value.length).toBe(1)

    // 1m — over1m
    vi.advanceTimersByTime(30_000)
    expect(lrp.activeOperations.value[0].stage).toBe('over1m')

    // 4m — over4m
    vi.advanceTimersByTime(3 * 60_000)
    expect(lrp.activeOperations.value[0].stage).toBe('over4m')
  })

  it('complete removes operation', () => {
    const lrp = useLongRunningProgress()
    const id = registerOperation('push')
    expect(lrp.activeOperations.value.length).toBe(1)
    completeOperation(id)
    expect(lrp.activeOperations.value.length).toBe(0)
  })

  it('complete with unknown id is noop', () => {
    const lrp = useLongRunningProgress()
    expect(() => completeOperation(999)).not.toThrow()
    expect(lrp.activeOperations.value.length).toBe(0)
  })

  it('multiple operations sorted by startedAt asc', () => {
    const lrp = useLongRunningProgress()
    registerOperation('first')
    vi.advanceTimersByTime(2_000)
    registerOperation('second')
    vi.advanceTimersByTime(1_000)
    registerOperation('third')

    expect(lrp.activeOperations.value.map((o) => o.label)).toEqual(['first', 'second', 'third'])
  })

  it('elapsedMs reflects fake timer advance', () => {
    const lrp = useLongRunningProgress()
    registerOperation('fetch_all')
    vi.advanceTimersByTime(45_000)
    expect(lrp.activeOperations.value[0].elapsedMs).toBeGreaterThanOrEqual(45_000)
    expect(lrp.activeOperations.value[0].elapsedMs).toBeLessThan(46_000)
  })

  it('visibleOperations filters idle', () => {
    const lrp = useLongRunningProgress()
    registerOperation('quick')
    vi.advanceTimersByTime(35_000)
    registerOperation('justNow') // idle
    expect(lrp.visibleOperations.value.length).toBe(1)
    expect(lrp.visibleOperations.value[0].label).toBe('quick')
  })
})
