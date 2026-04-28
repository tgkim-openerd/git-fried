// File-name filter for StatusPanel 4 sections (Sprint 22-6 F-I1).
//
// 50+ 파일 환경에서 staged / unstaged / untracked / conflicted 4 섹션을 동일 substring
// 필터로 좁힘 — case-insensitive substring match. trim() 후 빈 문자열은 모두 통과.
//
// StatusPanel.vue 의 1070 LOC God component 분리 1차 (composable 추출).
// 재사용 컨텍스트: StatusPanel + 향후 BulkOperationModal / FileHistoryPanel 등.

import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { FileChange, RepoStatus } from '@/types/git'

export interface UseStatusFilterReturn {
  fileFilter: Ref<string>
  matchFilter: (path: string) => boolean
  filteredStaged: ComputedRef<readonly FileChange[]>
  filteredUnstaged: ComputedRef<readonly FileChange[]>
  filteredUntracked: ComputedRef<readonly string[]>
  filteredConflicted: ComputedRef<readonly string[]>
  hasAnyMatch: ComputedRef<boolean>
}

export function useStatusFilter(status: Ref<RepoStatus | null | undefined>): UseStatusFilterReturn {
  const fileFilter = ref('')

  function matchFilter(path: string): boolean {
    const q = fileFilter.value.trim().toLowerCase()
    if (!q) return true
    return path.toLowerCase().includes(q)
  }

  const filteredStaged = computed(() =>
    (status.value?.staged ?? []).filter((f) => matchFilter(f.path)),
  )
  const filteredUnstaged = computed(() =>
    (status.value?.unstaged ?? []).filter((f) => matchFilter(f.path)),
  )
  const filteredUntracked = computed(() =>
    (status.value?.untracked ?? []).filter((p) => matchFilter(p)),
  )
  const filteredConflicted = computed(() =>
    (status.value?.conflicted ?? []).filter((p) => matchFilter(p)),
  )

  const hasAnyMatch = computed(
    () =>
      filteredStaged.value.length > 0 ||
      filteredUnstaged.value.length > 0 ||
      filteredUntracked.value.length > 0 ||
      filteredConflicted.value.length > 0,
  )

  return {
    fileFilter,
    matchFilter,
    filteredStaged,
    filteredUnstaged,
    filteredUntracked,
    filteredConflicted,
    hasAnyMatch,
  }
}
