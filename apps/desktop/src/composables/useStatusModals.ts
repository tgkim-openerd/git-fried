// Sprint c31 god comp 분리 6/N — StatusPanel.vue 의 3개 modal state (File history /
// 3-way merge / Hunk-level) 을 단일 composable 로 통합.
//
// 책임:
//   - historyPath / historyOpen + openHistory(path)
//   - mergePath / mergeOpen + openMerge(path)
//   - hunkPath / hunkStaged / hunkOpen + openHunk(path, isStaged)
//
// 다른 컴포넌트 (CommitDiffPanel / FileHistoryModal trigger 등) 에서도 동일 인터페이스
// 가능 — singleton 이 아니라 호출 시 신규 인스턴스 (각 컴포넌트의 modal stack 분리).
import { ref, type Ref } from 'vue'

export interface UseStatusModalsReturn {
  // File history
  historyPath: Ref<string | null>
  historyOpen: Ref<boolean>
  openHistory: (path: string) => void
  closeHistory: () => void

  // 3-way merge
  mergePath: Ref<string | null>
  mergeOpen: Ref<boolean>
  openMerge: (path: string) => void
  closeMerge: () => void

  // Hunk-level stage / unstage
  hunkPath: Ref<string | null>
  hunkStaged: Ref<boolean>
  hunkOpen: Ref<boolean>
  openHunk: (path: string, staged: boolean) => void
  closeHunk: () => void
}

export function useStatusModals(): UseStatusModalsReturn {
  // File history modal
  const historyPath = ref<string | null>(null)
  const historyOpen = ref(false)
  function openHistory(path: string) {
    historyPath.value = path
    historyOpen.value = true
  }
  function closeHistory() {
    historyOpen.value = false
  }

  // 3-way merge modal
  const mergePath = ref<string | null>(null)
  const mergeOpen = ref(false)
  function openMerge(path: string) {
    mergePath.value = path
    mergeOpen.value = true
  }
  function closeMerge() {
    mergeOpen.value = false
  }

  // Hunk-level stage / unstage modal
  const hunkPath = ref<string | null>(null)
  const hunkStaged = ref(false)
  const hunkOpen = ref(false)
  function openHunk(path: string, staged: boolean) {
    hunkPath.value = path
    hunkStaged.value = staged
    hunkOpen.value = true
  }
  function closeHunk() {
    hunkOpen.value = false
  }

  return {
    historyPath,
    historyOpen,
    openHistory,
    closeHistory,
    mergePath,
    mergeOpen,
    openMerge,
    closeMerge,
    hunkPath,
    hunkStaged,
    hunkOpen,
    openHunk,
    closeHunk,
  }
}
