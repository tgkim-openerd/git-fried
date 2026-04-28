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
})
