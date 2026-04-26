import { computed, type MaybeRefOrGetter, toRef } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { getFileBlame, getFileHistory } from '@/api/git'

export function useFileHistory(
  repoIdRef: MaybeRefOrGetter<number | null>,
  pathRef: MaybeRefOrGetter<string | null>,
) {
  const repoId = toRef(repoIdRef)
  const path = toRef(pathRef)
  return useQuery({
    queryKey: computed(() => ['file-history', repoId.value, path.value]),
    queryFn: () => {
      if (repoId.value == null || !path.value) return Promise.resolve([])
      return getFileHistory(repoId.value, path.value)
    },
    enabled: computed(() => repoId.value != null && !!path.value),
  })
}

export function useFileBlame(
  repoIdRef: MaybeRefOrGetter<number | null>,
  pathRef: MaybeRefOrGetter<string | null>,
) {
  const repoId = toRef(repoIdRef)
  const path = toRef(pathRef)
  return useQuery({
    queryKey: computed(() => ['file-blame', repoId.value, path.value]),
    queryFn: () => {
      if (repoId.value == null || !path.value) return Promise.resolve([])
      return getFileBlame(repoId.value, path.value)
    },
    enabled: computed(() => repoId.value != null && !!path.value),
  })
}
