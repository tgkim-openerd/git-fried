// Sprint c37 god comp 분리 18/N — CommitGraph.vue 의 graph column width 분리.
//
// 책임:
//   - graphWidth state (localStorage 영속)
//   - zoomIn / zoomOut (+/- 20px 단위)
//   - drag handle (mousedown / mousemove / mouseup) 으로 graph column 폭 직접 조정
//   - laneW 계산 (maxLane 기반 자동 분배, clamp 8~36)
//
// 사용:
//   const w = useGraphWidth(maxLane)
//   onUnmounted(w.cleanup)  // mousemove/mouseup listener 제거
//
// LOC 절감: CommitGraph 99-160, 452-484 = 약 80 LOC.
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'

export const ROW_H = 28
export const LANE_W_MIN = 8
export const LANE_W_MAX = 36

const DEFAULT_GRAPH_W = 200
const MIN_GRAPH_W = 80
const MAX_GRAPH_W = 400
const GRAPH_W_KEY = 'git-fried.commit-graph-width'

function loadGraphW(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_GRAPH_W
  const v = localStorage.getItem(GRAPH_W_KEY)
  if (!v) return DEFAULT_GRAPH_W
  const n = Number.parseInt(v, 10)
  if (!Number.isFinite(n)) return DEFAULT_GRAPH_W
  return Math.min(MAX_GRAPH_W, Math.max(MIN_GRAPH_W, n))
}

export interface UseGraphWidthReturn {
  graphWidth: Ref<number>
  laneW: ComputedRef<number>
  /** zoomOut 비활성 (이미 MIN). template `:disabled` 용. */
  zoomOutDisabled: ComputedRef<boolean>
  /** zoomIn 비활성 (이미 MAX). template `:disabled` 용. */
  zoomInDisabled: ComputedRef<boolean>
  zoomIn: () => void
  zoomOut: () => void
  onDragHandleStart: (ev: MouseEvent) => void
  cleanup: () => void
}

export function useGraphWidth(maxLane: ComputedRef<number> | Ref<number>): UseGraphWidthReturn {
  const graphWidth = ref<number>(loadGraphW())

  watch(graphWidth, (v) => {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(GRAPH_W_KEY, String(v))
    } catch {
      /* ignore */
    }
  })

  // Phase 9 — laneW 자동 계산 (graphWidth 기반).
  //   maxLane 1 → laneW = graphWidth - 16 (clamp 36 으로 줄음)
  //   maxLane 10 → laneW ≈ (graphWidth - 16) / 10
  //   lane 잘림 회피하려면 graphWidth 늘리거나 zoom-in.
  const laneW = computed(() => {
    const ml = Math.max(1, maxLane.value)
    const lw = Math.floor((graphWidth.value - 16) / ml)
    return Math.max(LANE_W_MIN, Math.min(LANE_W_MAX, lw))
  })

  function zoomIn() {
    graphWidth.value = Math.min(MAX_GRAPH_W, graphWidth.value + 20)
  }
  function zoomOut() {
    graphWidth.value = Math.max(MIN_GRAPH_W, graphWidth.value - 20)
  }

  const zoomOutDisabled = computed(() => graphWidth.value <= MIN_GRAPH_W)
  const zoomInDisabled = computed(() => graphWidth.value >= MAX_GRAPH_W)

  // Sprint C5 — Graph column drag-resize.
  //   사용자 의도 = "테이블 헤더 늘이기/줄이기" — graph column 폭 직접 (1px = 1px).
  let dragStartX = 0
  let dragStartGraphW = DEFAULT_GRAPH_W
  let dragging = false

  function onDragMove(ev: MouseEvent) {
    if (!dragging) return
    const dx = ev.clientX - dragStartX
    graphWidth.value = Math.min(MAX_GRAPH_W, Math.max(MIN_GRAPH_W, dragStartGraphW + dx))
  }

  function onDragEnd() {
    dragging = false
    window.removeEventListener('mousemove', onDragMove)
    window.removeEventListener('mouseup', onDragEnd)
  }

  function onDragHandleStart(ev: MouseEvent) {
    ev.preventDefault()
    dragging = true
    dragStartX = ev.clientX
    dragStartGraphW = graphWidth.value
    window.addEventListener('mousemove', onDragMove)
    window.addEventListener('mouseup', onDragEnd)
  }

  function cleanup() {
    window.removeEventListener('mousemove', onDragMove)
    window.removeEventListener('mouseup', onDragEnd)
  }

  return {
    graphWidth,
    laneW,
    zoomOutDisabled,
    zoomInDisabled,
    zoomIn,
    zoomOut,
    onDragHandleStart,
    cleanup,
  }
}
