import { computed, type MaybeRefOrGetter, toRef } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { listSubmodules } from '@/api/git'

export function useSubmodules(repoIdRef: MaybeRefOrGetter<number | null>) {
  const repoId = toRef(repoIdRef)
  return useQuery({
    queryKey: computed(() => ['submodules', repoId.value]),
    queryFn: () => {
      if (repoId.value == null) return Promise.resolve([])
      return listSubmodules(repoId.value)
    },
    enabled: computed(() => repoId.value != null),
  })
}
