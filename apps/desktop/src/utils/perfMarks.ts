// Phase 3.1 (plan v0.9 §3.5 c88) — Performance API marks for cold_start + fps.
//
// 측정 대상 (plan/30 §10 + bench/baseline.json):
//   - cold_start_ms (target 1500): main.ts entry → app.mount 완료 마크
//   - file_scroll_fps (target 60): requestAnimationFrame counter (Sliding 1s window)
//
// 사용:
//   import { mark, measureSpan, fpsCounter } from '@/utils/perfMarks'
//   mark('app-start')   // main.ts top
//   mark('app-mounted') // app.mount 후
//   const ms = measureSpan('app-start', 'app-mounted')  // cold start
//
//   const fps = fpsCounter() // 1s sliding window
//   onScroll(() => fps.tick())
//   console.log(fps.current()) // 현재 fps
//
// 결과: 사용자가 devtools console 에서 `__gitFriedPerf` 확인 가능.

const W = typeof window !== 'undefined' ? window : (globalThis as Window & typeof globalThis)
const PERF = W?.performance

/**
 * Performance.mark wrapper. PerformanceObserver 가 자동 capture.
 * 같은 name 마크 시 SET 으로 덮어쓰지 않고 다른 entry 추가됨 (latest timestamp 사용).
 */
export function mark(name: string): void {
  if (!PERF?.mark) return
  try {
    PERF.mark(`gf:${name}`)
  } catch {
    /* DOMException — name 충돌 등, silent */
  }
}

/**
 * 두 mark 사이 시간 (ms). 마지막 entry 기준.
 * 반환: 음수면 unmeasured / -1.
 */
export function measureSpan(start: string, end: string): number {
  if (!PERF?.getEntriesByName) return -1
  const s = PERF.getEntriesByName(`gf:${start}`, 'mark').slice(-1)[0]
  const e = PERF.getEntriesByName(`gf:${end}`, 'mark').slice(-1)[0]
  if (!s || !e) return -1
  return Math.max(0, e.startTime - s.startTime)
}

/**
 * Sliding 1s window FPS counter (requestAnimationFrame 기반).
 * tick() 호출 시점이 frame.
 *
 * 사용:
 *   const fps = fpsCounter()
 *   function loop() {
 *     fps.tick()
 *     requestAnimationFrame(loop)
 *   }
 *   loop()
 *   // ... fps.current()  // 1s window 평균 fps (0~60+)
 */
export interface FpsCounter {
  tick: () => void
  current: () => number
  reset: () => void
}

export function fpsCounter(windowMs = 1000): FpsCounter {
  const frames: number[] = []
  const now = () => PERF?.now?.() ?? Date.now()
  return {
    tick(): void {
      const t = now()
      frames.push(t)
      // 1s 이전 frame 폐기.
      const cutoff = t - windowMs
      while (frames.length > 0 && frames[0] < cutoff) frames.shift()
    },
    current(): number {
      const n = frames.length
      if (n < 2) return 0
      const span = frames[n - 1] - frames[0]
      if (span <= 0) return 0
      // n-1 intervals, span ms = (n-1) / span * 1000 fps
      return Math.round(((n - 1) / span) * 1000 * 10) / 10
    },
    reset(): void {
      frames.length = 0
    },
  }
}

/**
 * `window.__gitFriedPerf` 노출 — devtools console 에서 접근.
 * Tauri build / dev / prod 모두 활성.
 */
export interface GitFriedPerfAPI {
  coldStartMs: () => number
  marks: () => string[]
  // 향후 expand: graph_render_ms / ai_compose_ms 등
}

export function installPerfAPI(): void {
  if (typeof window === 'undefined') return
  const api: GitFriedPerfAPI = {
    coldStartMs: () => measureSpan('app-start', 'app-mounted'),
    marks: () =>
      PERF?.getEntriesByType?.('mark')
        ?.map((e) => e.name)
        .filter((n) => n.startsWith('gf:')) ?? [],
  }
  ;(window as unknown as { __gitFriedPerf?: GitFriedPerfAPI }).__gitFriedPerf = api
}
