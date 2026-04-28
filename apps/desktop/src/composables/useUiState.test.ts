import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// useUiState 가 module-level reactive state (singleton). test 마다 vi.resetModules + dynamic import 로 격리.

async function importFresh() {
  vi.resetModules()
  const mod = await import('./useUiState')
  return mod.useUiState()
}

describe('useUiState', () => {
  beforeEach(() => {
    localStorage.clear()
    if (typeof document !== 'undefined') {
      document.documentElement.style.fontSize = ''
    }
  })
  afterEach(() => {
    localStorage.clear()
  })

  it('default zoom 14, sidebar/detail visible', async () => {
    const ui = await importFresh()
    expect(ui.zoomPx.value).toBe(14)
    expect(ui.sidebarVisible.value).toBe(true)
    expect(ui.detailVisible.value).toBe(true)
  })

  it('default zoom applies html font-size on import', async () => {
    await importFresh()
    expect(document.documentElement.style.fontSize).toBe('14px')
  })

  it('zoomIn / zoomOut / zoomReset 동작 + clamp [10..22]', async () => {
    const ui = await importFresh()
    ui.zoomIn() // 14 → 15
    expect(ui.zoomPx.value).toBe(15)
    ui.zoomReset()
    expect(ui.zoomPx.value).toBe(14)
    ui.zoomOut() // 14 → 13
    expect(ui.zoomPx.value).toBe(13)
    // clamp 하한
    for (let i = 0; i < 10; i++) ui.zoomOut()
    expect(ui.zoomPx.value).toBe(10)
    // clamp 상한
    for (let i = 0; i < 20; i++) ui.zoomIn()
    expect(ui.zoomPx.value).toBe(22)
  })

  it('zoomPx 변경 시 localStorage 저장', async () => {
    const ui = await importFresh()
    ui.zoomIn()
    // watch 동기화 — Vue 의 watcher 가 nextTick 내에 발화
    await new Promise((r) => setTimeout(r, 0))
    expect(localStorage.getItem('git-fried.zoom-px')).toBe('15')
  })

  it('toggleSidebar / toggleDetail 동작 + persist', async () => {
    const ui = await importFresh()
    ui.toggleSidebar()
    expect(ui.sidebarVisible.value).toBe(false)
    await new Promise((r) => setTimeout(r, 0))
    expect(localStorage.getItem('git-fried.sidebar-visible')).toBe('0')
    ui.toggleDetail()
    expect(ui.detailVisible.value).toBe(false)
    await new Promise((r) => setTimeout(r, 0))
    expect(localStorage.getItem('git-fried.detail-visible')).toBe('0')
  })

  it('localStorage stored value 우선 적용', async () => {
    localStorage.setItem('git-fried.zoom-px', '18')
    localStorage.setItem('git-fried.sidebar-visible', '0')
    localStorage.setItem('git-fried.detail-visible', '0')
    const ui = await importFresh()
    expect(ui.zoomPx.value).toBe(18)
    expect(ui.sidebarVisible.value).toBe(false)
    expect(ui.detailVisible.value).toBe(false)
  })

  it('localStorage 의 invalid zoom 값 → default 14', async () => {
    localStorage.setItem('git-fried.zoom-px', 'banana')
    const ui = await importFresh()
    expect(ui.zoomPx.value).toBe(14)
  })

  it('localStorage 의 zoom 이 limit 초과 시 clamp', async () => {
    localStorage.setItem('git-fried.zoom-px', '999')
    const ui = await importFresh()
    expect(ui.zoomPx.value).toBe(22)
  })
})
