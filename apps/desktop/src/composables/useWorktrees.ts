import { computed, type MaybeRefOrGetter, toRef } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { listWorktrees } from '@/api/git'

export function useWorktrees(repoIdRef: MaybeRefOrGetter<number | null>) {
  const repoId = toRef(repoIdRef)
  return useQuery({
    queryKey: computed(() => ['worktrees', repoId.value]),
    queryFn: () => {
      if (repoId.value == null) return Promise.resolve([])
      return listWorktrees(repoId.value)
    },
    enabled: computed(() => repoId.value != null),
  })
}
