// Sprint c37 god comp 분리 19/N — CommitGraph.vue 의 selection + vim nav 분리.
//
// 책임:
//   - selectedSha state
//   - selectRow(row) / selectWipRow() — emit wrapper
//   - moveSelection(±1) — vim J/K 다음/이전 행 + 가시 영역 스크롤
//   - useShortcut('vimDown' / 'vimUp' / 'vimLeft') 등록
//
// 사용:
//   const sel = useGraphSelection({
//     rows,
//     containerRef,
//     onSelectCommit: (sha) => emit('selectCommit', sha),
//     onSelectWip: () => emit('selectWip'),
//     rowHeight: ROW_H,
//   })
//
// LOC 절감: CommitGraph 321-398 ~ 80 LOC.
import { ref, type Ref } from 'vue'
import { useShortcut } from '@/composables/useShortcuts'
import type { GraphRow } from '@/api/git'

export interface UseGraphSelectionOptions {
  rows: Ref<GraphRow[]>
  containerRef: Ref<HTMLDivElement | null>
  onSelectCommit: (sha: string) => void
  onSelectWip?: () => void
  rowHeight?: number
}

export interface UseGraphSelectionReturn {
  selectedSha: Ref<string | null>
  selectRow: (r: GraphRow | null) => void
  selectWipRow: () => void
  moveSelection: (delta: 1 | -1) => void
}

export function useGraphSelection(options: UseGraphSelectionOptions): UseGraphSelectionReturn {
  const { rows, containerRef, onSelectCommit, onSelectWip, rowHeight = 28 } = options

  const selectedSha = ref<string | null>(null)

  function selectRow(r: GraphRow | null) {
    if (!r) return
    selectedSha.value = r.commit.sha
    onSelectCommit(r.commit.sha)
  }

  function selectWipRow() {
    onSelectWip?.()
  }

  // Vim nav (J/K) — selectedSha 다음/이전 행. 비어있으면 첫 행 선택.
  function moveSelection(delta: 1 | -1) {
    const list = rows.value
    if (list.length === 0) return
    let idx = list.findIndex((r) => r.commit.sha === selectedSha.value)
    if (idx < 0) {
      idx = delta > 0 ? 0 : list.length - 1
    } else {
      idx = Math.max(0, Math.min(list.length - 1, idx + delta))
    }
    const r = list[idx]
    if (!r) return
    selectedSha.value = r.commit.sha
    onSelectCommit(r.commit.sha)
    // 가시 영역으로 스크롤
    if (containerRef.value) {
      const targetTop = idx * rowHeight
      const ct = containerRef.value
      if (targetTop < ct.scrollTop) ct.scrollTop = targetTop
      else if (targetTop + rowHeight > ct.scrollTop + ct.clientHeight) {
        ct.scrollTop = targetTop + rowHeight - ct.clientHeight
      }
    }
  }

  useShortcut('vimDown', () => moveSelection(1))
  useShortcut('vimUp', () => moveSelection(-1))
  useShortcut('vimLeft', () => {
    selectedSha.value = null
  })

  return {
    selectedSha,
    selectRow,
    selectWipRow,
    moveSelection,
  }
}
