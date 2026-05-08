// Sprint c40 후속 review ARCH-004 — CommitGraph.vue (623 LOC) 의 header menu +
// column 재정렬 영역 외부화 (script 273 → 약 230 LOC, 임계 200 근접).
//
// 책임:
//   - useCommitColumns 래핑 (visibleColumns / branchTagColumnVisible)
//   - headerMenuOpen ref + outside-click handler (mousedown listener add/remove)
//   - openHeaderMenu / resetColsAndCloseMenu / colDef helper
//   - VueDraggable 재정렬용 headerOrder ref + watch + onReorder
//
// 사용:
//   const {
//     cols, headerMenuOpen, headerMenuRef, headerOrder,
//     branchTagColumnVisible, openHeaderMenu, onHeaderMenuOutside,
//     onReorder, resetColsAndCloseMenu, colDef,
//   } = useCommitGraphHeader()
//
// LOC 절감: CommitGraph script 220-270 (~50 LOC) → 약 12 LOC destructure.
import { computed, nextTick, ref, watch } from 'vue'
import { useCommitColumns, type CommitColumnId } from '@/composables/useCommitColumns'

export function useCommitGraphHeader() {
  const cols = useCommitColumns()

  // Phase 13-4 — branchTag 컬럼 visible 시 message 안의 ref pill 생략 (중복 회피).
  const branchTagColumnVisible = computed(() =>
    cols.visibleColumns.value.some((c) => c.id === 'branchTag'),
  )

  /**
   * Sprint c52 / c51 보류 #5 — branch chip column sticky-left.
   *
   * Sprint c54 — disable: sticky overlay 의 `position: sticky + top: 0 + height: 100%` 조합이
   * viewport-stick + children `top: v.start` (virtualizer 좌표) mismatch 야기 → chip 이
   * 잘못된 위치 또는 0건으로 보이는 회귀. 사용자 보고 "그래프 모든 commit chip 부재" + 스크롤 시
   * UI artifact. 일단 false 로 강제하여 일반 row chip 분기 (정상 chip 표시) 복귀.
   *
   * c54+ 에서 sticky-left 재설계 (예: column 헤더 외부 fixed overlay + scrollTop 동기화) 시점에
   * 위 computed 로 복원.
   */
  const branchTagSticky = computed(() => false)

  const headerMenuOpen = ref(false)
  const headerMenuRef = ref<HTMLDivElement | null>(null)

  function openHeaderMenu(ev: MouseEvent) {
    ev.preventDefault()
    headerMenuOpen.value = true
  }

  function onHeaderMenuOutside(ev: MouseEvent) {
    if (!headerMenuRef.value) return
    if (!headerMenuRef.value.contains(ev.target as Node)) {
      headerMenuOpen.value = false
    }
  }

  watch(headerMenuOpen, (open) => {
    if (open) {
      nextTick(() => {
        window.addEventListener('mousedown', onHeaderMenuOutside)
      })
    } else {
      window.removeEventListener('mousedown', onHeaderMenuOutside)
    }
  })

  // drag-drop 의 v-model 은 visibleColumns 의 mutated 배열.
  // VueDraggable 이 array 를 in-place 변경하므로 setOrder 호출.
  const headerOrder = ref<CommitColumnId[]>(cols.visibleIds.value.slice())
  watch(cols.visibleIds, (ids) => {
    headerOrder.value = ids.slice()
  })
  function onReorder() {
    cols.setOrder(headerOrder.value)
  }

  // "기본값 복원" — prettier 가 vue template 의 multi-statement 를 깨뜨려
  // parse 에러 일으키는 회귀 방지용 함수 추출.
  function resetColsAndCloseMenu() {
    cols.reset()
    headerMenuOpen.value = false
  }

  function colDef(id: CommitColumnId) {
    return cols.allColumns.find((c) => c.id === id)
  }

  return {
    cols,
    headerMenuOpen,
    headerMenuRef,
    headerOrder,
    branchTagColumnVisible,
    branchTagSticky,
    openHeaderMenu,
    onHeaderMenuOutside,
    onReorder,
    resetColsAndCloseMenu,
    colDef,
  }
}
