// ARCH-006 fix — 활성 레포 status 의 파생 카운트 공통 추출.
//
// ChangeCountBadge / GitKrakenToolbar / ActiveRepoQuickActions 3 컴포넌트가 동일한
// `{ total, staged, unstaged, untracked, conflicted }` 파생 로직을 중복했음. 카테고리
// 추가 시 drift 방지 + 단일 진실원천.

import { computed, type ComputedRef, type MaybeRefOrGetter } from 'vue'
import { useStatus } from './useStatus'

export interface StatusCounts {
  total: number
  staged: number
  unstaged: number
  untracked: number
  conflicted: number
}

export interface UseStatusCountsResult {
  counts: ComputedRef<StatusCounts>
  hasChanges: ComputedRef<boolean>
  isClean: ComputedRef<boolean>
}

export function useStatusCounts(
  repoIdRef: MaybeRefOrGetter<number | null>,
): UseStatusCountsResult {
  const { data: status } = useStatus(repoIdRef)

  const counts = computed<StatusCounts>(() => {
    const s = status.value
    if (!s) return { total: 0, staged: 0, unstaged: 0, untracked: 0, conflicted: 0 }
    const staged = s.staged?.length ?? 0
    const unstaged = s.unstaged?.length ?? 0
    const untracked = s.untracked?.length ?? 0
    const conflicted = s.conflicted?.length ?? 0
    return {
      total: staged + unstaged + untracked + conflicted,
      staged,
      unstaged,
      untracked,
      conflicted,
    }
  })

  const hasChanges = computed(() => counts.value.total > 0)
  const isClean = computed(() => counts.value.total === 0)

  return { counts, hasChanges, isClean }
}
