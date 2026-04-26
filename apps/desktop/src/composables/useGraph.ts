import { computed, type MaybeRefOrGetter, toRef } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { getGraph } from '@/api/git'

export function useGraph(
  repoIdRef: MaybeRefOrGetter<number | null>,
  limit = 500,
) {
  const repoId = toRef(repoIdRef)
  return useQuery({
    queryKey: computed(() => ['graph', repoId.value, limit]),
    queryFn: () => {
      if (repoId.value == null) return Promise.resolve({ rows: [], maxLane: 0 })
      return getGraph(repoId.value, limit)
    },
    enabled: computed(() => repoId.value != null),
  })
}
