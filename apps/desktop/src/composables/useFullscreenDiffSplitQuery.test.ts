// c66-B — computeSplitArgs pure 함수 단위 테스트.
//
// state machine 4 분기 (untracked / staged / unstaged / commit) + null guard.
import { describe, expect, it } from 'vitest'
import { computeSplitArgs } from './useFullscreenDiffSplitQuery'

describe('computeSplitArgs — null guards', () => {
  it('current=null → null', () => {
    expect(computeSplitArgs(null, 1, [])).toBe(null)
  })

  it('repoId=null → null', () => {
    expect(computeSplitArgs({ source: 'wip', path: 'a.ts' }, null, [])).toBe(null)
  })

  it('current=null + repoId=null → null', () => {
    expect(computeSplitArgs(null, null, [])).toBe(null)
  })
})

describe('computeSplitArgs — WIP untracked', () => {
  it('isStaged=false + path 가 untracked 에 포함 → isUntracked=true, 모든 rev null', () => {
    const out = computeSplitArgs({ source: 'wip', path: 'new.ts', isStaged: false }, 1, [
      'new.ts',
      'other.ts',
    ])
    expect(out).toEqual({
      repoId: 1,
      path: 'new.ts',
      baseRev: null,
      baseStaged: false,
      currentRev: null,
      currentStaged: false,
      isUntracked: true,
    })
  })

  it('isStaged=true + path 가 untracked 에 포함 → staged 분기 우선', () => {
    // staged 분기는 isUntracked 검사 전에 false 가 됨 (cur.isStaged 가 true 이므로)
    const out = computeSplitArgs({ source: 'wip', path: 'new.ts', isStaged: true }, 1, ['new.ts'])
    expect(out?.isUntracked).toBe(false)
    expect(out?.baseRev).toBe('HEAD')
    expect(out?.currentStaged).toBe(true)
  })

  it('isStaged=false + path 미포함 → unstaged 분기', () => {
    const out = computeSplitArgs({ source: 'wip', path: 'tracked.ts', isStaged: false }, 1, [
      'unrelated.ts',
    ])
    expect(out?.isUntracked).toBe(false)
    expect(out?.baseStaged).toBe(true)
    expect(out?.currentStaged).toBe(false)
  })
})

describe('computeSplitArgs — WIP staged', () => {
  it('isStaged=true → baseRev=HEAD / currentStaged=true', () => {
    const out = computeSplitArgs({ source: 'wip', path: 'foo.ts', isStaged: true }, 5, [])
    expect(out).toEqual({
      repoId: 5,
      path: 'foo.ts',
      baseRev: 'HEAD',
      baseStaged: false,
      currentRev: null,
      currentStaged: true,
      isUntracked: false,
    })
  })
})

describe('computeSplitArgs — WIP unstaged', () => {
  it('isStaged=false + untracked 미포함 → baseStaged=true / currentStaged=false', () => {
    const out = computeSplitArgs({ source: 'wip', path: 'foo.ts', isStaged: false }, 9, [])
    expect(out).toEqual({
      repoId: 9,
      path: 'foo.ts',
      baseRev: null,
      baseStaged: true,
      currentRev: null,
      currentStaged: false,
      isUntracked: false,
    })
  })

  it('isStaged 미지정 (undefined) + untracked 미포함 → unstaged 분기 (isStaged=undefined→falsy)', () => {
    const out = computeSplitArgs({ source: 'wip', path: 'foo.ts' }, 1, [])
    expect(out?.baseStaged).toBe(true)
  })
})

describe('computeSplitArgs — commit', () => {
  it('sha=abc123 → baseRev=abc123~ / currentRev=abc123', () => {
    const out = computeSplitArgs({ source: 'commit', path: 'foo.ts', sha: 'abc123' }, 1, [])
    expect(out).toEqual({
      repoId: 1,
      path: 'foo.ts',
      baseRev: 'abc123~',
      baseStaged: false,
      currentRev: 'abc123',
      currentStaged: false,
      isUntracked: false,
    })
  })

  it('untracked 무관 (commit 분기는 status.untracked 영향 받지 않음)', () => {
    const out = computeSplitArgs(
      { source: 'commit', path: 'foo.ts', sha: 'sha1' },
      1,
      ['foo.ts'], // untracked 에 같은 path 있어도 commit 분기 우선
    )
    expect(out?.isUntracked).toBe(false)
    expect(out?.baseRev).toBe('sha1~')
  })

  it('sha 미지정 (undefined) → currentRev=null', () => {
    const out = computeSplitArgs({ source: 'commit', path: 'foo.ts' }, 1, [])
    expect(out?.currentRev).toBe(null)
    expect(out?.baseRev).toBe('undefined~') // edge: template literal 그대로
  })
})

describe('computeSplitArgs — repoId propagation', () => {
  it('모든 분기에서 repoId 가 출력에 보존됨', () => {
    const wip = computeSplitArgs({ source: 'wip', path: 'a', isStaged: false }, 42, [])
    expect(wip?.repoId).toBe(42)

    const staged = computeSplitArgs({ source: 'wip', path: 'a', isStaged: true }, 7, [])
    expect(staged?.repoId).toBe(7)

    const untracked = computeSplitArgs({ source: 'wip', path: 'a', isStaged: false }, 99, ['a'])
    expect(untracked?.repoId).toBe(99)

    const commit = computeSplitArgs({ source: 'commit', path: 'a', sha: 's' }, 17, [])
    expect(commit?.repoId).toBe(17)
  })
})
