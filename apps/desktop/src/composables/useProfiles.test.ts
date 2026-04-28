import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

// vue-query / api 의존 — mock 으로 단순 격리.

type Profile = { id: number; isActive: boolean; name: string }

const dataRef = ref<Profile[] | undefined>(undefined)

vi.mock('@tanstack/vue-query', () => ({
  useQuery: () => ({ data: dataRef, isLoading: ref(false), isError: ref(false) }),
}))

vi.mock('@/api/git', () => ({
  listProfiles: vi.fn(),
}))

vi.mock('@/api/queryClient', () => ({
  STALE_TIME: { STATIC: 0, NORMAL: 0, REALTIME: 0 },
}))

import { useProfiles } from './useProfiles'

describe('useProfiles', () => {
  it('data undefined → active null', () => {
    dataRef.value = undefined
    const { active } = useProfiles()
    expect(active.value).toBe(null)
  })

  it('data 빈 배열 → active null', () => {
    dataRef.value = []
    const { active } = useProfiles()
    expect(active.value).toBe(null)
  })

  it('active = isActive=true 인 첫 profile', () => {
    dataRef.value = [
      { id: 1, isActive: false, name: 'A' },
      { id: 2, isActive: true, name: 'B' },
      { id: 3, isActive: false, name: 'C' },
    ]
    const { active } = useProfiles()
    expect(active.value?.id).toBe(2)
    expect(active.value?.name).toBe('B')
  })

  it('isActive=true 가 다중이면 first match', () => {
    dataRef.value = [
      { id: 1, isActive: true, name: 'A' },
      { id: 2, isActive: true, name: 'B' },
    ]
    const { active } = useProfiles()
    expect(active.value?.id).toBe(1)
  })

  it('모든 profile isActive=false → null', () => {
    dataRef.value = [
      { id: 1, isActive: false, name: 'A' },
      { id: 2, isActive: false, name: 'B' },
    ]
    const { active } = useProfiles()
    expect(active.value).toBe(null)
  })
})
