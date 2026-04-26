import { computed, type MaybeRefOrGetter, toRef } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { listPullRequests } from '@/api/git'
import type { PrState } from '@/api/git'

export function usePullRequests(
  repoIdRef: MaybeRefOrGetter<number | null>,
  stateRef: MaybeRefOrGetter<PrState | null> = null,
) {
  const repoId = toRef(repoIdRef)
  const state = toRef(stateRef)
  return useQuery({
    queryKey: computed(() => ['prs', repoId.value, state.value]),
    queryFn: () => {
      if (repoId.value == null) return Promise.resolve([])
      return listPullRequests(repoId.value, state.value)
    },
    enabled: computed(() => repoId.value != null),
  })
}
