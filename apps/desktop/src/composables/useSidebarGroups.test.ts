import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { parentDirName, useSidebarGroups } from './useSidebarGroups'
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

describe('parentDirName', () => {
  it('windows backslash path', () => {
    expect(parentDirName('C:\\work\\opnd\\frontend')).toBe('opnd')
  })
  it('unix forward slash', () => {
    expect(parentDirName('/home/tgkim/work/opnd/frontend')).toBe('opnd')
  })
  it('trailing slash 제거', () => {
    expect(parentDirName('/a/b/c/')).toBe('b')
  })
  it('single segment → null', () => {
    expect(parentDirName('foo')).toBe(null)
  })
})

describe('useSidebarGroups', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear()
  })
  afterEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear()
  })

  it('default mode is directory', () => {
    const repos = ref<Repo[]>([])
    const { groupMode } = useSidebarGroups(repos)
    expect(groupMode.value).toBe('directory')
  })

  it('setGroupMode persists to localStorage', () => {
    const repos = ref<Repo[]>([])
    const { setGroupMode, groupMode } = useSidebarGroups(repos)
    setGroupMode('org')
    expect(groupMode.value).toBe('org')
    expect(localStorage.getItem('git-fried.sidebar-group-mode')).toBe('org')
  })

  it('directory mode groups by parent dir (듀얼 레포)', () => {
    const repos = ref<Repo[]>([
      mkRepo({ id: 1, name: 'frontend', localPath: 'C:/work/opnd/frontend' }),
      mkRepo({ id: 2, name: 'frontend-admin', localPath: 'C:/work/opnd/frontend-admin' }),
      mkRepo({ id: 3, name: 'solo', localPath: 'C:/personal/solo' }),
    ])
    const { groups } = useSidebarGroups(repos)
    const opnd = groups.value.find((g) => g.label === 'opnd')
    expect(opnd?.repos.length).toBe(2)
    const solo = groups.value.find((g) => g.repos.some((r) => r.name === 'solo'))
    expect(solo?.label).toBe(null) // single → no label
  })

  it('org mode groups by forgeOwner', () => {
    const repos = ref<Repo[]>([
      mkRepo({ id: 1, forgeOwner: 'opnd' }),
      mkRepo({ id: 2, forgeOwner: 'opnd', name: 'second', localPath: 'D:/x/y/second' }),
      mkRepo({ id: 3, forgeOwner: 'tgkim', name: 'personal', localPath: 'D:/x/z/personal' }),
    ])
    const { groups, setGroupMode } = useSidebarGroups(repos)
    setGroupMode('org')
    const opnd = groups.value.find((g) => g.label === 'opnd')
    expect(opnd?.repos.length).toBe(2)
  })

  it('empty repos yields empty groups', () => {
    const repos = ref<Repo[]>([])
    const { groups } = useSidebarGroups(repos)
    expect(groups.value.length).toBe(0)
  })

  it('groups are sorted — labeled first, then alphabetical', () => {
    const repos = ref<Repo[]>([
      mkRepo({ id: 1, localPath: 'C:/zoo/zelda/foo' }),
      mkRepo({ id: 2, localPath: 'C:/zoo/zelda/bar' }),
      mkRepo({ id: 3, localPath: 'C:/zoo/aurora/single' }),
    ])
    const { groups } = useSidebarGroups(repos)
    expect(groups.value[0].label).toBe('zelda')
    expect(groups.value[1].label).toBe(null)
  })

  // Phase 10-4 — forge 모드 (Gitea / GitHub / Local-only).
  it('forge mode groups by forgeKind with fixed order', () => {
    const repos = ref<Repo[]>([
      mkRepo({ id: 1, forgeKind: 'github', defaultRemote: 'origin' }),
      mkRepo({ id: 2, forgeKind: 'gitea', defaultRemote: 'origin' }),
      mkRepo({ id: 3, forgeKind: 'unknown', defaultRemote: null }), // local-only
      mkRepo({ id: 4, forgeKind: 'gitea', defaultRemote: 'origin' }),
    ])
    const { groups, setGroupMode } = useSidebarGroups(repos)
    setGroupMode('forge')
    expect(groups.value.length).toBe(3)
    expect(groups.value[0].key).toBe('Gitea')
    expect(groups.value[0].repos.length).toBe(2)
    expect(groups.value[1].key).toBe('GitHub')
    expect(groups.value[1].repos.length).toBe(1)
    expect(groups.value[2].key).toBe('Local-only')
    expect(groups.value[2].repos.length).toBe(1)
  })

  it('forge mode: unknown forgeKind with defaultRemote = "Remote (other)"', () => {
    const repos = ref<Repo[]>([
      mkRepo({ id: 1, forgeKind: 'unknown', defaultRemote: 'origin' }), // remote but not gitea/github
      mkRepo({ id: 2, forgeKind: 'unknown', defaultRemote: null }), // local-only
    ])
    const { groups, setGroupMode } = useSidebarGroups(repos)
    setGroupMode('forge')
    expect(groups.value.find((g) => g.key === 'Remote (other)')?.repos.length).toBe(1)
    expect(groups.value.find((g) => g.key === 'Local-only')?.repos.length).toBe(1)
  })

  it('forge mode shows label even for solo repos', () => {
    const repos = ref<Repo[]>([mkRepo({ id: 1, forgeKind: 'gitea' })])
    const { groups, setGroupMode } = useSidebarGroups(repos)
    setGroupMode('forge')
    expect(groups.value[0].label).toBe('Gitea') // 1개라도 명시
  })

  it('forge mode persists across reload', () => {
    const repos = ref<Repo[]>([])
    const first = useSidebarGroups(repos)
    first.setGroupMode('forge')
    const reloaded = useSidebarGroups(repos)
    expect(reloaded.groupMode.value).toBe('forge')
  })
})
