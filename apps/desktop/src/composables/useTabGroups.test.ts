// Sprint c33 — useTabGroups 단위 테스트.
//
// store + aliases 모킹 후 projectGroups 의 그룹화 로직 검증.
// activeGroup / activeGroupTabs set 동작은 통합 test (별도 SCNARIO).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import type { Repo } from '@/types/git'

// store / aliases / parentDirName 모킹 — useTabGroups 호출 전 vi.mock 등록 필요.
const mockTabs = ref<number[]>([])
const mockActiveRepoId = ref<number | null>(null)
const mockReorder = vi.fn()
const mockSetActive = vi.fn()

vi.mock('@/stores/repos', () => ({
  useReposStore: () => ({
    get tabs() {
      return mockTabs.value
    },
    get activeRepoId() {
      return mockActiveRepoId.value
    },
    reorderTabs: mockReorder,
    setActiveRepo: mockSetActive,
  }),
}))

vi.mock('@/composables/useRepoAliases', () => ({
  useRepoAliases: () => ({
    resolveLocal: (_id: number, name: string) => ({ display: `alias:${name}`, source: 'name' }),
  }),
}))

vi.mock('@/composables/useSidebarGroups', () => ({
  parentDirName: (path: string) => {
    // 간단한 매처: '/projects/foo/repo1' → 'foo'
    const m = path.match(/\/projects\/([^/]+)\//)
    return m ? m[1] : null
  },
}))

import { useTabGroups } from './useTabGroups'

function repo(id: number, name: string, localPath: string): Repo {
  return {
    id,
    name,
    localPath,
    forgeKind: 'unknown',
    forgeOwner: null,
    forgeRepo: null,
    defaultBranch: 'main',
    addedAt: 0,
  } as unknown as Repo
}

beforeEach(() => {
  mockTabs.value = []
  mockActiveRepoId.value = null
  mockReorder.mockReset()
  mockSetActive.mockReset()
})

describe('useTabGroups — projectGroups', () => {
  it('빈 tabs → 빈 그룹', () => {
    const repoMap = computed(() => new Map<number, Repo>())
    const { projectGroups } = useTabGroups(repoMap)
    expect(projectGroups.value).toEqual([])
  })

  it('단일 부모 디렉토리 → 그룹 1개 (1개짜리는 solo 격하)', () => {
    const m = new Map([[1, repo(1, 'repo1', '/projects/foo/repo1')]])
    const repoMap = computed(() => m)
    mockTabs.value = [1]
    const { projectGroups } = useTabGroups(repoMap)
    const groups = projectGroups.value
    expect(groups).toHaveLength(1)
    expect(groups[0].isSolo).toBe(true) // 1개라 solo 격하
    expect(groups[0].label).toBe('alias:repo1') // resolveLocal 사용
    expect(groups[0].tabIds).toEqual([1])
  })

  it('같은 부모 디렉토리 2개 이상 → 그룹 유지 (isSolo=false)', () => {
    const m = new Map([
      [1, repo(1, 'repo1', '/projects/foo/repo1')],
      [2, repo(2, 'repo2', '/projects/foo/repo2')],
    ])
    const repoMap = computed(() => m)
    mockTabs.value = [1, 2]
    const { projectGroups } = useTabGroups(repoMap)
    const groups = projectGroups.value
    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe('foo')
    expect(groups[0].label).toBe('foo')
    expect(groups[0].isSolo).toBe(false)
    expect(groups[0].tabIds).toEqual([1, 2])
  })

  it('부모 그룹 + solo 혼합', () => {
    const m = new Map([
      [1, repo(1, 'repo1', '/projects/foo/repo1')],
      [2, repo(2, 'repo2', '/projects/foo/repo2')],
      [3, repo(3, 'standalone', '/elsewhere/repo3')],
    ])
    const repoMap = computed(() => m)
    mockTabs.value = [1, 2, 3]
    const { projectGroups } = useTabGroups(repoMap)
    const groups = projectGroups.value
    expect(groups).toHaveLength(2)
    expect(groups[0].key).toBe('foo')
    expect(groups[1].isSolo).toBe(true)
    expect(groups[1].key).toBe('__solo:3')
  })
})

describe('useTabGroups — activeGroup', () => {
  it('빈 그룹 → null', () => {
    const repoMap = computed(() => new Map())
    const { activeGroup } = useTabGroups(repoMap)
    expect(activeGroup.value).toBeNull()
  })

  it('activeRepoId 있는 그룹 반환', () => {
    const m = new Map([
      [1, repo(1, 'a', '/projects/g1/a')],
      [2, repo(2, 'b', '/projects/g2/b')],
    ])
    const repoMap = computed(() => m)
    mockTabs.value = [1, 2]
    mockActiveRepoId.value = 2
    const { activeGroup } = useTabGroups(repoMap)
    expect(activeGroup.value?.tabIds).toContain(2)
  })

  it('activeRepoId null → 첫 그룹 fallback', () => {
    const m = new Map([
      [1, repo(1, 'a', '/projects/g1/a')],
      [2, repo(2, 'b', '/projects/g1/b')],
    ])
    const repoMap = computed(() => m)
    mockTabs.value = [1, 2]
    mockActiveRepoId.value = null
    const { activeGroup } = useTabGroups(repoMap)
    expect(activeGroup.value?.tabIds).toEqual([1, 2])
  })
})

describe('useTabGroups — activateProject', () => {
  it('그룹 내 active 가 이미 있으면 변경 안 함', () => {
    const m = new Map([
      [1, repo(1, 'a', '/projects/g1/a')],
      [2, repo(2, 'b', '/projects/g1/b')],
    ])
    const repoMap = computed(() => m)
    mockTabs.value = [1, 2]
    mockActiveRepoId.value = 2
    const { activeGroup, activateProject } = useTabGroups(repoMap)
    activateProject(activeGroup.value!)
    expect(mockSetActive).not.toHaveBeenCalled()
  })

  it('그룹 외 active → 첫 탭 활성화', () => {
    const m = new Map([
      [1, repo(1, 'a', '/projects/g1/a')],
      [2, repo(2, 'b', '/projects/g2/b')],
    ])
    const repoMap = computed(() => m)
    mockTabs.value = [1, 2]
    mockActiveRepoId.value = 1 // g1 활성
    const { projectGroups, activateProject } = useTabGroups(repoMap)
    // g2 클릭 → setActiveRepo(2)
    const g2 = projectGroups.value.find((g) => g.key === '__solo:2' || g.key === 'g2')!
    activateProject(g2)
    expect(mockSetActive).toHaveBeenCalledWith(2)
  })
})

describe('useTabGroups — activeGroupTabs reorder', () => {
  it('set 시 store.reorderTabs 가 그룹 순서 교체된 전체 배열로 호출', () => {
    const m = new Map([
      [1, repo(1, 'a', '/projects/g1/a')],
      [2, repo(2, 'b', '/projects/g1/b')],
      [3, repo(3, 'c', '/projects/g2/c')], // 다른 그룹
    ])
    const repoMap = computed(() => m)
    mockTabs.value = [1, 2, 3]
    mockActiveRepoId.value = 1 // g1 활성
    const { activeGroupTabs } = useTabGroups(repoMap)
    // g1 의 [1, 2] 를 [2, 1] 로 reorder
    activeGroupTabs.value = [2, 1]
    expect(mockReorder).toHaveBeenCalledWith([2, 1, 3]) // g1 swap, g2 보존
  })
})
