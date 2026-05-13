// Sprint c78-A — CommitGraph 202→<200 LOC 회귀 해소.
// v0.4 #4 (UltraPlan plan/31) — WCAG 2.2 SC 2.5.8 Target Size 24×24 (AA).
//
// branch chip sticky overlay 좌표 + drag handle 매직넘버 SOT (Pattern 13).
// 본래 CommitGraph.vue 안에 있던 5 개 상수/computed 를 단일 composable 로 분리.
//   - HANDLE_WIDTH (24px, c80+ WCAG 2.5.8 — 시각적 inner divider 2px 유지)
//     visible marker 는 INNER_DIVIDER (2px) 가 center. hit-area 만 24 로 확장.
//     keyboard 대안: ArrowLeft/Right (c55 P2-2, WCAG 2.5.7 Drag Movements 충족).
//   - INNER_DIVIDER_LEFT — 자동 derive ((24-2)/2 = 11)
//   - branchChipStickyWidth — useCommitColumns.ALL_COLUMNS 의 branchTag widthPx fallback
//   - branchChipStickyLeft — graphWidth + HANDLE_WIDTH offset
//
// caller 는 graphWidth 와 cols.allColumns 만 주입 (Pattern 9 caller-decision).
import { computed, type ComputedRef, type MaybeRefOrGetter, toRef } from 'vue'
import { BRANCH_TAG_DEFAULT_WIDTH_PX } from '@/composables/useCommitColumns'

// v0.4 #4 — WCAG 2.5.8 24×24 — 12px (c46 UX-10) → 24px hit-area 확장.
// visible inner divider 2px 는 그대로 (시각 변화 0).
export const HANDLE_WIDTH = 24
export const INNER_DIVIDER_WIDTH = 2
// 산식: (HANDLE_WIDTH - INNER_DIVIDER_WIDTH) / 2 — 현재 11. magic 변경 시 자동 derive.
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
