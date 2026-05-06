import { computed, type MaybeRefOrGetter } from 'vue'
import { getGraph } from '@/api/git'
import { useRepositoryQuery } from './useRepositoryQuery'

// Sprint c48 Wave C-3 — useRepositoryQuery factory 위임. extraKey 로 limit 추가.
export function useGraph(repoIdRef: MaybeRefOrGetter<number | null>, limit = 500) {
  return useRepositoryQuery({
    name: 'graph',
    repoIdRef,
    fetchFn: (repoId) => getGraph(repoId, limit),
    emptyValue: { rows: [], maxLane: 0 },
    extraKey: computed(() => [limit] as const),
  })
}
