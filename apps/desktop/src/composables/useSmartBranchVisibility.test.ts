// SB-014 (Sprint c95, 2026-05-18) — Smart Branch Visibility composable 회귀 차단.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import type { BranchInfo } from '@/api/git'

function makeBranch(name: string, opts: Partial<BranchInfo> = {}): BranchInfo {
  return {
    name,
    kind: 'local',
    isHead: false,
    upstream: null,
    ahead: 0,
    behind: 0,
    ...opts,
  } as BranchInfo
}

async function importFresh() {
  vi.resetModules()
  return await import('./useSmartBranchVisibility')
}

describe('useSmartBranchVisibility', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
  })

  it('enabled=false (default) → 모든 ref smart visible (no-op)', async () => {
    const { useSmartBranchVisibility } = await importFresh()
    const branches = computed(() => [
      makeBranch('feat/foo'),
      makeBranch('feat/bar'),
      makeBranch('main', { isHead: true }),
    ])
    const api = useSmartBranchVisibility(branches)
    expect(api.enabled.value).toBe(false)
    expect(api.isSmartVisible('feat/foo')).toBe(true)
    expect(api.isSmartVisible('feat/bar')).toBe(true)
    expect(api.isSmartVisible('any')).toBe(true)
  })

  it('enabled=true + HEAD only → HEAD + auto-detect mergeTarget visible', async () => {
    // smartBranchVisibility.enabled=true 로 사용자 설정.
    localStorage.setItem(
      'git-fried.ui.v1',
      JSON.stringify({ smartBranchVisibility: { enabled: true, mergeTarget: null } }),
    )
    const { useSmartBranchVisibility } = await importFresh()
    const branches = computed(() => [
      makeBranch('feat/foo', { upstream: 'origin/feat/foo', isHead: true }),
      makeBranch('feat/bar'),
      makeBranch('main', { upstream: 'origin/main' }),
      makeBranch('origin/main', { kind: 'remote' } as Partial<BranchInfo>),
      makeBranch('origin/feat/foo', { kind: 'remote' } as Partial<BranchInfo>),
    ])
    const api = useSmartBranchVisibility(branches)
    expect(api.enabled.value).toBe(true)
    expect(api.effectiveTarget.value).toBe('main') // auto-detect
    // HEAD + HEAD upstream + mergeTarget + mergeTarget upstream
    expect(api.isSmartVisible('feat/foo')).toBe(true)
    expect(api.isSmartVisible('origin/feat/foo')).toBe(true)
    expect(api.isSmartVisible('main')).toBe(true)
    expect(api.isSmartVisible('origin/main')).toBe(true)
    // 다른 branch 는 hidden
    expect(api.isSmartVisible('feat/bar')).toBe(false)
  })

  it('mergeTarget 사용자 설정 우선 (auto-detect 무시)', async () => {
    localStorage.setItem(
      'git-fried.ui.v1',
      JSON.stringify({
        smartBranchVisibility: { enabled: true, mergeTarget: 'develop' },
      }),
    )
    const { useSmartBranchVisibility } = await importFresh()
    const branches = computed(() => [
      makeBranch('feat/x', { isHead: true }),
      makeBranch('main'),
      makeBranch('develop'),
    ])
    const api = useSmartBranchVisibility(branches)
    expect(api.effectiveTarget.value).toBe('develop')
    expect(api.isSmartVisible('develop')).toBe(true)
    expect(api.isSmartVisible('main')).toBe(false) // 명시 설정 우선
  })

  it('auto-detect 순서: main → master → develop → trunk', async () => {
    localStorage.setItem(
      'git-fried.ui.v1',
      JSON.stringify({ smartBranchVisibility: { enabled: true, mergeTarget: null } }),
    )
    const { useSmartBranchVisibility } = await importFresh()
    // main 없음, master 있음 → master 선택.
    const branches = computed(() => [
      makeBranch('feat/x', { isHead: true }),
      makeBranch('master'),
      makeBranch('develop'),
    ])
    const api = useSmartBranchVisibility(branches)
    expect(api.effectiveTarget.value).toBe('master')
  })

  it('빈 branches → mergeTarget null + visibleSet empty', async () => {
    localStorage.setItem(
      'git-fried.ui.v1',
      JSON.stringify({ smartBranchVisibility: { enabled: true, mergeTarget: null } }),
    )
    const { useSmartBranchVisibility } = await importFresh()
    const branches = computed(() => [] as BranchInfo[])
    const api = useSmartBranchVisibility(branches)
    expect(api.effectiveTarget.value).toBeNull()
    expect(api.smartVisibleSet.value.size).toBe(0)
    expect(api.isSmartVisible('main')).toBe(false)
  })

  it('HEAD 없음 + mergeTarget auto-detect main 있음 → main 만 visible', async () => {
    localStorage.setItem(
      'git-fried.ui.v1',
      JSON.stringify({ smartBranchVisibility: { enabled: true, mergeTarget: null } }),
    )
    const { useSmartBranchVisibility } = await importFresh()
    // detached HEAD 또는 빈 repo — local branch 만 있지만 isHead 인 것 없음.
    const branches = computed(() => [makeBranch('main'), makeBranch('feat/foo')])
    const api = useSmartBranchVisibility(branches)
    expect(api.effectiveTarget.value).toBe('main')
    expect(api.isSmartVisible('main')).toBe(true)
    expect(api.isSmartVisible('feat/foo')).toBe(false)
  })
})
