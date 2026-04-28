import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

type RepoAlias = { repoId: number; profileId: number | null; alias: string }
type Profile = { id: number; isActive: boolean; name: string } | null

const aliasesData = ref<RepoAlias[] | undefined>(undefined)
const activeProfile = ref<Profile>(null)

vi.mock('@tanstack/vue-query', () => ({
  useQuery: () => ({ data: aliasesData }),
  useMutation: (opts: { mutationFn: unknown }) => ({
    mutate: vi.fn(),
    mutationFn: opts.mutationFn,
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

vi.mock('@/api/git', () => ({
  listAllRepoAliases: vi.fn(),
  setRepoAlias: vi.fn(),
  unsetRepoAlias: vi.fn(),
}))

vi.mock('@/api/queryClient', () => ({
  STALE_TIME: { STATIC: 0, NORMAL: 0, REALTIME: 0 },
}))

vi.mock('./useProfiles', () => ({
  useProfiles: () => ({ active: activeProfile }),
}))

const toastError = vi.fn()
vi.mock('./useToast', () => ({
  useToast: () => ({ error: toastError, success: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}))

vi.mock('@/api/errors', () => ({
  describeError: (e: unknown) => String(e),
}))

import { useRepoAliases } from './useRepoAliases'

describe('useRepoAliases — resolveLocal / activeAliasFor', () => {
  beforeEach(() => {
    aliasesData.value = undefined
    activeProfile.value = null
    toastError.mockClear()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('alias 데이터 없음 → resolveLocal 은 fallback name + aliased=false', () => {
    const r = useRepoAliases()
    expect(r.resolveLocal(1, 'frontend')).toEqual({ display: 'frontend', aliased: false })
    expect(r.activeAliasFor(1)).toBe(null)
  })

  it('global alias 만 (profileId=null) → resolveLocal display=alias + aliased=true', () => {
    aliasesData.value = [{ repoId: 1, profileId: null, alias: '회사프론트' }]
    const r = useRepoAliases()
    expect(r.resolveLocal(1, 'frontend')).toEqual({
      display: '회사프론트',
      aliased: true,
    })
    expect(r.activeAliasFor(1)).toBe('회사프론트')
  })

  it('per-profile alias 우선 — global 보다 profile 매칭 우선', () => {
    activeProfile.value = { id: 7, isActive: true, name: 'work' }
    aliasesData.value = [
      { repoId: 1, profileId: null, alias: 'global-name' },
      { repoId: 1, profileId: 7, alias: 'work-name' },
    ]
    const r = useRepoAliases()
    expect(r.resolveLocal(1, 'frontend').display).toBe('work-name')
    expect(r.activeAliasFor(1)).toBe('work-name')
  })

  it('per-profile alias 없으면 global alias fallback', () => {
    activeProfile.value = { id: 99, isActive: true, name: 'other' }
    aliasesData.value = [{ repoId: 1, profileId: null, alias: 'global-name' }]
    const r = useRepoAliases()
    expect(r.resolveLocal(1, 'frontend').display).toBe('global-name')
    expect(r.activeAliasFor(1)).toBe('global-name')
  })

  it('알 수 없는 repoId → fallback 그대로', () => {
    aliasesData.value = [{ repoId: 99, profileId: null, alias: 'other' }]
    const r = useRepoAliases()
    expect(r.resolveLocal(1, 'mine')).toEqual({ display: 'mine', aliased: false })
    expect(r.activeAliasFor(1)).toBe(null)
  })

  it('byRepo Map 구조 — repoId → Map<profileId|null, alias>', () => {
    aliasesData.value = [
      { repoId: 1, profileId: null, alias: 'global1' },
      { repoId: 1, profileId: 7, alias: 'work1' },
      { repoId: 2, profileId: null, alias: 'global2' },
    ]
    const r = useRepoAliases()
    expect(r.byRepo.value.size).toBe(2)
    expect(r.byRepo.value.get(1)?.size).toBe(2)
    expect(r.byRepo.value.get(1)?.get(null)).toBe('global1')
    expect(r.byRepo.value.get(1)?.get(7)).toBe('work1')
    expect(r.byRepo.value.get(2)?.get(null)).toBe('global2')
  })

  it('activeProfileId 반영 — null 일 때는 global 만 반환', () => {
    activeProfile.value = null
    aliasesData.value = [
      { repoId: 1, profileId: null, alias: 'global' },
      { repoId: 1, profileId: 5, alias: 'profile-5' },
    ]
    const r = useRepoAliases()
    expect(r.activeProfileId.value).toBe(null)
    // active profile 없으니 global 만 활용
    expect(r.activeAliasFor(1)).toBe('global')
  })
})
