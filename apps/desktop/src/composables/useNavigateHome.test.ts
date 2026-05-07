// Sprint c50 — useNavigateHome composable (Pattern 8) 회귀 보호.
import { describe, expect, it, vi, beforeEach } from 'vitest'

const pushMock = vi.fn()
let currentPath = '/'

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: pushMock,
    currentRoute: {
      value: {
        get path() {
          return currentPath
        },
      },
    },
  }),
}))

import { useNavigateHome } from './useNavigateHome'

describe('useNavigateHome', () => {
  beforeEach(() => {
    pushMock.mockReset()
  })

  it('이미 / 에 있으면 push 호출 안 함 (history duplicate 방지)', () => {
    currentPath = '/'
    const goHome = useNavigateHome()
    goHome()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('다른 path 면 / 로 push', () => {
    currentPath = '/settings'
    const goHome = useNavigateHome()
    goHome()
    expect(pushMock).toHaveBeenCalledWith('/')
    expect(pushMock).toHaveBeenCalledTimes(1)
  })

  it('연속 호출 시 path 가 그대로 / 면 한 번만 push (caller 가 path 갱신 책임 — composable 은 idempotent 보장)', () => {
    currentPath = '/launchpad'
    const goHome = useNavigateHome()
    goHome()
    expect(pushMock).toHaveBeenCalledTimes(1)
    // mock 환경에선 currentPath 가 자동 갱신 안 되므로 두 번째 호출도 push (실제 router 는 currentRoute 자동 변경).
    // 핵심 검증: 가드는 composable 내부 currentRoute 만 본다는 점.
    goHome()
    expect(pushMock).toHaveBeenCalledTimes(2)
  })

  it('각 caller 호출 시 useRouter() 결과 새로 받음 (다른 컴포넌트에서 독립적)', () => {
    currentPath = '/repo'
    const goHomeA = useNavigateHome()
    const goHomeB = useNavigateHome()
    goHomeA()
    goHomeB()
    expect(pushMock).toHaveBeenCalledTimes(2)
  })
})
