// Sprint c80-4 — RepoSwitcherModal 175 → <100 LOC 추출.
//
// fuzzy filter + 정렬 + 그룹화 + flat row 시퀀스 + selection guard + pickRepo/pickGroup/pickRow
// 통합. caller-decision: filter/selected ref 는 caller (modal) 보유, 본 composable 은
// pure derived (computed) + side-effect handler 만.
import { computed, type Ref, watch } from 'vue'
import { useReposStore } from '@/stores/repos'
import { useRepoAliases } from '@/composables/useRepoAliases'
import { useSidebarGroups, type RepoGroup } from '@/composables/useSidebarGroups'
import { useNavigateHome } from '@/composables/useNavigateHome'
import type { Repo } from '@/types/git'

export type FlatRow =
  | { kind: 'group'; key: string; group: RepoGroup }
  | { kind: 'repo'; key: string; group: RepoGroup; repo: Repo }

interface UseRepoSwitcherListOpts {
  filter: Ref<string>
  selected: Ref<number>
  /** repos 전체 (useQuery data) — null 시 [] */
  repos: Readonly<Ref<readonly Repo[] | undefined>>
  /** caller close handler (pick 직후 호출) */
  onClose: () => void
}

export function useRepoSwitcherList(opts: UseRepoSwitcherListOpts) {
  const store = useReposStore()
  const aliases = useRepoAliases()
  const goHome = useNavigateHome()

  function aliasOrName(r: Repo): string {
    return aliases.resolveLocal(r.id, r.name).display
  }

  // 1단계: filter 매칭 + 정렬 (pinned 우선, prefix-match, 알파벳).
  const filteredRepos = computed<Repo[]>(() => {
    const q = opts.filter.value.trim().toLowerCase()
    const list = opts.repos.value ?? []
    if (!q) {
      return [...list].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
        return aliasOrName(a).localeCompare(aliasOrName(b))
      })
    }
    return list
      .filter((r) => {
        const display = aliasOrName(r).toLowerCase()
        return (
          display.includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.localPath.toLowerCase().includes(q) ||
          (r.forgeOwner ?? '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
        const aStart = aliasOrName(a).toLowerCase().startsWith(q)
        const bStart = aliasOrName(b).toLowerCase().startsWith(q)
        if (aStart !== bStart) return aStart ? -1 : 1
        return aliasOrName(a).localeCompare(aliasOrName(b))
      })
  })

  // 2단계: 그룹화 (Repository Management 와 동일한 useSidebarGroups — localStorage 공유).
  const { groups } = useSidebarGroups(filteredRepos)

  // 3단계: 평면 row 시퀀스 — keyboard 네비게이션과 v-for 양쪽에서 사용.
  const rows = computed<FlatRow[]>(() => {
    const out: FlatRow[] = []
    for (const g of groups.value) {
      // isSolo (label=null) 그룹은 헤더 안 그림 — 평면처럼.
      if (g.label) out.push({ kind: 'group', key: `g:${g.key}`, group: g })
      for (const r of g.repos) out.push({ kind: 'repo', key: `r:${r.id}`, group: g, repo: r })
    }
    return out
  })

  function firstRepoIdx(): number {
    const idx = rows.value.findIndex((r) => r.kind === 'repo')
    return idx >= 0 ? idx : 0
  }

  // rows 변경 시 selection guard (out-of-range 또는 group header 면 첫 repo 로 복귀).
  watch(rows, () => {
    const r = rows.value[opts.selected.value]
    if (!r || r.kind === 'group') opts.selected.value = firstRepoIdx()
  })

  function pickRepo(r: Repo) {
    if (r.workspaceId !== store.activeWorkspaceId) {
      store.setActiveWorkspace(r.workspaceId ?? null)
    }
    store.setActiveRepo(r.id)
    goHome()
    opts.onClose()
  }

  // c50 Pattern 9 caller-decision — caller 가 정렬한 list 를 store.openRepoGroup 에 위임.
  function pickGroup(g: RepoGroup) {
    const sorted = [...g.repos].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      return aliasOrName(a).localeCompare(aliasOrName(b))
    })
    const first = store.openRepoGroup(sorted)
    if (!first) return
    if (first.workspaceId !== store.activeWorkspaceId) {
      store.setActiveWorkspace(first.workspaceId ?? null)
    }
    goHome()
    opts.onClose()
  }

  function pickRow(row: FlatRow) {
    if (row.kind === 'repo') pickRepo(row.repo)
    else pickGroup(row.group)
  }

  return { rows, groups, firstRepoIdx, pickRepo, pickGroup, pickRow, aliasOrName }
}
