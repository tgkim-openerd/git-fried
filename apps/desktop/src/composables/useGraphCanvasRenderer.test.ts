// plan #45 M3 — CommitGraph scroll perf: scheduleDraw 가 연속 트리거를 rAF 로 coalesce
// (프레임당 draw 1회) 하는지 회귀 보호. 렌더 출력 로직은 불변 (drawGraph 동기 유지) —
// 변경은 "언제 그리느냐"(매 scroll → 프레임당 1회)뿐이라 interaction 정확성은 구조적으로 보존.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref, computed, effectScope } from 'vue'
import { useGraphCanvasRenderer } from './useGraphCanvasRenderer'

function makeRenderer() {
  return useGraphCanvasRenderer({
    canvasRef: ref(null), // canvas null → drawGraph 은 silent early-return (캔버스 op 불필요)
    containerRef: ref(null),
    virtualItems: computed(() => []),
    rows: ref([]),
    laneW: ref(12),
    graphWidth: ref(100),
    wipActive: ref(false),
    rowHeight: 24,
  })
}

describe('useGraphCanvasRenderer — scheduleDraw rAF coalesce (M3)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('연속 scheduleDraw 는 프레임당 rAF 1회만 예약, 프레임 후 재예약 가능', () => {
    const rafSpy = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation(() => 1 as unknown as number)

    const scope = effectScope()
    let r!: ReturnType<typeof useGraphCanvasRenderer>
    scope.run(() => {
      r = makeRenderer()
    })

    // 한 프레임 안의 연속 트리거 → rAF 1회 (coalesce).
    r.scheduleDraw()
    r.scheduleDraw()
    r.scheduleDraw()
    expect(rafSpy).toHaveBeenCalledTimes(1)

    // 프레임 콜백 실행(rafId reset) 후 새 트리거 → 새 프레임 예약.
    const cb = rafSpy.mock.calls[0]![0] as FrameRequestCallback
    cb(0)
    r.scheduleDraw()
    expect(rafSpy).toHaveBeenCalledTimes(2)

    scope.stop()
  })

  it('scope dispose 시 대기 중 rAF 취소', () => {
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 42 as unknown as number)
    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})

    const scope = effectScope()
    let r!: ReturnType<typeof useGraphCanvasRenderer>
    scope.run(() => {
      r = makeRenderer()
    })
    r.scheduleDraw() // 대기 중 rAF (id=42)
    scope.stop() // onScopeDispose → cancelAnimationFrame(42)

    expect(cancelSpy).toHaveBeenCalledWith(42)
  })
})
