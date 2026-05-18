import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// useUserSettings — module-level reactive state. vi.resetModules + dynamic import.

async function importFresh() {
  vi.resetModules()
  return await import('./useUserSettings')
}

describe('useUserSettings', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
  })

  it('default general settings', async () => {
    const { useGeneralSettings } = await importFresh()
    const g = useGeneralSettings()
    expect(g.value.autoFetchIntervalMin).toBe(0)
    expect(g.value.autoPruneOnFetch).toBe(false)
    expect(g.value.defaultBranch).toBe('main')
    expect(g.value.rememberTabs).toBe(true)
    expect(g.value.autoUpdateSubmodules).toBe(false)
    expect(g.value.conflictDetection).toBe(true)
  })

  it('default ui settings', async () => {
    const { useUiSettingsStore } = await importFresh()
    const u = useUiSettingsStore()
    expect(u.value.dateLocale).toBe('auto')
    expect(u.value.hideLaunchpad).toBe(false)
    expect(u.value.avatarStyle).toBe('initial')
  })

  it('localStorage stored partial general — defaults 와 merge', async () => {
    localStorage.setItem('git-fried.general.v1', JSON.stringify({ autoFetchIntervalMin: 5 }))
    const { useGeneralSettings } = await importFresh()
    const g = useGeneralSettings()
    expect(g.value.autoFetchIntervalMin).toBe(5)
    expect(g.value.defaultBranch).toBe('main') // default 보존
  })

  it('localStorage invalid JSON → default fallback', async () => {
    localStorage.setItem('git-fried.general.v1', '{not valid')
    const { useGeneralSettings } = await importFresh()
    const g = useGeneralSettings()
    expect(g.value.autoFetchIntervalMin).toBe(0)
  })

  it('general 변경 시 deep watch 로 localStorage persist', async () => {
    const { useGeneralSettings } = await importFresh()
    const g = useGeneralSettings()
    g.value.autoFetchIntervalMin = 10
    await new Promise((r) => setTimeout(r, 0))
    const raw = localStorage.getItem('git-fried.general.v1')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!).autoFetchIntervalMin).toBe(10)
  })

  it('ui 변경 시 persist (dateLocale)', async () => {
    const { useUiSettingsStore } = await importFresh()
    const u = useUiSettingsStore()
    u.value.dateLocale = 'ko-KR'
    await new Promise((r) => setTimeout(r, 0))
    expect(JSON.parse(localStorage.getItem('git-fried.ui.v1')!).dateLocale).toBe('ko-KR')
  })

  it('formatDateLocalized — auto = OS 기본 (undefined locale)', async () => {
    const { formatDateLocalized } = await importFresh()
    const result = formatDateLocalized(0) // 1970-01-01 UTC
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('formatDateLocalized — ko-KR locale 적용', async () => {
    localStorage.setItem('git-fried.ui.v1', JSON.stringify({ dateLocale: 'ko-KR' }))
    const { formatDateLocalized } = await importFresh()
    const result = formatDateLocalized(1640000000) // 2021-12-20 ish
    expect(typeof result).toBe('string')
  })

  it('formatDateLocalized — custom options', async () => {
    const { formatDateLocalized } = await importFresh()
    const result = formatDateLocalized(0, { year: 'numeric' })
    expect(result).toContain('1970')
  })

  // SB-050 (UltraPlan v0.4 sidebar microgap Phase 7-A, 2026-05-18) — Codex 발견
  // shallow merge → deep merge 회귀 차단. nested 객체 default 키 보존.
  describe('SB-050 deep merge — nested object default 보존', () => {
    it('ui miniSidebarSections partial → 나머지 6 키 default 보존', async () => {
      // localStorage 에 tag:false 만 저장된 상태 → 6 키 default true 유지 필요.
      localStorage.setItem(
        'git-fried.ui.v1',
        JSON.stringify({ miniSidebarSections: { tag: false } }),
      )
      const { useUiSettingsStore } = await importFresh()
      const u = useUiSettingsStore()
      expect(u.value.miniSidebarSections.tag).toBe(false) // override
      expect(u.value.miniSidebarSections.branch).toBe(true) // default 보존 ✓
      expect(u.value.miniSidebarSections.remote).toBe(true)
      expect(u.value.miniSidebarSections.worktree).toBe(true)
      expect(u.value.miniSidebarSections.stash).toBe(true)
      expect(u.value.miniSidebarSections.submodule).toBe(true)
      expect(u.value.miniSidebarSections.pr).toBe(true)
    })

    it('ui 빈 객체 → 모든 default 보존', async () => {
      localStorage.setItem('git-fried.ui.v1', JSON.stringify({}))
      const { useUiSettingsStore } = await importFresh()
      const u = useUiSettingsStore()
      expect(u.value.dateLocale).toBe('auto')
      expect(u.value.hideLaunchpad).toBe(false)
      expect(u.value.avatarStyle).toBe('initial')
      expect(u.value.miniSidebarSections.branch).toBe(true)
      expect(u.value.externalEditor).toBe('none')
    })

    it('general partial top-level → default 보존', async () => {
      localStorage.setItem('git-fried.general.v1', JSON.stringify({ autoFetchIntervalMin: 15 }))
      const { useGeneralSettings } = await importFresh()
      const g = useGeneralSettings()
      expect(g.value.autoFetchIntervalMin).toBe(15) // override
      expect(g.value.defaultBranch).toBe('main') // default 보존
      expect(g.value.conflictDetection).toBe(true)
      expect(g.value.rememberTabs).toBe(true)
    })

    it('ui nested deep override + top-level override 동시', async () => {
      localStorage.setItem(
        'git-fried.ui.v1',
        JSON.stringify({
          dateLocale: 'en-US',
          miniSidebarSections: { branch: false, pr: false },
        }),
      )
      const { useUiSettingsStore } = await importFresh()
      const u = useUiSettingsStore()
      expect(u.value.dateLocale).toBe('en-US') // top-level override
      expect(u.value.miniSidebarSections.branch).toBe(false) // nested override
      expect(u.value.miniSidebarSections.pr).toBe(false)
      expect(u.value.miniSidebarSections.remote).toBe(true) // nested default 보존
      expect(u.value.miniSidebarSections.tag).toBe(true)
    })
  })
})
