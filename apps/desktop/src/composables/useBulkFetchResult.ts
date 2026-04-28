// Bulk fetch 결과 globalState (`docs/plan/22 §2 C1`).
//
// Sidebar 의 bulkFetch 결과 (성공 + 실패 모두) 를 module-level singleton 에 저장.
// BulkFetchResultModal 이 이를 읽어 표시 — 5+ 실패 시 toast 절단 문제 해소.
import { ref } from 'vue'
import type { BulkResult } from '@/api/git'
import type { SyncResult } from '@/types/git'

export interface BulkFetchSnapshot {
  ranAt: number // unix ms
  results: BulkResult<SyncResult>[]
}

// module-level singleton (Vue 의 reactive ref 가 그대로 share)
const last = ref<BulkFetchSnapshot | null>(null)

export function useBulkFetchResult() {
  function set(results: BulkResult<SyncResult>[]) {
    last.value = { ranAt: Date.now(), results }
  }

  function clear() {
    last.value = null
  }

  return { last, set, clear }
}
