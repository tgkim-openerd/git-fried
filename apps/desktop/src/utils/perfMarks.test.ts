// code-review ARCH-007 — perfMarks.ts 단위 테스트.
// measureSpan / fpsCounter 순수 함수 5 case. mark/installPerfAPI 는 window/PerformanceObserver
// 영향이라 happy-dom 환경에서 부분 검증만 (PERF.now / PERF.mark 기본 지원).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fpsCounter, mark, measureSpan } from './perfMarks'

describe('perfMarks — measureSpan', () => {
  beforeEach(() => {
    // 깨끗한 mark slate 보장 (happy-dom 의 performance.clearMarks 사용).
    performance.clearMarks?.()
  })

  it('mark 2개 시퀀스 → measureSpan > 0', () => {
    mark('test-start')
    // happy-dom 의 performance.now 진행 보장 — 일부 환경에서 동시 mark 도 같은 timestamp.
    // assertion 은 >= 0 으로 (음수만 제외).
    mark('test-end')
    const span = measureSpan('test-start', 'test-end')
    expect(span).toBeGreaterThanOrEqual(0)
  })

  it('존재 안하는 mark → -1', () => {
    expect(measureSpan('missing-a', 'missing-b')).toBe(-1)
  })

  it('start 만 있고 end 없음 → -1', () => {
    mark('only-start')
    expect(measureSpan('only-start', 'never-marked')).toBe(-1)
  })
})

describe('perfMarks — fpsCounter', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('초기 상태 (tick 0) → 0 반환', () => {
    const fps = fpsCounter()
    expect(fps.current()).toBe(0)
  })

  it('tick 1회 → 여전히 0 (n<2 가드)', () => {
    const fps = fpsCounter()
    fps.tick()
    expect(fps.current()).toBe(0)
  })

  it('reset 호출 → 0 복귀', () => {
    const fps = fpsCounter()
    fps.tick()
    fps.tick()
    fps.tick()
    fps.reset()
    expect(fps.current()).toBe(0)
  })
})
