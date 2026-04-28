import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useSidebarFilter } from './useSidebarFilter'
import type { Repo } from '@/types/git'

function mkRepo(over: Partial<Repo> = {}): Repo {
  return {
    id: 1,
    workspaceId: 1,
    name: 'frontend',
    localPath: 'C:/work/opnd/frontend',
    defaultRemote: 'origin',
    defaultBranch: 'main',
    forgeKind: 'gitea',
    forgeOwner: 'opnd',
    forgeRepo: 'frontend',
    lastFetchedAt: 0,
    isPinned: false,
    ...over,
  }
}

const noopAlias = (_id: number, fallback: string) => ({ display: fallback })

describe('useSidebarFilter', () => {
  it('empty filter returns all repos', () => {
    const repos = ref<Repo[]>([mkRepo({ id: 1 }), mkRepo({ id: 2, name: 'backend' })])
    const f = useSidebarFilter(repos, noopAlias)
    expect(f.filteredRepos.value.length).toBe(2)
    expect(f.hasAnyMatch.value).toBe(true)
  })

  it('null repos yields empty + hasAnyMatch=false', () => {
    const repos = ref<Repo[] | null>(null)
    const f = useSidebarFilter(repos, noopAlias)
    expect(f.filteredRepos.value.length).toBe(0)
    expect(f.hasAnyMatch.value).toBe(false)
  })

  it('matches by name (case-insensitive)', () => {
    const repos = ref<Repo[]>([
      mkRepo({ id: 1, name: 'Frontend', forgeRepo: 'a', localPath: 'C:/x/a' }),
      mkRepo({ id: 2, name: 'backend', forgeRepo: 'b', localPath: 'C:/x/b' }),
    ])
    const f = useSidebarFilter(repos, noopAlias)
    f.repoFilter.value = 'front'
    expect(f.filteredRepos.value.map((r) => r.id)).toEqual([1])
  })

  it('matches by alias (resolver)', () => {
    const repos = ref<Repo[]>([mkRepo({ id: 1, name: 'frontend' })])
    const aliasResolver = (id: number, _fallback: string) =>
      id === 1 ? { display: '회사프론트' } : { display: 'unknown' }
    const f = useSidebarFilter(repos, aliasResolver)
    f.repoFilter.value = '회사'
    expect(f.filteredRepos.value.length).toBe(1)
  })

  it('matches by forgeOwner / forgeRepo / localPath', () => {
    const repos = ref<Repo[]>([
      mkRepo({ id: 1, forgeOwner: 'opnd', forgeRepo: 'a', localPath: 'C:/work/opnd/a' }),
      mkRepo({ id: 2, forgeOwner: 'github', forgeRepo: 'b', localPath: 'D:/oss/b' }),
    ])
    const f = useSidebarFilter(repos, noopAlias)
    f.repoFilter.value = 'opnd'
    expect(f.filteredRepos.value.map((r) => r.id)).toEqual([1])
    f.repoFilter.value = 'oss'
    expect(f.filteredRepos.value.map((r) => r.id)).toEqual([2])
  })

  it('whitespace-only filter is treated as empty', () => {
    const repos = ref<Repo[]>([mkRepo()])
    const f = useSidebarFilter(repos, noopAlias)
    f.repoFilter.value = '   '
    expect(f.filteredRepos.value.length).toBe(1)
  })

  it('no match yields empty + hasAnyMatch=false', () => {
    const repos = ref<Repo[]>([mkRepo()])
    const f = useSidebarFilter(repos, noopAlias)
    f.repoFilter.value = 'no-match-anywhere'
    expect(f.filteredRepos.value.length).toBe(0)
    expect(f.hasAnyMatch.value).toBe(false)
  })
})
