import { type MaybeRefOrGetter } from 'vue'
import { listSubmodules } from '@/api/git'
import { useRepositoryQuery } from './useRepositoryQuery'

// Sprint c48 Wave C-3 — useRepositoryQuery factory 위임.
export function useSubmodules(repoIdRef: MaybeRefOrGetter<number | null>) {
  return useRepositoryQuery({
    name: 'submodules',
    repoIdRef,
    fetchFn: listSubmodules,
    emptyValue: [],
  })
}
