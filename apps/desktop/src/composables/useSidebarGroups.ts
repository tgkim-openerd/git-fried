// Sidebar 레포 그룹핑 (Sprint B9 — `docs/plan/11 §22`).
//
// 두 가지 모드:
//   - directory: 부모 디렉토리 이름 (예: peeloff/frontend + peeloff/frontend-admin)
//   - org: forge_owner (예: opnd-frontend/x + opnd-frontend/y → "opnd-frontend")
//
// 50+ 회사 레포 환경에서 organization / 디렉토리 별 일괄 표시.
// localStorage 영속.
//
// Sidebar.vue 의 885 LOC God component 분리 2차 (useSidebarFilter 후속).

import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { Repo } from '@/types/git'

export type GroupMode = 'directory' | 'org'

export interface RepoGroup {
  key: string
  label: string | null
  repos: Repo[]
}

const GROUP_KEY = 'git-fried.sidebar-group-mode'

function loadGroupMode(): GroupMode {
  if (typeof localStorage === 'undefined') return 'directory'
  const v = localStorage.getItem(GROUP_KEY)
  return v === 'org' ? 'org' : 'directory'
}

function persistGroupMode(m: GroupMode): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(GROUP_KEY, m)
  } catch {
    /* ignore quota / private mode */
  }
}

/** 윈도/유닉스 양식 모두 처리 — 부모 디렉토리 이름 추출. */
export function parentDirName(p: string): string | null {
  const norm = p.replace(/\\/g, '/').replace(/\/+$/, '')
  const parts = norm.split('/')
  return parts.length >= 2 ? parts[parts.length - 2] : null
}

export interface UseSidebarGroupsReturn {
  groupMode: Ref<GroupMode>
  setGroupMode: (m: GroupMode) => void
  groups: ComputedRef<readonly RepoGroup[]>
}

export function useSidebarGroups(
  repos: Ref<readonly Repo[] | null | undefined>,
): UseSidebarGroupsReturn {
  const groupMode = ref<GroupMode>(loadGroupMode())

  function setGroupMode(m: GroupMode): void {
    groupMode.value = m
    persistGroupMode(m)
  }

  function groupKey(r: Repo): string {
    if (groupMode.value === 'org') return r.forgeOwner ?? '__no-org__'
    return parentDirName(r.localPath) ?? '__solo__'
  }

  const groups = computed<readonly RepoGroup[]>(() => {
    const list = repos.value
    if (!list || list.length === 0) return []
    const map = new Map<string, Repo[]>()
    for (const r of list) {
      const k = groupKey(r)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(r)
    }
    const result: RepoGroup[] = []
    for (const [key, repoList] of map.entries()) {
      const isSolo = key === '__solo__' || key === '__no-org__' || repoList.length === 1
      result.push({
        key,
        label: isSolo ? null : key,
        repos: repoList,
      })
    }
    result.sort((a, b) => {
      if (a.label && !b.label) return -1
      if (!a.label && b.label) return 1
      return (a.label || a.repos[0].name).localeCompare(b.label || b.repos[0].name)
    })
    return result
  })

  return { groupMode, setGroupMode, groups }
}
