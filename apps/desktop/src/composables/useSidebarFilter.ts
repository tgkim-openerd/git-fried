// Sidebar 레포 필터 (Sprint I — `⌘⌥F`).
//
// 50+ 회사 레포 환경에서 substring 검색 — name / alias / forgeOwner / forgeRepo / localPath 5개
// 필드 case-insensitive match. trim() 후 빈 입력은 모두 통과.
//
// Sidebar.vue 의 885 LOC God component 분리 1차 (useStatusFilter 와 동일 패턴).
// alias resolver 는 함수 inject — useRepoAliases 와의 결합도 분리.

import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { Repo } from '@/types/git'

export type AliasResolver = (repoId: number, fallback: string) => { display: string }

export interface UseSidebarFilterReturn {
  repoFilter: Ref<string>
  filteredRepos: ComputedRef<readonly Repo[]>
  hasAnyMatch: ComputedRef<boolean>
}

export function useSidebarFilter(
  repos: Ref<readonly Repo[] | null | undefined>,
  resolveAlias: AliasResolver,
): UseSidebarFilterReturn {
  const repoFilter = ref('')

  const filteredRepos = computed<readonly Repo[]>(() => {
    if (!repos.value) return []
    const q = repoFilter.value.trim().toLowerCase()
    if (!q) return repos.value
    return repos.value.filter((r) => {
      if (r.name.toLowerCase().includes(q)) return true
      const alias = resolveAlias(r.id, r.name).display
      if (alias.toLowerCase().includes(q)) return true
      if (r.forgeOwner?.toLowerCase().includes(q)) return true
      if (r.forgeRepo?.toLowerCase().includes(q)) return true
      if (r.localPath.toLowerCase().includes(q)) return true
      return false
    })
  })

  const hasAnyMatch = computed(() => filteredRepos.value.length > 0)

  return { repoFilter, filteredRepos, hasAnyMatch }
}
