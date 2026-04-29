// Commit table 컬럼 토글 / 재정렬 — `docs/plan/11 §5a` (Sprint A3).
//
// localStorage 영속화 — 단순 글로벌 선호도 (per-repo 영속화는 시나리오 약함).
//
// 컬럼:
//   - branchTag : commit refs (브랜치/태그) — Phase 13-4 (GitKraken parity)
//   - sha       : shortSha (w-16)
//   - message   : subject (refs 는 branchTag 에 있으면 message 에서 생략)
//   - author    : authorName (w-32)
//   - date      : authorAt 포맷 (w-20)
//   - signed    : GPG ✓ (w-3)
//
// branchTag 컬럼이 visible 일 때 message 컬럼은 ref pill 미표시 (중복 회피).
// 비활성화 (예전 동작) 시 message 안에 inline ref pill — backward compat.

import { computed, ref, watch } from 'vue'

export type CommitColumnId = 'branchTag' | 'sha' | 'message' | 'author' | 'date' | 'signed'

export interface CommitColumnDef {
  id: CommitColumnId
  label: string
  /** Tailwind 폭 클래스 (sha=w-16, author=w-32 등). message 는 flex-1 자동. */
  widthClass: string
}

export const ALL_COLUMNS: CommitColumnDef[] = [
  { id: 'branchTag', label: 'BRANCH/TAG', widthClass: 'w-32 shrink-0' },
  { id: 'sha', label: 'SHA', widthClass: 'w-16 shrink-0' },
  { id: 'message', label: 'Message', widthClass: 'flex-1 min-w-0' },
  { id: 'author', label: 'Author', widthClass: 'w-32 shrink-0' },
  { id: 'date', label: 'Date', widthClass: 'w-20 shrink-0' },
  { id: 'signed', label: '✓', widthClass: 'w-3 shrink-0' },
]

interface PersistedState {
  /** 화면 좌→우 순서. 이 배열 자체가 "보이는 컬럼 + 순서". */
  order: CommitColumnId[]
}

// Phase 13-4 — v2 storage key (branchTag 컬럼 신규 추가). 기존 v1 사용자는 default v2 로 migration.
const STORAGE_KEY = 'git-fried.commit-table-columns.v2'
const DEFAULT_ORDER: CommitColumnId[] = ['branchTag', 'sha', 'message', 'author', 'date', 'signed']

function safeParse(raw: string | null): PersistedState | null {
  if (!raw) return null
  try {
    const obj = JSON.parse(raw) as unknown
    if (!obj || typeof obj !== 'object') return null
    const order = (obj as { order?: unknown }).order
    if (!Array.isArray(order)) return null
    const allIds = new Set<string>(ALL_COLUMNS.map((c) => c.id))
    const filtered = order.filter(
      (x): x is CommitColumnId => typeof x === 'string' && allIds.has(x),
    )
    if (filtered.length === 0) return null
    return { order: filtered }
  } catch {
    return null
  }
}

function loadInitial(): PersistedState {
  if (typeof localStorage === 'undefined') return { order: DEFAULT_ORDER }
  return safeParse(localStorage.getItem(STORAGE_KEY)) ?? { order: DEFAULT_ORDER }
}

const state = ref<PersistedState>(loadInitial())

// state 변경 시 localStorage 동기화 (debounce 없음 — 작아서 OK)
watch(
  state,
  (s) => {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    } catch {
      /* QuotaExceeded 등 무시 */
    }
  },
  { deep: true },
)

export function useCommitColumns() {
  const visibleIds = computed(() => state.value.order)

  const visibleColumns = computed<CommitColumnDef[]>(() => {
    const map = new Map<CommitColumnId, CommitColumnDef>()
    for (const c of ALL_COLUMNS) map.set(c.id, c)
    return state.value.order.map((id) => map.get(id)).filter((c): c is CommitColumnDef => c != null)
  })

  const isVisible = (id: CommitColumnId) => state.value.order.includes(id)

  function toggle(id: CommitColumnId) {
    const cur = state.value.order
    if (cur.includes(id)) {
      // 모두 끄지 못하게 — 최소 1개 유지 (message 가 항상 있어야 안전).
      if (cur.length === 1) return
      state.value = { order: cur.filter((x) => x !== id) }
    } else {
      // 원래 순서 (DEFAULT_ORDER) 위치에 삽입.
      const defaultIdx = DEFAULT_ORDER.indexOf(id)
      const newOrder: CommitColumnId[] = []
      let inserted = false
      for (const x of cur) {
        if (!inserted && DEFAULT_ORDER.indexOf(x) > defaultIdx) {
          newOrder.push(id)
          inserted = true
        }
        newOrder.push(x)
      }
      if (!inserted) newOrder.push(id)
      state.value = { order: newOrder }
    }
  }

  function setOrder(order: CommitColumnId[]) {
    // valid id 만, 중복 제거.
    const seen = new Set<CommitColumnId>()
    const allIds = new Set(ALL_COLUMNS.map((c) => c.id))
    const filtered: CommitColumnId[] = []
    for (const id of order) {
      if (allIds.has(id) && !seen.has(id)) {
        seen.add(id)
        filtered.push(id)
      }
    }
    if (filtered.length > 0) state.value = { order: filtered }
  }

  function reset() {
    state.value = { order: DEFAULT_ORDER }
  }

  return {
    visibleIds,
    visibleColumns,
    isVisible,
    toggle,
    setOrder,
    reset,
    allColumns: ALL_COLUMNS,
  }
}
