// 활성 레포의 상태(working tree) 를 Vue Query 로 관리.
// 폴링은 디폴트 OFF — IPC + 사용자 액션 후 invalidate.
import { computed, type MaybeRefOrGetter, toRef } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { getStatus } from '@/api/git'
import { STALE_TIME } from '@/api/queryClient'

export function useStatus(repoIdRef: MaybeRefOrGetter<number | null>) {
  const repoId = toRef(repoIdRef)
  const query = useQuery({
    queryKey: computed(() => ['status', repoId.value]),
    queryFn: () => {
      if (repoId.value == null) return Promise.reject(new Error('no repo'))
      return getStatus(repoId.value)
    },
    enabled: computed(() => repoId.value != null),
    staleTime: STALE_TIME.REALTIME,
  })
  return query
}

export function useInvalidateRepoQueries() {
  const qc = useQueryClient()
  return (repoId: number | null) => {
    qc.invalidateQueries({ queryKey: ['status', repoId] })
    qc.invalidateQueries({ queryKey: ['log', repoId] })
    qc.invalidateQueries({ queryKey: ['repos'] })
  }
}
