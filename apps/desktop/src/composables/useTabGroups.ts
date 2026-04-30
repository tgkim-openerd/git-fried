// Sprint c33 god comp 분리 11/N — RepoTabBar.vue 의 프로젝트 그룹화 로직 추출.
//
// Phase 11-7 — 그룹 키 = parentDirName(localPath). 없으면 '__solo:{id}' (단독 레포).
// 활성 프로젝트 = 활성 레포의 프로젝트 (없으면 첫 그룹).
//
// VueDraggable 모델 호환 — activeGroupTabs computed 는 set 시 store.tabs 의
// 활성 그룹 부분만 새 순서로 교체 (다른 그룹 탭 순서 보존).
import { computed, type ComputedRef, type WritableComputedRef } from 'vue'
import { useReposStore } from '@/stores/repos'
import { useRepoAliases } from '@/composables/useRepoAliases'
import { parentDirName } from '@/composables/useSidebarGroups'
import type { Repo } from '@/types/git'

export interface ProjectGroup {
  /** parentDir name 또는 `__solo:${id}` */
  key: string
  /** 표시명 ('__solo__' 의 경우 레포 이름 사용). */
  label: string
  /** 그룹 내 열린 탭 id 들 (store.tabs 순서 보존). */
  tabIds: number[]
  /** 단독 그룹 (label 미표시 후보). */
  isSolo: boolean
}

export interface UseTabGroupsResult {
  projectGroups: ComputedRef<readonly ProjectGroup[]>
  activeGroup: ComputedRef<ProjectGroup | null>
  activeGroupTabs: WritableComputedRef<number[]>
  activateProject: (g: ProjectGroup) => void
}

export function useTabGroups(repoMap: ComputedRef<Map<number, Repo>>): UseTabGroupsResult {
  const store = useReposStore()
  const aliases = useRepoAliases()

  const projectGroups = computed<readonly ProjectGroup[]>(() => {
    const map = new Map<string, ProjectGroup>()
    for (const id of store.tabs) {
      const r = repoMap.value.get(id)
      if (!r) continue
      const dir = parentDirName(r.localPath)
      // 부모 디렉토리 그룹 우선, 없으면 단독 그룹 (key=`solo:${id}`).
      const key = dir ?? `__solo:${id}`
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: dir ?? aliases.resolveLocal(id, r.name).display,
          tabIds: [],
          isSolo: !dir,
        })
      }
      map.get(key)!.tabIds.push(id)
    }
    // 1개짜리 디렉토리 그룹은 solo 로 격하 (label 부담 해소).
    for (const g of map.values()) {
      if (g.tabIds.length === 1 && !g.isSolo) {
        const onlyId = g.tabIds[0]
        const r = repoMap.value.get(onlyId)
        if (r) {
          g.isSolo = true
          g.label = aliases.resolveLocal(onlyId, r.name).display
        }
      }
    }
    return Array.from(map.values())
  })

  const activeGroup = computed<ProjectGroup | null>(() => {
    const groups = projectGroups.value
    if (groups.length === 0) return null
    if (store.activeRepoId == null) return groups[0]
    return groups.find((g) => g.tabIds.includes(store.activeRepoId!)) ?? groups[0]
  })

  // VueDraggable 모델 — 활성 프로젝트의 탭들만 reorder.
  // set 시 store.tabs 의 활성 그룹 부분만 새 순서로 교체.
  const activeGroupTabs = computed<number[]>({
    get: () => activeGroup.value?.tabIds ?? [],
    set: (v) => {
      const g = activeGroup.value
      if (!g) return
      // store.tabs 에서 g.tabIds 위치들을 v 순서로 swap.
      const oldOrder = store.tabs
      const groupSet = new Set(g.tabIds)
      const next: number[] = []
      let vIdx = 0
      for (const id of oldOrder) {
        if (groupSet.has(id)) {
          next.push(v[vIdx++])
        } else {
          next.push(id)
        }
      }
      store.reorderTabs(next)
    },
  })

  function activateProject(g: ProjectGroup): void {
    // 그룹 내 활성 레포 있으면 유지, 없으면 첫 레포 활성.
    if (store.activeRepoId != null && g.tabIds.includes(store.activeRepoId)) return
    if (g.tabIds.length > 0) store.setActiveRepo(g.tabIds[0])
  }

  return {
    projectGroups,
    activeGroup,
    activeGroupTabs,
    activateProject,
  }
}
