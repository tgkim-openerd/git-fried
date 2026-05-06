import { type MaybeRefOrGetter } from 'vue'
import { listWorktrees } from '@/api/git'
import { useRepositoryQuery } from './useRepositoryQuery'

// Sprint c48 Wave C-3 — useRepositoryQuery factory 위임.
export function useWorktrees(repoIdRef: MaybeRefOrGetter<number | null>) {
  return useRepositoryQuery({
    name: 'worktrees',
    repoIdRef,
    fetchFn: listWorktrees,
    emptyValue: [],
  })
}
