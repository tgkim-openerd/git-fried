// c72 — useBranchActions 의 pure helper export 단위 테스트.
//
// localBranchName: "origin/foo" 같은 remote tracking 이름에서 remote prefix 제거.
// 일반 local 이름은 그대로 (slash 없음 케이스).
import { describe, expect, it } from 'vitest'
import { localBranchName } from './useBranchActions'

describe('localBranchName', () => {
  it('slash 없음 → 그대로', () => {
    expect(localBranchName('main')).toBe('main')
    expect(localBranchName('feat-x')).toBe('feat-x')
  })

  it('origin/branch → branch', () => {
    expect(localBranchName('origin/main')).toBe('main')
    expect(localBranchName('origin/feat/x')).toBe('feat/x')
  })

  it('다중 slash — 첫 segment 만 제거 (origin/feat/x → feat/x)', () => {
    expect(localBranchName('origin/feat/something-long')).toBe('feat/something-long')
  })

  it('upstream remote 이름 — upstream/foo → foo', () => {
    expect(localBranchName('upstream/main')).toBe('main')
  })

  it('빈 string 입력 → 그대로 빈 string', () => {
    expect(localBranchName('')).toBe('')
  })

  it('slash 만 있는 edge (origin/) → 빈 string', () => {
    expect(localBranchName('origin/')).toBe('')
  })

  it('연속 slash (origin//foo) → 첫 segment 제거 후 그대로 (/foo)', () => {
    expect(localBranchName('origin//foo')).toBe('/foo')
  })
})
