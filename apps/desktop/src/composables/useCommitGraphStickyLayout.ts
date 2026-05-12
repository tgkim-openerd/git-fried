// Sprint c78-A — CommitGraph 202→<200 LOC 회귀 해소.
//
// branch chip sticky overlay 좌표 + drag handle 매직넘버 SOT (Pattern 13).
// 본래 CommitGraph.vue 안에 있던 5 개 상수/computed 를 단일 composable 로 분리.
//   - HANDLE_WIDTH (12px) / INNER_DIVIDER_WIDTH (2px) / INNER_DIVIDER_LEFT (5px)
//   - branchChipStickyWidth — useCommitColumns.ALL_COLUMNS 의 branchTag widthPx fallback
//   - branchChipStickyLeft — graphWidth + HANDLE_WIDTH offset
//
// caller 는 graphWidth 와 cols.allColumns 만 주입 (Pattern 9 caller-decision).
import { computed, type ComputedRef, type MaybeRefOrGetter, toRef } from 'vue'
import { BRANCH_TAG_DEFAULT_WIDTH_PX } from '@/composables/useCommitColumns'

export const HANDLE_WIDTH = 12
export const INNER_DIVIDER_WIDTH = 2
// 산식: (HANDLE_WIDTH - INNER_DIVIDER_WIDTH) / 2 — currently 5. 두 magic 변경 시 자동 derive.
export const INNER_DIVIDER_LEFT = (HANDLE_WIDTH - INNER_DIVIDER_WIDTH) / 2

interface ColumnLike {
  id: string
  widthPx?: number | null
}

interface UseCommitGraphStickyLayoutArgs {
  graphWidth: MaybeRefOrGetter<number>
  allColumns: MaybeRefOrGetter<readonly ColumnLike[]>
}

export function useCommitGraphStickyLayout(args: UseCommitGraphStickyLayoutArgs): {
  branchChipStickyWidth: ComputedRef<number>
  branchChipStickyLeft: ComputedRef<number>
} {
  const graphWidth = toRef(args.graphWidth)
  const allColumns = toRef(args.allColumns)

  const branchChipStickyWidth = computed(() => {
    const w = allColumns.value.find((c) => c.id === 'branchTag')?.widthPx
    return w ?? BRANCH_TAG_DEFAULT_WIDTH_PX
  })
  const branchChipStickyLeft = computed(() => graphWidth.value + HANDLE_WIDTH)

  return { branchChipStickyWidth, branchChipStickyLeft }
}
