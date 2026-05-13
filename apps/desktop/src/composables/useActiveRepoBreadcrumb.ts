// v0.4 #5 (UltraPlan plan/31) god comp wave A — GitKrakenToolbar breadcrumb 분리.
//
// 활성 레포 breadcrumb (alias 우선 → forge owner / 레포명) 계산.
// store 가 repos 캐시를 보유하지 않으므로 listRepos query 를 직접 사용
// (Sidebar 와 동일 캐시 공유).
//
// 사용:
//   const repoBreadcrumb = useActiveRepoBreadcrumb(() => props.repoId)
//   if (repoBreadcrumb.value) { ... }

import { computed, type ComputedRef, type MaybeRefOrGetter, toRef } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { listRepos } from '@/api/git'
import { useReposStore } from '@/stores/repos'
import { useRepoAliases } from '@/composables/useRepoAliases'

export interface RepoBreadcrumbInfo {
  owner: string | null
  name: string
  original: string
  aliased: boolean
}

export function useActiveRepoBreadcrumb(
  repoId: MaybeRefOrGetter<number | null>,
): ComputedRef<RepoBreadcrumbInfo | null> {
  const store = useReposStore()
  const aliases = useRepoAliases()
  const repoIdRef = toRef(repoId)

  const { data: reposData } = useQuery({
    queryKey: computed(() => ['repos', store.activeWorkspaceId]),
    queryFn: () => listRepos(store.activeWorkspaceId),
  })

  const activeRepo = computed(() => {
    const id = repoIdRef.value
    if (id == null) return null
    return reposData.value?.find((r) => r.id === id) ?? null
  })

  return computed(() => {
    const r = activeRepo.value
    if (!r) return null
    const resolved = aliases.resolveLocal(r.id, r.name)
    return {
      owner: r.forgeOwner,
      name: resolved.display,
      original: r.name,
      aliased: resolved.aliased,
    }
  })
}
