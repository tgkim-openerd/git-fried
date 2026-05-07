// Sprint c52 — branch chip sticky 활성 조건 회귀 보호.
//
// branchTagSticky 는 useCommitGraphHeader 의 핵심 design decision (상세는 composable 주석 참조).
// useCommitColumns 가 module-scope ref 싱글톤이라 test 간 state 공유. 각 test 마다 reset.
import { beforeEach, describe, expect, it } from 'vitest'
import { useCommitGraphHeader } from './useCommitGraphHeader'

describe('useCommitGraphHeader — branchTagSticky', () => {
  beforeEach(() => {
    // localStorage + 싱글톤 state 초기화. cols.reset() 은 default order 복원.
    if (typeof localStorage !== 'undefined') localStorage.clear()
    const { cols } = useCommitGraphHeader()
    cols.reset()
  })

  it('default order — branchTag 가 첫 위치 → sticky 활성', () => {
    const { branchTagSticky, branchTagColumnVisible, cols } = useCommitGraphHeader()
    expect(cols.visibleIds.value[0]).toBe('branchTag')
    expect(branchTagColumnVisible.value).toBe(true)
    expect(branchTagSticky.value).toBe(true)
  })

  it('branchTag 가 second 위치 → sticky 비활성 (visible 이지만 첫 위치 아님)', () => {
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

  it('toggle 로 branchTag off → sticky off, 다시 on (default 위치 복원) → sticky on', () => {
    const { branchTagSticky, cols } = useCommitGraphHeader()
    expect(branchTagSticky.value).toBe(true)
    cols.toggle('branchTag') // off
    expect(branchTagSticky.value).toBe(false)
    cols.toggle('branchTag') // on, default order 의 branchTag 위치 (첫 위치) 로 복원
    expect(cols.visibleIds.value[0]).toBe('branchTag')
    expect(branchTagSticky.value).toBe(true)
  })
})
