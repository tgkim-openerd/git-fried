// 레포 / 워크스페이스 글로벌 상태.
// 서버 데이터(Vue Query) 와 별개로 "현재 활성 레포 id" + "열린 탭 list" 같은
// 클라이언트 상태만 보관.
//
// Sprint G — multi-repo tab UI:
//   - tabs: 열린 레포 id 배열 (순서 = TabBar 표시 순)
//   - activeRepoId: 현재 활성 탭 (tabs 의 한 멤버)
//   - localStorage 'git-fried.repo-tabs.v1' = { tabs, active }
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const TABS_KEY = 'git-fried.repo-tabs.v1'

interface PersistedTabs {
  tabs: number[]
  active: number | null
}

function loadPersisted(): PersistedTabs {
  if (typeof localStorage === 'undefined') return { tabs: [], active: null }
  try {
    const raw = localStorage.getItem(TABS_KEY)
    if (!raw) return { tabs: [], active: null }
    const obj = JSON.parse(raw) as Partial<PersistedTabs>
    const tabs = Array.isArray(obj.tabs)
      ? obj.tabs.filter((x): x is number => typeof x === 'number')
      : []
    const active =
      typeof obj.active === 'number' && tabs.includes(obj.active)
        ? obj.active
        : tabs[0] ?? null
    return { tabs, active }
  } catch {
    return { tabs: [], active: null }
  }
}

export const useReposStore = defineStore('repos', () => {
  const initial = loadPersisted()

  const activeRepoId = ref<number | null>(initial.active)
  const activeWorkspaceId = ref<number | null>(null)
  const tabs = ref<number[]>(initial.tabs)

  function persist() {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(
        TABS_KEY,
        JSON.stringify({ tabs: tabs.value, active: activeRepoId.value }),
      )
    } catch {
      /* ignore */
    }
  }

  watch(tabs, persist, { deep: true })
  watch(activeRepoId, persist)

  function setActiveRepo(id: number | null) {
    activeRepoId.value = id
    if (id != null && !tabs.value.includes(id)) {
      tabs.value = [...tabs.value, id]
    }
  }

  function setActiveWorkspace(id: number | null) {
    activeWorkspaceId.value = id
    // 워크스페이스 전환 시 레포 선택 + 탭 모두 초기화 (다른 컨텍스트로 진입).
    activeRepoId.value = null
    tabs.value = []
  }

  function openTab(id: number) {
    if (!tabs.value.includes(id)) {
      tabs.value = [...tabs.value, id]
    }
    activeRepoId.value = id
  }

  function closeTab(id: number) {
    const idx = tabs.value.indexOf(id)
    if (idx === -1) return
    const next = [...tabs.value]
    next.splice(idx, 1)
    tabs.value = next
    if (activeRepoId.value === id) {
      // 닫은 탭 다음 탭, 없으면 이전, 그래도 없으면 null.
      activeRepoId.value = next[idx] ?? next[idx - 1] ?? null
    }
  }

  function closeOthers(keepId: number) {
    if (!tabs.value.includes(keepId)) return
    tabs.value = [keepId]
    activeRepoId.value = keepId
  }

  function closeAll() {
    tabs.value = []
    activeRepoId.value = null
  }

  function reorderTabs(next: number[]) {
    // 동일 멤버 검증 — 외부에서 잘못 호출 시 무시.
    if (next.length !== tabs.value.length) return
    const setA = new Set(tabs.value)
    const setB = new Set(next)
    if (setA.size !== setB.size) return
    for (const x of setA) if (!setB.has(x)) return
    tabs.value = next
  }

  function nextTab() {
    if (tabs.value.length < 2 || activeRepoId.value == null) return
    const idx = tabs.value.indexOf(activeRepoId.value)
    if (idx === -1) return
    activeRepoId.value = tabs.value[(idx + 1) % tabs.value.length]
  }

  function prevTab() {
    if (tabs.value.length < 2 || activeRepoId.value == null) return
    const idx = tabs.value.indexOf(activeRepoId.value)
    if (idx === -1) return
    activeRepoId.value =
      tabs.value[(idx - 1 + tabs.value.length) % tabs.value.length]
  }

  return {
    activeRepoId,
    activeWorkspaceId,
    tabs,
    setActiveRepo,
    setActiveWorkspace,
    openTab,
    closeTab,
    closeOthers,
    closeAll,
    reorderTabs,
    nextTab,
    prevTab,
  }
})
