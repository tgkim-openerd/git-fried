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

  // Sprint c45 PERF-2 — overscan 동적: 5000+ commits 시 stutter 감소.
  // Sprint c77-B — viewport-aware 추가: 작은 viewport (focusMode 200px) 에서 overscan 12 가
  // visible 7 rows 의 171% 비대 + 빠른 wheel 못 따라감. visibleCount × 0.5 baseline 으로
  // viewport 크기 적응 + rows 개수 임계 max 와 결합.
  const dynamicOverscan = computed(() => {
    const n = rows.value.length
    const viewportH = containerRef.value?.clientHeight ?? 500
    const visibleCount = Math.ceil(viewportH / ROW_H)
    const viewportBased = Math.max(12, Math.ceil(visibleCount * 0.5))
    // rows 개수 기준 상한 — 큰 repo 는 더 많은 overscan 으로 평탄화.
    const rowsBased = n < 1000 ? 12 : n < 3000 ? 16 : n < 5000 ? 20 : 24
    return Math.max(viewportBased, rowsBased)
  })

  const virtualizer = useVirtualizer(
    computed(() => ({
      count: rows.value.length + wipRowCount.value,
      getScrollElement: () => containerRef.value,
      estimateSize: () => ROW_H,
      overscan: dynamicOverscan.value,
      // PERF-307 (plan v0.9 Phase 3.2) — measureElement 로 dynamic row height capture.
      // 멀티라인 commit subject / branch tag wrap 시 28px const estimateSize 오차 보정.
      // 비용: re-measure 시 +1-3ms/scroll (Codex consultation 권고). DOM resize observer
      // 가 자동 capture — caller 가 row template 에 `:ref="virtualizer.measureElement"`
      // 명시 안 해도 vue-virtual 5.x 내장 ResizeObserver 사용.
      //
      // code-review TYPE-002: @tanstack/virtual-core 의 TItemElement 는 non-nullable.
      // 이전 `el?.` 는 dead optional chaining. `||` 로 0 height 도 ROW_H fallback.
      // code-review ARCH-003: ROW_H 는 useGraphWidth 의 export const — 외부에서 변경 시
      // estimateSize + measureElement fallback 모두 동시 변경됨 (silent coupling 의도적).
      measureElement: (el) => el.getBoundingClientRect().height || ROW_H,
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
