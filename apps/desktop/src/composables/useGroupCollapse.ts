// Sprint c50 — useGroupCollapse composable (Pattern 10 in vue3-composable-extraction).
//
// 그룹 트리 UI 의 collapse-all / expand-all 상태 관리. 두 디자인 함정 회피:
//   1. Vue3 ref<Set>/ref<Map> 컨테이너 mutation 시 reactivity trigger 안 됨 — new Set(prev) immutable update 필수
//   2. native <details> :open binding ↔ toggle event 양방향 동기화 필수 — 단방향이면 사용자 클릭과 프로그램 제어 race
//
// 도입 후보: repositories.vue (현재 16 LOC 응집체) / Sidebar.vue 트리 / BranchesPanel.vue 등.
import { computed, ref, type ComputedRef, type Ref } from 'vue'

export interface GroupKeyed {
  key: string
}

export interface UseGroupCollapseReturn {
  collapsedKeys: Ref<Set<string>>
  allCollapsed: ComputedRef<boolean>
  isOpen: (key: string) => boolean
  setOpen: (key: string, open: boolean) => void
  collapseAll: () => void
  expandAll: () => void
}

export function useGroupCollapse(
  groups: ComputedRef<readonly GroupKeyed[]>,
): UseGroupCollapseReturn {
  const collapsedKeys = ref(new Set<string>())

  const allCollapsed = computed(
    () => groups.value.length > 0 && groups.value.every((g) => collapsedKeys.value.has(g.key)),
  )

  function isOpen(key: string): boolean {
    return !collapsedKeys.value.has(key)
  }

  // <details> @toggle ↔ ref 양방향 동기화. Set 재할당으로 reactivity 보장.
  function setOpen(key: string, open: boolean): void {
    const next = new Set(collapsedKeys.value)
    if (open) next.delete(key)
    else next.add(key)
    collapsedKeys.value = next
  }

  function collapseAll(): void {
    collapsedKeys.value = new Set(groups.value.map((g) => g.key))
  }

  function expandAll(): void {
    collapsedKeys.value = new Set()
  }

  return { collapsedKeys, allCollapsed, isOpen, setOpen, collapseAll, expandAll }
}
