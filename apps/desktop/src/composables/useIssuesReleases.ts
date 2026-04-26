import { computed, type MaybeRefOrGetter, toRef } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { listForgeIssues, listForgeReleases } from '@/api/git'

export function useIssues(repoIdRef: MaybeRefOrGetter<number | null>) {
  const repoId = toRef(repoIdRef)
  return useQuery({
    queryKey: computed(() => ['issues', repoId.value]),
    queryFn: () => {
      if (repoId.value == null) return Promise.resolve([])
      return listForgeIssues(repoId.value)
    },
    enabled: computed(() => repoId.value != null),
  })
}

export function useReleases(repoIdRef: MaybeRefOrGetter<number | null>) {
  const repoId = toRef(repoIdRef)
  return useQuery({
    queryKey: computed(() => ['releases', repoId.value]),
    queryFn: () => {
      if (repoId.value == null) return Promise.resolve([])
      return listForgeReleases(repoId.value)
    },
    enabled: computed(() => repoId.value != null),
  })
}
