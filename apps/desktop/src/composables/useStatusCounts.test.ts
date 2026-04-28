import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { RepoStatus } from '@/types/git'

// useStatus 가 vue-query useQuery wrapper — test 에서는 mock 으로 격리.
vi.mock('./useStatus', () => ({
  useStatus: vi.fn(),
}))

import { useStatusCounts } from './useStatusCounts'
import { useStatus } from './useStatus'

const mockedUseStatus = vi.mocked(useStatus)

function setStatus(s: Partial<RepoStatus> | null) {
  if (s === null) {
    mockedUseStatus.mockReturnValue({ data: ref(undefined) } as never)
    return
  }
  const full: RepoStatus = {
    branch: 'main',
    upstream: null,
    ahead: 0,
    behind: 0,
    staged: [],
    unstaged: [],
    untracked: [],
    conflicted: [],
    isClean: true,
    ...s,
  }
  mockedUseStatus.mockReturnValue({ data: ref(full) } as never)
}

describe('useStatusCounts', () => {
  it('null status → all 0 + isClean true', () => {
    setStatus(null)
    const { counts, hasChanges, isClean } = useStatusCounts(() => 1)
    expect(counts.value).toEqual({
      total: 0,
      staged: 0,
      unstaged: 0,
      untracked: 0,
      conflicted: 0,
    })
    expect(hasChanges.value).toBe(false)
    expect(isClean.value).toBe(true)
  })

  it('counts each category + total sum', () => {
    setStatus({
      staged: [{ path: 'a', oldPath: null, status: 'modified' }],
      unstaged: [
        { path: 'b', oldPath: null, status: 'modified' },
        { path: 'c', oldPath: null, status: 'modified' },
      ],
      untracked: ['d', 'e', 'f'],
      conflicted: ['g'],
    })
    const { counts, hasChanges, isClean } = useStatusCounts(() => 1)
    expect(counts.value).toEqual({
      total: 7,
      staged: 1,
      unstaged: 2,
      untracked: 3,
      conflicted: 1,
    })
    expect(hasChanges.value).toBe(true)
    expect(isClean.value).toBe(false)
  })

  it('only conflicted → total = 1, isClean false', () => {
    setStatus({ conflicted: ['merge.txt'] })
    const { counts, hasChanges, isClean } = useStatusCounts(() => 1)
    expect(counts.value.total).toBe(1)
    expect(hasChanges.value).toBe(true)
    expect(isClean.value).toBe(false)
  })

  it('missing arrays (undefined) treated as 0', () => {
    // RepoStatus 의 staged/unstaged 등이 undefined 일 때 fallback 검증.
    mockedUseStatus.mockReturnValue({ data: ref({ branch: 'main' } as RepoStatus) } as never)
    const { counts } = useStatusCounts(() => 1)
    expect(counts.value.total).toBe(0)
  })
})
