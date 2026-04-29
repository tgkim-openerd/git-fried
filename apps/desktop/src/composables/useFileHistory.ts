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
  /** Sprint c30 / GitKraken UX (Phase 8b) — rev 인자 추가 (HEAD default). */
  revRef?: MaybeRefOrGetter<string | null>,
) {
  const repoId = toRef(repoIdRef)
  const path = toRef(pathRef)
  const rev = toRef(revRef ?? null)
  return useQuery({
    queryKey: computed(() => ['file-blame', repoId.value, path.value, rev.value]),
    queryFn: () => {
      if (repoId.value == null || !path.value) return Promise.resolve([])
      return getFileBlame(repoId.value, path.value, rev.value)
    },
    enabled: computed(() => repoId.value != null && !!path.value),
  })
}
