// Phase 12-2 — Sidebar 전역 검색 query (singleton).
//
// MiniBranchList / MiniRemoteBranchList / MiniTagList / 등 모든 카테고리가
// 같은 query 를 구독해 동시에 filter. Sidebar.vue 의 input 이 query 갱신.
//
// useToast 동일 패턴 — module-scope ref 싱글톤.

import { ref, computed, type Ref, type ComputedRef } from 'vue'

const _query = ref('')

interface SidebarSearch {
  query: Ref<string>
  trimmed: ComputedRef<string>
  isActive: ComputedRef<boolean>
  clear: () => void
}

const trimmed = computed(() => _query.value.trim())
const isActive = computed(() => trimmed.value.length > 0)

export function useSidebarSearch(): SidebarSearch {
  return {
    query: _query,
    trimmed,
    isActive,
    clear: () => {
      _query.value = ''
    },
  }
}
