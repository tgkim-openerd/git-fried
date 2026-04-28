import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const dispatchShortcutSpy = vi.fn()

vi.mock('./useShortcuts', () => ({
  dispatchShortcut: (action: string) => dispatchShortcutSpy(action),
}))

import { COMMAND_ALIASES, dispatchDeepLink } from './useDeepLink'

describe('COMMAND_ALIASES', () => {
  it('25 alias 매핑 (Sprint D6)', () => {
    expect(Object.keys(COMMAND_ALIASES).length).toBeGreaterThanOrEqual(20)
    expect(COMMAND_ALIASES['fetch']).toBe('fetch')
    expect(COMMAND_ALIASES['new-pr']).toBe('newPr')
    expect(COMMAND_ALIASES['stage-and-commit']).toBe('stageAndCommit')
    expect(COMMAND_ALIASES['toggle-sidebar']).toBe('toggleSidebar')
  })
})

describe('dispatchDeepLink', () => {
  let pushSpy: ReturnType<typeof vi.fn>
  let setActiveRepoSpy: ReturnType<typeof vi.fn>
  let ctx: Parameters<typeof dispatchDeepLink>[1]

  beforeEach(() => {
    pushSpy = vi.fn()
    setActiveRepoSpy = vi.fn()
    ctx = {
      router: { push: pushSpy },
      store: { setActiveRepo: setActiveRepoSpy },
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

  it('git-fried://command/fetch — 50ms 후 dispatchShortcut("fetch")', () => {
    dispatchDeepLink('git-fried://command/fetch', ctx)
    expect(dispatchShortcutSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(50)
    expect(dispatchShortcutSpy).toHaveBeenCalledWith('fetch')
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
