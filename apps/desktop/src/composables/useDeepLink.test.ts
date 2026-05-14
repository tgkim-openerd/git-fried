import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const dispatchShortcutSpy = vi.fn()

vi.mock('./useShortcuts', () => ({
  dispatchShortcut: (action: string) => dispatchShortcutSpy(action),
}))

import { COMMAND_ALIASES, dispatchDeepLink } from './useDeepLink'

describe('COMMAND_ALIASES', () => {
  it('read-only / navigation alias 만 노출 (SEC-202 — destructive 차단)', () => {
    // SEC-202 (Codex R1): 외부 deep-link 만으로 destructive 명령 dispatch 못하도록
    // pull/push/commit/stage-* / new-* / fetch 9개 영구 제거.
    expect(COMMAND_ALIASES['toggle-sidebar']).toBe('toggleSidebar')
    expect(COMMAND_ALIASES['terminal']).toBe('terminal')
    expect(COMMAND_ALIASES['help']).toBe('help')
    expect(COMMAND_ALIASES['show-diff']).toBe('showDiff')
  })

  it('SEC-202: destructive alias 9개 모두 차단', () => {
    const destructive = [
      'fetch',
      'pull',
      'push',
      'commit',
      'stage-all',
      'unstage-all',
      'stage-and-commit',
      'new-pr',
      'new-branch',
    ]
    for (const a of destructive) {
      expect(COMMAND_ALIASES[a]).toBeUndefined()
    }
  })
})

describe('dispatchDeepLink', () => {
  let pushSpy: ReturnType<typeof vi.fn>
  let setActiveRepoSpy: ReturnType<typeof vi.fn>
  let ctx: Parameters<typeof dispatchDeepLink>[1]

  // Sprint c50 — Pattern 8 inline 가드 도입 후 ctx.router.currentRoute 도 mock.
  // default '/elsewhere' — push 발생 (기존 테스트 보존). '/' 케이스는 별도 it.
  let currentPath: string
  beforeEach(() => {
    pushSpy = vi.fn()
    setActiveRepoSpy = vi.fn()
    currentPath = '/elsewhere'
    ctx = {
      router: {
        push: pushSpy,
        currentRoute: {
          value: {
            get path() {
              return currentPath
            },
          },
        },
      } as unknown as Parameters<typeof dispatchDeepLink>[1]['router'],
      store: { setActiveRepo: setActiveRepoSpy as unknown as (id: number) => void },
    }
    dispatchShortcutSpy.mockClear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('git-fried://launchpad → router.push("/launchpad")', () => {
    dispatchDeepLink('git-fried://launchpad', ctx)
    expect(pushSpy).toHaveBeenCalledWith('/launchpad')
  })

  it('git-fried://settings → /settings', () => {
    dispatchDeepLink('git-fried://settings', ctx)
    expect(pushSpy).toHaveBeenCalledWith('/settings')
  })

  it('git-fried://home → /', () => {
    dispatchDeepLink('git-fried://home', ctx)
    expect(pushSpy).toHaveBeenCalledWith('/')
  })

  it('git-fried://home — 이미 / 면 push 안 함 (Pattern 8 가드)', () => {
    currentPath = '/'
    dispatchDeepLink('git-fried://home', ctx)
    expect(pushSpy).not.toHaveBeenCalled()
  })

  it('git-fried://repo/42 — 이미 / 면 setActiveRepo 만, push 안 함 (Pattern 8 가드)', () => {
    currentPath = '/'
    dispatchDeepLink('git-fried://repo/42', ctx)
    expect(setActiveRepoSpy).toHaveBeenCalledWith(42)
    expect(pushSpy).not.toHaveBeenCalled()
  })

  it('git-fried://repo/42 → setActiveRepo(42) + push("/")', () => {
    dispatchDeepLink('git-fried://repo/42', ctx)
    expect(setActiveRepoSpy).toHaveBeenCalledWith(42)
    expect(pushSpy).toHaveBeenCalledWith('/')
  })

  it('git-fried://repo/abc — id NaN 이면 noop', () => {
    dispatchDeepLink('git-fried://repo/abc', ctx)
    expect(setActiveRepoSpy).not.toHaveBeenCalled()
    expect(pushSpy).not.toHaveBeenCalled()
  })

  it('git-fried://repo (arg 없음) → noop', () => {
    dispatchDeepLink('git-fried://repo', ctx)
    expect(setActiveRepoSpy).not.toHaveBeenCalled()
  })

  it('git-fried://command/toggle-sidebar — 50ms 후 dispatchShortcut (read-only alias)', () => {
    dispatchDeepLink('git-fried://command/toggle-sidebar', ctx)
    expect(dispatchShortcutSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(50)
    expect(dispatchShortcutSpy).toHaveBeenCalledWith('toggleSidebar')
  })

  it('git-fried://command/push — SEC-202: destructive 차단 (dispatch 안 됨)', () => {
    dispatchDeepLink('git-fried://command/push', ctx)
    vi.advanceTimersByTime(100)
    expect(dispatchShortcutSpy).not.toHaveBeenCalled()
  })

  it('git-fried://command/pull — SEC-202: destructive 차단', () => {
    dispatchDeepLink('git-fried://command/pull', ctx)
    vi.advanceTimersByTime(100)
    expect(dispatchShortcutSpy).not.toHaveBeenCalled()
  })

  it('git-fried://command/unknown-alias → setTimeout 미호출', () => {
    dispatchDeepLink('git-fried://command/unknown-alias', ctx)
    vi.advanceTimersByTime(100)
    expect(dispatchShortcutSpy).not.toHaveBeenCalled()
  })

  it('git-fried://unknown-cmd → silent fail', () => {
    dispatchDeepLink('git-fried://unknown-cmd', ctx)
    expect(pushSpy).not.toHaveBeenCalled()
    expect(setActiveRepoSpy).not.toHaveBeenCalled()
  })

  it('malformed URL → silent fail (URL constructor throw)', () => {
    expect(() => dispatchDeepLink('not-a-url', ctx)).not.toThrow()
    expect(pushSpy).not.toHaveBeenCalled()
  })
})
