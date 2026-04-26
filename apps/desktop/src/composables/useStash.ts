import { computed, type MaybeRefOrGetter, toRef } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { listStash } from '@/api/git'

export function useStash(repoIdRef: MaybeRefOrGetter<number | null>) {
  const repoId = toRef(repoIdRef)
  return useQuery({
    queryKey: computed(() => ['stash', repoId.value]),
    queryFn: () => {
      if (repoId.value == null) return Promise.resolve([])
      return listStash(repoId.value)
    },
    enabled: computed(() => repoId.value != null),
  })
}
