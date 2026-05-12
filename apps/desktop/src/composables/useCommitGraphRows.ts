// Sprint c48 Wave B-2 — CommitGraph.vue script 227 LOC 분리 1/2.
//
// 본 composable: WIP pseudo-row + virtualizer 통합 — 가장 자주 변경되는 회귀 영역.
//   - useStatus 로 dirty 감지 → wipActive / wipChangeCount
//   - useVirtualizer (count: rows + wipActive 1, dynamic overscan)
//   - virtualizer index → row 매핑 (wipActive 시 idx-1 offset)
//   - commitTooltip 헬퍼 (subject + body 포맷)
//
// Sprint c45 PERF-2 dynamic overscan + Sprint c30 GitKraken UX Phase 8a WIP row 통합.
import { computed, type ComputedRef, type Ref } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useStatus } from '@/composables/useStatus'
import { ROW_H } from '@/composables/useGraphWidth'
import type { GraphRow } from '@/api/git'

interface UseCommitGraphRowsArgs {
  repoId: () => number | null
  rows: ComputedRef<GraphRow[]>
  containerRef: Ref<HTMLElement | null>
}

export function useCommitGraphRows({ repoId, rows, containerRef }: UseCommitGraphRowsArgs) {
  // Sprint c30 / GitKraken UX (Phase 8a) — working dir dirty 감지.
  const { data: status } = useStatus(repoId)
  const wipActive = computed(() => !!status.value && !status.value.isClean)
  const wipChangeCount = computed(() => {
    const s = status.value
    if (!s) return 0
    return s.staged.length + s.unstaged.length + s.untracked.length + s.conflicted.length
  })

  // Sprint c76 — virtualizer count (`rows.length + (wipActive ? 1 : 0)`) 의 +1 offset SOT.
  // 본 파일 내부 (virtualizer count / commitRowAt) + 외부 (useCommitGraphSelection) 가
  // 동일 식 derive — Pattern 13 sister (SOT derive fallback drift 회피).
  // c76-extra (/code-review ARCH-001 후속): 내부도 wipRowCount.value 로 통합 — 진정한 단일 SOT.
  const wipRowCount = computed(() => (wipActive.value ? 1 : 0))

  // Sprint c45 PERF-2 — overscan 동적: 5000+ commits 시 stutter 감소 (12 → 최대 24).
  //   기준: 1000 미만 12 / 1000~3000 16 / 3000~5000 20 / 5000+ 24.
  //   소규모 repo 는 메모리 경량, 대규모는 스크롤 평탄화.
  const dynamicOverscan = computed(() => {
    const n = rows.value.length
    if (n < 1000) return 12
    if (n < 3000) return 16
    if (n < 5000) return 20
    return 24
  })

  const virtualizer = useVirtualizer(
    computed(() => ({
      count: rows.value.length + wipRowCount.value,
      getScrollElement: () => containerRef.value,
      estimateSize: () => ROW_H,
      overscan: dynamicOverscan.value,
    })),
  )
  const virtualItems = computed(() => virtualizer.value.getVirtualItems())
  const totalHeight = computed(() => virtualizer.value.getTotalSize())

  /**
   * virtualizer index → row 매핑. wipRowCount > 0 시 idx=0 는 WIP (null 반환),
   * idx=1+ 는 rows[idx-wipRowCount]. clean 시 idx 그대로 rows[idx].
   * useGraphCanvasRenderer.isWipIdx 가 wipActive 직접 참조 (c76 wipRowCount 와 동일 source).
   */
  function commitRowAt(idx: number): GraphRow | null {
    if (wipRowCount.value > 0 && idx === 0) return null
    const offset = idx - wipRowCount.value
    return rows.value[offset] ?? null
  }

  function commitTooltip(row: GraphRow | null | undefined): string {
    if (!row) return ''
    const subject = row.commit.subject ?? ''
    const body = (row.commit.body ?? '').trim()
    return body ? `${subject}\n\n${body}` : subject
  }

  return {
    wipActive,
    wipRowCount,
    wipChangeCount,
    virtualItems,
    totalHeight,
    commitRowAt,
    commitTooltip,
  }
}
