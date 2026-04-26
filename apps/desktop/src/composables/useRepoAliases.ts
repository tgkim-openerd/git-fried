// Repo alias resolver (Sprint B4 / `docs/plan/11 §15`).
//
// Sidebar / RepoSwitcherModal 가 한 번 fetch 후 N+1 회피해서 inline 매칭.
// 활성 profile 의 alias 우선, 없으면 global default, 없으면 repo.name.

import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  listAllRepoAliases,
  setRepoAlias as apiSetAlias,
  unsetRepoAlias as apiUnsetAlias,
  type RepoAlias,
} from '@/api/git'
import { useProfiles } from '@/composables/useProfiles'

const KEY = ['repo-aliases-all'] as const

export function useRepoAliases() {
  const qc = useQueryClient()
  const { active: activeProfile } = useProfiles()
  const activeProfileId = computed(() => activeProfile.value?.id ?? null)

  const listQuery = useQuery({
    queryKey: KEY,
    queryFn: listAllRepoAliases,
    staleTime: 60_000,
  })

  // Map<repoId, { profileId|null → alias }>
  const byRepo = computed(() => {
    const map = new Map<number, Map<number | null, string>>()
    for (const a of listQuery.data.value ?? []) {
      let inner = map.get(a.repoId)
      if (!inner) {
        inner = new Map()
        map.set(a.repoId, inner)
      }
      inner.set(a.profileId, a.alias)
    }
    return map
  })

  function resolveLocal(
    repoId: number,
    repoName: string,
  ): { display: string; aliased: boolean } {
    const inner = byRepo.value.get(repoId)
    if (inner) {
      const pid = activeProfileId.value
      const perProfile = pid != null ? inner.get(pid) : undefined
      if (perProfile) return { display: perProfile, aliased: true }
      const global = inner.get(null)
      if (global) return { display: global, aliased: true }
    }
    return { display: repoName, aliased: false }
  }

  function activeAliasFor(repoId: number): string | null {
    const inner = byRepo.value.get(repoId)
    if (!inner) return null
    const pid = activeProfileId.value
    if (pid != null && inner.has(pid)) return inner.get(pid) ?? null
    return inner.get(null) ?? null
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: KEY })
  }

  const setMut = useMutation({
    mutationFn: (args: {
      repoId: number
      profileId: number | null
      alias: string
    }) => apiSetAlias(args.repoId, args.profileId, args.alias),
    onSuccess: () => invalidate(),
  })

  const unsetMut = useMutation({
    mutationFn: (args: { repoId: number; profileId: number | null }) =>
      apiUnsetAlias(args.repoId, args.profileId),
    onSuccess: () => invalidate(),
  })

  return {
    listQuery,
    byRepo,
    resolveLocal,
    activeAliasFor,
    activeProfileId,
    setMut,
    unsetMut,
  }
}

export type { RepoAlias }
