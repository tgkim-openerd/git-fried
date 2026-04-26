import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { listProfiles } from '@/api/git'

export function useProfiles() {
  const q = useQuery({
    queryKey: ['profiles'],
    queryFn: listProfiles,
    staleTime: 30_000,
  })
  const active = computed(() => q.data.value?.find((p) => p.isActive) ?? null)
  return { ...q, active }
}
