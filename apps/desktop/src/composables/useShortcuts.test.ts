import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'

// useShortcuts — module-level bus + window keydown listener.
// scope: dispatchShortcut + useShortcut subscribe/unsubscribe lifecycle 만 cover.
// 키보드 이벤트 매트릭스 (35+) 는 본 unit test 의 scope 외 — integration 영역.

async function importFresh() {
  vi.resetModules()
  return await import('./useShortcuts')
}

describe('useShortcuts', () => {
  beforeEach(() => {
    // bus 격리 위해 매 test 마다 fresh module
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('dispatchShortcut — 등록 0개 면 false 반환', async () => {
    const { dispatchShortcut } = await importFresh()
    expect(dispatchShortcut('fetch')).toBe(false)
  })

  it('useShortcut + dispatchShortcut — 등록 후 발화', async () => {
    const m = await importFresh()
    const handler = vi.fn()
    const C = defineComponent({
      setup() {
        m.useShortcut('fetch', handler)
        return {}
      },
      render() {
        return h('div')
      },
    })
    const w = mount(C)
    expect(m.dispatchShortcut('fetch')).toBe(true)
    expect(handler).toHaveBeenCalledTimes(1)
    w.unmount() // onUnmounted 실행
    expect(m.dispatchShortcut('fetch')).toBe(false) // 이미 unsubscribe
  })

  it('동일 action 다중 핸들러 — 모두 호출', async () => {
    const m = await importFresh()
    const h1 = vi.fn()
    const h2 = vi.fn()
    const C = defineComponent({
      setup() {
        m.useShortcut('pull', h1)
        m.useShortcut('pull', h2)
        return {}
      },
      render() {
        return h('div')
      },
    })
    mount(C)
    m.dispatchShortcut('pull')
    expect(h1).toHaveBeenCalledTimes(1)
    expect(h2).toHaveBeenCalledTimes(1)
  })

  it('handler throw — 다른 handler 영향 없음 (silent ignore)', async () => {
    const m = await importFresh()
    const h1 = vi.fn(() => {
      throw new Error('boom')
    })
    const h2 = vi.fn()
    const C = defineComponent({
      setup() {
        m.useShortcut('push', h1)
        m.useShortcut('push', h2)
        return {}
      },
      render() {
        return h('div')
      },
    })
    mount(C)
    expect(() => m.dispatchShortcut('push')).not.toThrow()
    expect(h1).toHaveBeenCalled()
    expect(h2).toHaveBeenCalled()
  })

  it('컴포넌트 unmount 시 자동 cleanup', async () => {
    const m = await importFresh()
    const handler = vi.fn()
    const C = defineComponent({
      setup() {
        m.useShortcut('help', handler)
        return {}
      },
      render() {
        return h('div')
      },
    })
    const w = mount(C)
    m.dispatchShortcut('help')
    expect(handler).toHaveBeenCalledTimes(1)
    w.unmount()
    handler.mockClear()
    m.dispatchShortcut('help')
    expect(handler).not.toHaveBeenCalled()
  })

  it('등록 없는 action 도 dispatchShortcut 가 throw 안 함', async () => {
    const { dispatchShortcut } = await importFresh()
    expect(() => dispatchShortcut('zoomReset')).not.toThrow()
    expect(dispatchShortcut('zoomReset')).toBe(false)
  })
})
