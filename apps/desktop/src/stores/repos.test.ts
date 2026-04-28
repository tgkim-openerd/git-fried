import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useReposStore } from './repos'

describe('useReposStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(() => {
    localStorage.clear()
  })

  it('initial state — tabs=[], activeRepoId=null, activeWorkspaceId=null', () => {
    const s = useReposStore()
    expect(s.tabs).toEqual([])
    expect(s.activeRepoId).toBe(null)
    expect(s.activeWorkspaceId).toBe(null)
  })

  it('setActiveRepo — id 가 tabs 에 없으면 자동 추가', () => {
    const s = useReposStore()
    s.setActiveRepo(5)
    expect(s.activeRepoId).toBe(5)
    expect(s.tabs).toEqual([5])
  })

  it('setActiveRepo — 이미 있는 id 면 tabs 변경 없음', () => {
    const s = useReposStore()
    s.openTab(3)
    s.openTab(5)
    s.setActiveRepo(3)
    expect(s.tabs).toEqual([3, 5])
    expect(s.activeRepoId).toBe(3)
  })

  it('setActiveRepo(null) — activeRepoId 초기화 (tabs 보존)', () => {
    const s = useReposStore()
    s.openTab(1)
    s.setActiveRepo(null)
    expect(s.activeRepoId).toBe(null)
    expect(s.tabs).toEqual([1])
  })

  it('openTab — 신규 id 면 끝에 추가 + active 로', () => {
    const s = useReposStore()
    s.openTab(1)
    s.openTab(2)
    expect(s.tabs).toEqual([1, 2])
    expect(s.activeRepoId).toBe(2)
  })

  it('closeTab — 닫은 탭이 active 면 다음 탭, 마지막이면 이전', () => {
    const s = useReposStore()
    s.openTab(1)
    s.openTab(2)
    s.openTab(3)
    expect(s.activeRepoId).toBe(3)
    s.closeTab(3)
    expect(s.activeRepoId).toBe(2) // 닫은 탭 idx 의 prev
    s.closeTab(1) // 1 닫음 (active 는 2 라 영향 없음)
    expect(s.activeRepoId).toBe(2)
    expect(s.tabs).toEqual([2])
  })

  it('closeTab — 존재 안 하는 id 면 noop', () => {
    const s = useReposStore()
    s.openTab(1)
    s.closeTab(99)
    expect(s.tabs).toEqual([1])
  })

  it('closeOthers — keepId 만 남김 + active', () => {
    const s = useReposStore()
    s.openTab(1)
    s.openTab(2)
    s.openTab(3)
    s.closeOthers(2)
    expect(s.tabs).toEqual([2])
    expect(s.activeRepoId).toBe(2)
  })

  it('closeOthers — keepId 가 tabs 에 없으면 noop', () => {
    const s = useReposStore()
    s.openTab(1)
    s.closeOthers(99)
    expect(s.tabs).toEqual([1])
  })

  it('closeAll — tabs 비움 + active=null', () => {
    const s = useReposStore()
    s.openTab(1)
    s.openTab(2)
    s.closeAll()
    expect(s.tabs).toEqual([])
    expect(s.activeRepoId).toBe(null)
  })

  it('setActiveWorkspace — 워크스페이스 전환 시 tabs/active 초기화', () => {
    const s = useReposStore()
    s.openTab(1)
    s.openTab(2)
    s.setActiveWorkspace(7)
    expect(s.activeWorkspaceId).toBe(7)
    expect(s.tabs).toEqual([])
    expect(s.activeRepoId).toBe(null)
  })

  it('reorderTabs — 동일 멤버 다른 순서', () => {
    const s = useReposStore()
    s.openTab(1)
    s.openTab(2)
    s.openTab(3)
    s.reorderTabs([3, 1, 2])
    expect(s.tabs).toEqual([3, 1, 2])
  })

  it('reorderTabs — 멤버가 다른 입력은 무시', () => {
    const s = useReposStore()
    s.openTab(1)
    s.openTab(2)
    s.reorderTabs([1, 99])
    expect(s.tabs).toEqual([1, 2])
  })

  it('reorderTabs — 길이 다른 입력 무시', () => {
    const s = useReposStore()
    s.openTab(1)
    s.openTab(2)
    s.reorderTabs([1])
    expect(s.tabs).toEqual([1, 2])
  })

  it('nextTab / prevTab — 순환', () => {
    const s = useReposStore()
    s.openTab(1)
    s.openTab(2)
    s.openTab(3)
    s.setActiveRepo(2)
    s.nextTab()
    expect(s.activeRepoId).toBe(3)
    s.nextTab()
    expect(s.activeRepoId).toBe(1) // wrap
    s.prevTab()
    expect(s.activeRepoId).toBe(3) // wrap reverse
  })

  it('nextTab — tabs 1개 이하면 noop', () => {
    const s = useReposStore()
    s.openTab(1)
    s.nextTab()
    expect(s.activeRepoId).toBe(1)
  })

  it('localStorage persist — tabs 변경 시 저장', async () => {
    const s = useReposStore()
    s.openTab(1)
    s.openTab(2)
    await new Promise((r) => setTimeout(r, 0))
    const raw = localStorage.getItem('git-fried.repo-tabs.v1')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.tabs).toEqual([1, 2])
    expect(parsed.active).toBe(2)
  })

  it('loadPersisted — invalid JSON → 빈 상태 fallback', () => {
    localStorage.setItem('git-fried.repo-tabs.v1', '{not valid json')
    setActivePinia(createPinia())
    const s = useReposStore()
    expect(s.tabs).toEqual([])
    expect(s.activeRepoId).toBe(null)
  })

  it('loadPersisted — active 가 tabs 에 없으면 첫 탭 또는 null', () => {
    localStorage.setItem('git-fried.repo-tabs.v1', JSON.stringify({ tabs: [10, 20], active: 999 }))
    setActivePinia(createPinia())
    const s = useReposStore()
    expect(s.tabs).toEqual([10, 20])
    expect(s.activeRepoId).toBe(10) // active 999 무효 → 첫 탭
  })
})
