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

// code-review TYPE-001 — Tauri 는 항상 browser context (Node SSR 없음). globalThis 캐스트
// 대신 narrow 한 fallback: performance 만 optional 노출. SSR/test 환경 (Node) 에서도
// happy-dom 이 performance 제공.
const W: { performance?: Performance } =
  typeof window !== 'undefined' ? window : (globalThis as { performance?: Performance })
const PERF = W.performance

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
 * `window.gitFriedPerf` 노출 — devtools console 에서 접근.
 *
 * code-review SEC-003: production 무조건 활성 시 DevTools fingerprinting / privacy 표면.
 *   → `import.meta.env.DEV` 또는 명시 `VITE_PERF_DEBUG=1` 환경에서만 install.
 *
 * code-review ARCH-001: window.gitFried* 기존 prefix 와 일관 (`gitFriedPerf`, `_` 제거).
 *   window.d.ts 에 정식 등재 — `as unknown as` 캐스트 제거.
 */
export interface GitFriedPerfAPI {
  coldStartMs: () => number
  marks: () => string[]
  // 향후 expand: graph_render_ms / ai_compose_ms 등
}

// code-review ARCH-002 — non-composable: main.ts entry-level 1회 호출. window 등록 후
// unmount cleanup 없음 (app lifetime 과 동일). lifecycle bind 가 아니라 startup augment.
export function installPerfAPI(): void {
  if (typeof window === 'undefined') return
  // SEC-003 — DEV / explicit opt-in 만. production 무조건 노출 차단.
  const enabled = import.meta.env?.DEV === true || import.meta.env?.VITE_PERF_DEBUG === '1'
  if (!enabled) return
  const api: GitFriedPerfAPI = {
    coldStartMs: () => measureSpan('app-start', 'app-mounted'),
    marks: () =>
      PERF?.getEntriesByType?.('mark')
        ?.map((e) => e.name)
        .filter((n) => n.startsWith('gf:')) ?? [],
  }
  // ARCH-001 — window.d.ts 정식 등재로 직접 할당 (캐스트 제거).
  window.gitFriedPerf = api
}
