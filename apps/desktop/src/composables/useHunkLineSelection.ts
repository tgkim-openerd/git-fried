// Sprint c40 후속 review ARCH-004 — HunkStageModal.vue (700 LOC) 의 line 선택
// state 외부화. shift-click range / per-hunk Set / totalSelected 통합.
//
// 책임:
//   - selected ref<Map<hunkIdx, Set<lineIdx>>> + anchor (shift-click)
//   - isSelected / toggleLine / selectAllLines / clearLines
//   - totalSelected computed
//   - 외부에서 hunks ref 주입 (parseDiff 의 DiffHunk[]) — line stageable 여부 판정용
//
// 사용:
//   const { selected, isSelected, toggleLine, selectAllLines, clearLines,
//           totalSelected, resetAll } = useHunkLineSelection(hunks)
//
// LOC 절감: HunkStageModal 70-120 (~50 LOC) → 약 8 LOC destructure.
import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { isStageableLine, type DiffHunk } from '@/utils/parseDiff'

export function useHunkLineSelection(hunks: Ref<DiffHunk[]> | ComputedRef<DiffHunk[]>) {
  /// Map<hunkIdx, Set<lineIdx>> — hunk 별 선택된 라인 집합.
  const selected = ref<Map<number, Set<number>>>(new Map())
  /// shift-click range 의 anchor (hunkIdx, lineIdx).
  const anchor = ref<{ hunk: number; line: number } | null>(null)

  function isSelected(hunkIdx: number, lineIdx: number): boolean {
    return selected.value.get(hunkIdx)?.has(lineIdx) ?? false
  }

  function toggleLine(hunkIdx: number, lineIdx: number, e?: MouseEvent) {
    const m = new Map(selected.value)
    let s = m.get(hunkIdx) ? new Set(m.get(hunkIdx)) : new Set<number>()
    if (e?.shiftKey && anchor.value && anchor.value.hunk === hunkIdx) {
      // range — anchor 부터 lineIdx 까지 stageable 라인 모두 선택.
      const [a, b] = [anchor.value.line, lineIdx].sort((x, y) => x - y)
      const body = hunks.value[hunkIdx].bodyLines
      for (let i = a; i <= b; i++) {
        if (body[i] && isStageableLine(body[i])) s.add(i)
      }
    } else {
      if (s.has(lineIdx)) s.delete(lineIdx)
      else s.add(lineIdx)
      anchor.value = { hunk: hunkIdx, line: lineIdx }
    }
    if (s.size === 0) m.delete(hunkIdx)
    else m.set(hunkIdx, s)
    selected.value = m
  }

  function selectAllLines(hunkIdx: number) {
    const body = hunks.value[hunkIdx].bodyLines
    const s = new Set<number>()
    body.forEach((l, i) => {
      if (isStageableLine(l)) s.add(i)
    })
    const m = new Map(selected.value)
    if (s.size === 0) m.delete(hunkIdx)
    else m.set(hunkIdx, s)
    selected.value = m
  }

  function clearLines(hunkIdx: number) {
    const m = new Map(selected.value)
    m.delete(hunkIdx)
    selected.value = m
  }

  const totalSelected = computed(() => {
    let n = 0
    for (const s of selected.value.values()) n += s.size
    return n
  })

  /// applyMut 성공 시 전체 선택 초기화 (호출 측 onSuccess 에서 사용).
  function resetAll() {
    selected.value = new Map()
  }

  return {
    selected,
    isSelected,
    toggleLine,
    selectAllLines,
    clearLines,
    totalSelected,
    resetAll,
  }
}
