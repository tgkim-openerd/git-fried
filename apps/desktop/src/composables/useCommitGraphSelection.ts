/**
 * Sprint c75-A — CommitGraph 의 c74 영역 (sha 로 jump + select) 분리.
 *
 * Sidebar MiniStashList 등 외부에서 sha 로 row 찾기 → selectRow + virtualizer 가시 영역
 * 가운데 정렬 (viewport 1/3 지점) 스크롤. wipActive 시 virtualizer idx 0 이 WIP row 라 +1 offset.
 *
 * window.gitFriedSelectCommit lifecycle 은 caller (CommitGraph.vue) 가 직접 onMounted /
 * onUnmounted 에서 register/dispose — 디버깅 친화 + SSR 부작용 격리.
 */
import { nextTick, type Ref, type ComputedRef } from 'vue'
import type { GraphRow } from '@/api/git'

export function useCommitGraphSelection(opts: {
  rows: ComputedRef<GraphRow[]>
  containerRef: Ref<HTMLElement | null>
  /** virtualizer idx offset (WIP active 시 1, 그 외 0). c76 — useCommitGraphRows.wipRowCount SOT. */
  wipRowCount: Readonly<Ref<number>>
  rowHeight: number
  selectRow: (row: GraphRow) => void
  /** scroll 후 호출 — Canvas 재그리기 등. */
  onScrollComplete?: () => void
}) {
  function selectAndScrollToSha(sha: string): boolean {
    const list = opts.rows.value
    if (!list || list.length === 0) return false
    const rowIdx = list.findIndex((r) => r.commit.sha === sha)
    if (rowIdx < 0) return false
    const row = list[rowIdx]
    opts.selectRow(row)
    // virtualizer 표시 idx — wipRowCount (SOT, useCommitGraphRows.virtualizer count 와 동일 식).
    const virtIdx = opts.wipRowCount.value + rowIdx
    const ct = opts.containerRef.value
    if (ct) {
      const targetTop = virtIdx * opts.rowHeight
      // 가운데(viewport 1/3 지점) — 충분히 잘 보이도록.
      const centeredScroll = Math.max(0, targetTop - ct.clientHeight / 3)
      ct.scrollTop = centeredScroll
      if (opts.onScrollComplete) nextTick(opts.onScrollComplete)
    }
    return true
  }

  return {
    selectAndScrollToSha,
  }
}
