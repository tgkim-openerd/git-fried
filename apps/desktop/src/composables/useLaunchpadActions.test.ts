// c62-C — useLaunchpadActions 단위 테스트.
//
// rowKey / openSnoozeMenu (toggle) / applyView (JSON 파싱) 검증.
// mutation 자체는 mock — meta/savedViews 의존성도 mock.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { PrState, PullRequest } from '@/api/git'

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('./useToast', () => ({
  useToast: () => ({ success: toastSuccess, error: toastError, info: vi.fn(), warning: vi.fn() }),
}))

vi.mock('@/api/errors', () => ({
  describeError: (e: unknown) => String(e),
}))

import { useLaunchpadActions, SNOOZE_OPTIONS, type Tab } from './useLaunchpadActions'

function makePr(number: number, owner = 'opnd', repo = 'foo'): PullRequest {
  return {
    forgeKind: 'gitea',
    owner,
    repo,
    number,
    title: `PR #${number}`,
    state: 'open',
    author: 'user',
    createdAt: 0,
    updatedAt: 0,
    htmlUrl: '',
    isDraft: false,
    sourceBranch: 'feat',
    targetBranch: 'main',
    mergeable: null,
  } as unknown as PullRequest
}

function makeMockMeta() {
  return {
    pinMut: { mutate: vi.fn() },
    isPinned: vi.fn(() => false),
    snoozeFor: vi.fn(),
    clearSnooze: vi.fn(),
  } as unknown as Parameters<typeof useLaunchpadActions>[0]['meta']
}

function makeMockSavedViews() {
  return {
    saveMut: { mutate: vi.fn() },
  } as unknown as Parameters<typeof useLaunchpadActions>[0]['savedViews']
}

function setup(initial: { state?: PrState | null; showBots?: boolean; tab?: Tab } = {}) {
  const meta = makeMockMeta()
  const savedViews = makeMockSavedViews()
  const stateFilterRef = ref<PrState | null>(initial.state ?? null)
  const showBotsRef = ref(initial.showBots ?? false)
  const tabRef = ref<Tab>(initial.tab ?? 'active')
  const m = useLaunchpadActions({ meta, savedViews, stateFilterRef, showBotsRef, tabRef })
  return { m, meta, savedViews, stateFilterRef, showBotsRef, tabRef }
}

describe('useLaunchpadActions — rowKey', () => {
  it('forgeKind|owner|repo|number 4 필드 pipe 연결', () => {
    const { m } = setup()
    const key = m.rowKey({ pr: makePr(42, 'opnd', 'web') })
    expect(key).toBe('gitea|opnd|web|42')
  })

  it('동일 PR 두 번 호출 시 같은 key', () => {
    const { m } = setup()
    const pr = makePr(1)
    expect(m.rowKey({ pr })).toBe(m.rowKey({ pr }))
  })
})

describe('useLaunchpadActions — snoozeMenu toggle', () => {
  beforeEach(() => {
    toastSuccess.mockClear()
    toastError.mockClear()
  })

  it('처음 open 시 rowKey 로 set', () => {
    const { m } = setup()
    m.openSnoozeMenu({ pr: makePr(1) })
    expect(m.snoozeMenuFor.value).toBe('gitea|opnd|foo|1')
  })

  it('같은 row 두 번 클릭 시 null 로 토글 (close)', () => {
    const { m } = setup()
    const row = { pr: makePr(1) }
    m.openSnoozeMenu(row)
    m.openSnoozeMenu(row)
    expect(m.snoozeMenuFor.value).toBe(null)
  })

  it('다른 row 클릭 시 새 key 로 교체', () => {
    const { m } = setup()
    m.openSnoozeMenu({ pr: makePr(1) })
    m.openSnoozeMenu({ pr: makePr(2) })
    expect(m.snoozeMenuFor.value).toBe('gitea|opnd|foo|2')
  })

  it('applySnooze 호출 시 meta.snoozeFor + menuFor=null', () => {
    const { m, meta } = setup()
    m.openSnoozeMenu({ pr: makePr(1) })
    m.applySnooze({ pr: makePr(1) }, SNOOZE_OPTIONS[1]) // day
    expect(meta.snoozeFor).toHaveBeenCalledWith(expect.objectContaining({ number: 1 }), 86400)
    expect(m.snoozeMenuFor.value).toBe(null)
  })
})

describe('useLaunchpadActions — applyView JSON 파싱', () => {
  it('state + showBots + tab 모두 보유 → 3 ref 갱신', () => {
    const { m, stateFilterRef, showBotsRef, tabRef } = setup()
    m.applyView({ filterJson: JSON.stringify({ state: 'open', showBots: true, tab: 'pinned' }) })
    expect(stateFilterRef.value).toBe('open')
    expect(showBotsRef.value).toBe(true)
    expect(tabRef.value).toBe('pinned')
  })

  it('일부 필드 누락 → 기존 값 유지', () => {
    const { m, stateFilterRef, showBotsRef, tabRef } = setup({
      state: 'closed',
      showBots: false,
      tab: 'snoozed',
    })
    m.applyView({ filterJson: JSON.stringify({ tab: 'active' }) })
    expect(stateFilterRef.value).toBe('closed') // 유지
    expect(showBotsRef.value).toBe(false) // 유지
    expect(tabRef.value).toBe('active') // 갱신
  })

  it('잘못된 JSON → ignore (catch + 기존 값 유지)', () => {
    const { m, stateFilterRef, tabRef } = setup({ state: 'open', tab: 'pinned' })
    m.applyView({ filterJson: '{ invalid json' })
    expect(stateFilterRef.value).toBe('open')
    expect(tabRef.value).toBe('pinned')
  })

  it('state=null 명시 전달 → null 로 reset', () => {
    const { m, stateFilterRef } = setup({ state: 'open' })
    m.applyView({ filterJson: JSON.stringify({ state: null }) })
    expect(stateFilterRef.value).toBe(null)
  })
})

describe('useLaunchpadActions — saveCurrentView', () => {
  beforeEach(() => {
    toastSuccess.mockClear()
  })

  it('newViewName 비어있을 때 noop', () => {
    const { m, savedViews } = setup()
    m.newViewName.value = ''
    m.saveCurrentView()
    expect(savedViews.saveMut.mutate).not.toHaveBeenCalled()
  })

  it('whitespace-only 도 noop', () => {
    const { m, savedViews } = setup()
    m.newViewName.value = '   '
    m.saveCurrentView()
    expect(savedViews.saveMut.mutate).not.toHaveBeenCalled()
  })

  it('이름 + state + showBots + tab 직렬화하여 saveMut.mutate 호출', () => {
    const { m, savedViews } = setup({ state: 'open', showBots: true, tab: 'pinned' })
    m.newViewName.value = '내 PR'
    m.saveCurrentView()
    expect(savedViews.saveMut.mutate).toHaveBeenCalled()
    const args = (savedViews.saveMut.mutate as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(args.name).toBe('내 PR')
    const parsed = JSON.parse(args.filterJson)
    expect(parsed).toEqual({ state: 'open', showBots: true, tab: 'pinned' })
  })
})

describe('useLaunchpadActions — SNOOZE_OPTIONS', () => {
  it('4 옵션 — 1h / day / week / month', () => {
    expect(SNOOZE_OPTIONS).toHaveLength(4)
    expect(SNOOZE_OPTIONS[0]).toEqual({ label: 'header.snooze1h', sec: 3600 })
    expect(SNOOZE_OPTIONS[1]).toEqual({ label: 'header.snoozeDay', sec: 86400 })
    expect(SNOOZE_OPTIONS[2]).toEqual({ label: 'header.snoozeWeek', sec: 604800 })
    expect(SNOOZE_OPTIONS[3]).toEqual({ label: 'header.snoozeMonth', sec: 2592000 })
  })

  it('총 sec 증가 순서 — 1h < day < week < month', () => {
    const secs = SNOOZE_OPTIONS.map((o) => o.sec)
    expect(secs).toEqual([...secs].sort((a, b) => a - b))
  })
})
