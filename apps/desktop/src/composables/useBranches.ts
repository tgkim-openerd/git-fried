import { computed, type MaybeRefOrGetter, toRef } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { listBranches } from '@/api/git'

export function useBranches(repoIdRef: MaybeRefOrGetter<number | null>) {
  const repoId = toRef(repoIdRef)
  return useQuery({
    queryKey: computed(() => ['branches', repoId.value]),
    queryFn: () => {
      if (repoId.value == null) return Promise.resolve([])
      return listBranches(repoId.value)
    },
    enabled: computed(() => repoId.value != null),
  })
}
