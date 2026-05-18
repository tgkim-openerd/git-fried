// SB-012 (UltraPlan v0.4 sidebar microgap Phase 7-B, 2026-05-18) — Branch row 의
// 'select' 모드 selection state. Singleton ref — sidebar 전역에서 동일 selected branch 구독.
//
// localStorage 영속화 안 함 (selection 은 session memory — repo/workspace 전환 시 reset).
//
// 사용 흐름:
//   - uiSettings.branchClickAction === 'checkout' 모드: 본 composable 미사용 (즉시 전환)
//   - uiSettings.branchClickAction === 'select' 모드:
//       1) row click → setSelected(name)
//       2) row dblclick → checkout (caller 가 직접 처리)
//       3) selectedName 일치 row → ring 시각

import { ref, computed, type ComputedRef } from 'vue'

const selectedRef = ref<string | null>(null)

export interface UseBranchSelectionApi {
  /** 현재 selected branch name (null = no selection). */
  readonly selected: typeof selectedRef
  /** 본 name 이 selected 인지. */
  isSelected: (name: string) => ComputedRef<boolean>
  /** selection set. null 전달 시 clear. */
  setSelected: (name: string | null) => void
  /** selection clear. */
  clearSelection: () => void
}

export function useBranchSelection(): UseBranchSelectionApi {
  return {
    selected: selectedRef,
    isSelected: (name) => computed(() => selectedRef.value === name),
    setSelected: (name) => {
      selectedRef.value = name
    },
    clearSelection: () => {
      selectedRef.value = null
    },
  }
}
