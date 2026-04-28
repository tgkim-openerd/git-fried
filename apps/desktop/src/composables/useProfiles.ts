import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { listProfiles } from '@/api/git'
import { STALE_TIME } from '@/api/queryClient'

export function useProfiles() {
  const q = useQuery({
    queryKey: ['profiles'],
    queryFn: listProfiles,
    staleTime: STALE_TIME.STATIC,
  })
  const active = computed(() => q.data.value?.find((p) => p.isActive) ?? null)
  return { ...q, active }
}
