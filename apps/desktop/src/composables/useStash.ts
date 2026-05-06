import { type MaybeRefOrGetter } from 'vue'
import { listStash } from '@/api/git'
import { useRepositoryQuery } from './useRepositoryQuery'

// Sprint c48 Wave C-3 — useRepositoryQuery factory 위임.
export function useStash(repoIdRef: MaybeRefOrGetter<number | null>) {
  return useRepositoryQuery({
    name: 'stash',
    repoIdRef,
    fetchFn: listStash,
    emptyValue: [],
  })
}
