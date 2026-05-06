import { type MaybeRefOrGetter } from 'vue'
import { listBranches } from '@/api/git'
import { useRepositoryQuery } from './useRepositoryQuery'

// Sprint c48 Wave C-3 — useRepositoryQuery factory 위임.
export function useBranches(repoIdRef: MaybeRefOrGetter<number | null>) {
  return useRepositoryQuery({
    name: 'branches',
    repoIdRef,
    fetchFn: listBranches,
    emptyValue: [],
  })
}
