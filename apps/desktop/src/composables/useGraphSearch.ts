// Sprint c31 god comp 분리 7/N — CommitGraph.vue 의 in-memory 검색 분리.
//
// 책임:
//   - searchQuery / searchOpen / searchInputRef state
//   - isMatch(row, q) — subject / authorName / sha prefix / refs 부분일치
//   - matchCount computed (rows 의존)
//   - openSearch / closeSearch (close 시 onClose callback 호출 — drawGraph redraw 위임)
//   - onKeydown — ⌘F / Ctrl+F 토글 + Esc 닫기
//
// 사용:
//   const search = useGraphSearch(rows, { onClose: drawGraph })
//   onMounted(() => window.addEventListener('keydown', search.onKeydown))
//   onUnmounted(() => window.removeEventListener('keydown', search.onKeydown))
//
// FTS5 인덱싱은 v1.0 (Cross-repo + 5000+ commits 시) — 본 composable 은 in-memory.
import { computed, nextTick, ref, type ComputedRef, type Ref } from 'vue'
import type { GraphRow } from '@/api/git'

export interface UseGraphSearchOptions {
  /** close 시 호출 (CommitGraph 의 drawGraph 재렌더 등) */
  onClose?: () => void
}

export interface UseGraphSearchReturn {
  searchQuery: Ref<string>
  searchOpen: Ref<boolean>
  searchInputRef: Ref<HTMLInputElement | null>
  matchCount: ComputedRef<number>
  isMatch: (row: GraphRow, q: string) => boolean
  openSearch: () => void
  closeSearch: () => void
  onKeydown: (e: KeyboardEvent) => void
}

export function useGraphSearch(
  rows: Ref<GraphRow[]> | ComputedRef<GraphRow[]>,
  opts: UseGraphSearchOptions = {},
): UseGraphSearchReturn {
  const searchQuery = ref('')
  const searchOpen = ref(false)
  const searchInputRef = ref<HTMLInputElement | null>(null)

  function isMatch(r: GraphRow, q: string): boolean {
    if (!q) return true
    const lower = q.toLowerCase()
    return (
      r.commit.subject.toLowerCase().includes(lower) ||
      r.commit.authorName.toLowerCase().includes(lower) ||
      r.commit.sha.startsWith(lower) ||
      r.commit.refs.some((x) => x.toLowerCase().includes(lower))
    )
  }

  const matchCount = computed(() => {
    if (!searchQuery.value) return 0
    return rows.value.filter((r) => isMatch(r, searchQuery.value)).length
  })

  function openSearch() {
    searchOpen.value = true
    void nextTick(() => searchInputRef.value?.focus())
  }

  function closeSearch() {
    searchOpen.value = false
    searchQuery.value = ''
    opts.onClose?.()
  }

  function onKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault()
      if (searchOpen.value) closeSearch()
      else openSearch()
    } else if (e.key === 'Escape' && searchOpen.value) {
      e.preventDefault()
      closeSearch()
    }
  }

  return {
    searchQuery,
    searchOpen,
    searchInputRef,
    matchCount,
    isMatch,
    openSearch,
    closeSearch,
    onKeydown,
  }
}
