import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useStatusFilter } from './useStatusFilter'
import type { FileChange, RepoStatus } from '@/types/git'

function fc(path: string): FileChange {
  return { path, oldPath: null, status: 'modified' }
}

function mkStatus(over: Partial<RepoStatus> = {}): RepoStatus {
  return {
    branch: 'main',
    upstream: null,
    ahead: 0,
    behind: 0,
    staged: [],
    unstaged: [],
    untracked: [],
    conflicted: [],
    isClean: true,
    ...over,
  }
}

describe('useStatusFilter', () => {
  it('empty filter returns all', () => {
    const status = ref<RepoStatus | null>(
      mkStatus({
        staged: [fc('a.ts'), fc('b.ts')],
        unstaged: [fc('c.ts')],
        untracked: ['d.ts'],
        conflicted: ['e.ts'],
      }),
    )
    const f = useStatusFilter(status)
    expect(f.filteredStaged.value.length).toBe(2)
    expect(f.filteredUnstaged.value.length).toBe(1)
    expect(f.filteredUntracked.value.length).toBe(1)
    expect(f.filteredConflicted.value.length).toBe(1)
    expect(f.hasAnyMatch.value).toBe(true)
  })

  it('substring filter (case-insensitive)', () => {
    const status = ref<RepoStatus | null>(
      mkStatus({
        staged: [fc('Foo.ts'), fc('bar.ts')],
        unstaged: [fc('FOOBAR.ts'), fc('baz.ts')],
      }),
    )
    const f = useStatusFilter(status)
    f.fileFilter.value = 'foo'
    expect(f.filteredStaged.value.map((x) => x.path)).toEqual(['Foo.ts'])
    expect(f.filteredUnstaged.value.map((x) => x.path)).toEqual(['FOOBAR.ts'])
  })

  it('whitespace-only filter is treated as empty', () => {
    const status = ref<RepoStatus | null>(mkStatus({ staged: [fc('a.ts'), fc('b.ts')] }))
    const f = useStatusFilter(status)
    f.fileFilter.value = '   '
    expect(f.filteredStaged.value.length).toBe(2)
  })

  it('null status yields empty arrays + hasAnyMatch=false', () => {
    const status = ref<RepoStatus | null>(null)
    const f = useStatusFilter(status)
    expect(f.filteredStaged.value.length).toBe(0)
    expect(f.filteredUnstaged.value.length).toBe(0)
    expect(f.filteredUntracked.value.length).toBe(0)
    expect(f.filteredConflicted.value.length).toBe(0)
    expect(f.hasAnyMatch.value).toBe(false)
  })

  it('matchFilter respects current fileFilter value', () => {
    const status = ref<RepoStatus | null>(mkStatus())
    const f = useStatusFilter(status)
    f.fileFilter.value = 'src/'
    expect(f.matchFilter('src/main.ts')).toBe(true)
    expect(f.matchFilter('test/main.ts')).toBe(false)
  })

  it('hasAnyMatch reflects all 4 sections', () => {
    const status = ref<RepoStatus | null>(mkStatus({ untracked: ['only-untracked.ts'] }))
    const f = useStatusFilter(status)
    expect(f.hasAnyMatch.value).toBe(true)
    f.fileFilter.value = 'no-match-anywhere'
    expect(f.hasAnyMatch.value).toBe(false)
  })
})
