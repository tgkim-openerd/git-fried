// Sprint c52 — branch chip sticky 활성 조건 회귀 보호.
// Sprint c54 — branchTagSticky 강제 false 폐기 (사용자 보고: chip 부재 + scroll artifact).
//
// 폐기 이유 (composable 주석 참조):
//   sticky overlay 의 `position: sticky + top: 0 + height: 100%` + virtualizer children
//   `top: v.start` 좌표 mismatch → chip 잘못된 위치 또는 0건. c54+ 재설계 시 활성 조건 복원.
//
// 본 테스트는 c54 임시 disable 회귀 가드 — 항상 false 보장. 재설계 후 4 active cases 복원.
import { beforeEach, describe, expect, it } from 'vitest'
import { useCommitGraphHeader } from './useCommitGraphHeader'

describe('useCommitGraphHeader — branchTagSticky (c54 disable)', () => {
  beforeEach(() => {
    // localStorage + 싱글톤 state 초기화. cols.reset() 은 default order 복원.
    if (typeof localStorage !== 'undefined') localStorage.clear()
    const { cols } = useCommitGraphHeader()
    cols.reset()
  })

  it('default order — branchTag 가 첫 위치이지만 c54 disable 로 sticky 비활성', () => {
    const { branchTagSticky, branchTagColumnVisible, cols } = useCommitGraphHeader()
    expect(cols.visibleIds.value[0]).toBe('branchTag')
    expect(branchTagColumnVisible.value).toBe(true)
    expect(branchTagSticky.value).toBe(false)
  })

  it('branchTag 가 second 위치 → sticky 비활성 (c54 disable 와 무관)', () => {
    const { branchTagSticky, branchTagColumnVisible, cols } = useCommitGraphHeader()
    cols.setOrder(['sha', 'branchTag', 'message', 'author', 'date', 'signed'])
    expect(branchTagColumnVisible.value).toBe(true)
    expect(branchTagSticky.value).toBe(false)
  })

  it('branchTag 가 hidden → sticky 비활성', () => {
    const { branchTagSticky, branchTagColumnVisible, cols } = useCommitGraphHeader()
    cols.setOrder(['sha', 'message', 'author', 'date', 'signed'])
    expect(branchTagColumnVisible.value).toBe(false)
    expect(branchTagSticky.value).toBe(false)
  })

  it('toggle on/off — c54 disable 로 항상 false', () => {
    const { branchTagSticky, cols } = useCommitGraphHeader()
    expect(branchTagSticky.value).toBe(false)
    cols.toggle('branchTag') // off
    expect(branchTagSticky.value).toBe(false)
    cols.toggle('branchTag') // on, default order 의 첫 위치 복원
    expect(cols.visibleIds.value[0]).toBe('branchTag')
    expect(branchTagSticky.value).toBe(false)
  })
})
