// Sprint 22-11 F-P3 — Sidebar 50+ repo "어느 레포 작업할까" preview 용 quick status.
//
// `bulk_quick_status` IPC (file walk 생략, ~50× 빠름) 의 결과를 Map<repoId, QuickStatus> 로
// 가공해 Sidebar 의 v-for 안에서 O(1) lookup 가능하게 한다.
//
// staleTime: STATIC (사용자 수동 fetch 시점 외에는 거의 변하지 않음).
// invalidate trigger: bulkFetch onSuccess + repos query change.

import { computed, type ComputedRef, type MaybeRefOrGetter, toRef } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { bulkQuickStatus, type QuickStatus } from '@/api/git'
import { STALE_TIME } from '@/api/queryClient'

export interface QuickStatusMap {
  /** repoId → QuickStatus (fetch 성공 케이스만). */
  byId: Map<number, QuickStatus>
  /** 로딩 여부. */
  isFetching: boolean
}

export function useBulkQuickStatus(
  workspaceIdRef: MaybeRefOrGetter<number | null>,
): ComputedRef<QuickStatusMap> {
  const workspaceId = toRef(workspaceIdRef)
  const query = useQuery({
    queryKey: computed(() => ['bulkQuickStatus', workspaceId.value]),
    queryFn: () => bulkQuickStatus(workspaceId.value),
    staleTime: STALE_TIME.STATIC,
    enabled: computed(() => workspaceId.value != null),
  })

  return computed<QuickStatusMap>(() => {
    const m = new Map<number, QuickStatus>()
    for (const r of query.data.value ?? []) {
      if (r.success && r.data) {
        m.set(r.repoId, r.data)
      }
    }
    return { byId: m, isFetching: query.isFetching.value }
  })
}
