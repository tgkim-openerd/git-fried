/**
 * Sprint c75-A — CommitGraph 무한 스크롤 분리 (c74 도입 영역).
 *
 * Rust IPC 가 skip 미지원 → 매번 처음부터 limit 만큼 fetch (vue-query cache 가 throttle).
 * 끝 50% 근접 시 +STEP, CAP 도달 시 stop. backend 가 limit 보다 적게 반환하면 모든 commit
 * fetch 완료로 판단 (-10 buffer).
 */
import type { Ref, ComputedRef } from 'vue'
import type { GraphRow } from '@/api/git'

export const GRAPH_LIMIT_STEP = 500
export const GRAPH_LIMIT_CAP = 5000

/**
 * useGraph(graphLimit) 가 외부에서 호출되어야 하므로 graphLimit 은 caller 가 ref 로 만들어
 * 주입 (Pattern 9 caller-decision). composable 은 onScroll 만 책임.
 */
export function useGraphInfiniteScroll(opts: {
  graphLimit: Ref<number>
  containerRef: Ref<HTMLElement | null>
  rows: ComputedRef<GraphRow[]>
  isFetching: Readonly<Ref<boolean>>
  /** scroll 이벤트마다 호출 — Canvas 재그리기 등. */
  onScrollSideEffect?: () => void
}) {
  function onScroll() {
    opts.onScrollSideEffect?.()
    const ct = opts.containerRef.value
    if (!ct || opts.isFetching.value) return
    if (opts.graphLimit.value >= GRAPH_LIMIT_CAP) return
    // backend 가 limit 보다 적게 반환 = 모든 commit fetch 완료.
    if (opts.rows.value.length < opts.graphLimit.value - 10) return
    const nearEnd = ct.scrollTop + ct.clientHeight >= ct.scrollHeight - ct.clientHeight * 0.5
    if (nearEnd) {
      opts.graphLimit.value = Math.min(GRAPH_LIMIT_CAP, opts.graphLimit.value + GRAPH_LIMIT_STEP)
    }
  }

  return { onScroll }
}
