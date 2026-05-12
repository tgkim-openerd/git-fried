// Sprint c78 — Pattern 9 sister Interaction smoke (small).
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { useRepoTabInteraction } from './useRepoTabInteraction'

function setup<T>(fn: () => T): T {
  const i18n = createI18n({ legacy: false, locale: 'ko', messages: { ko: {}, en: {} } })
  const qc = new QueryClient()
  setActivePinia(createPinia())
  let result: T
  mount(
    {
      setup() {
        result = fn()
        return () => null
      },
    },
    { global: { plugins: [i18n, [VueQueryPlugin, { queryClient: qc }]] } },
  )
  return result!
}

describe('useRepoTabInteraction', () => {
  it('factory exports + onTabContextMenu / onProjectContextMenu / moveTab', () => {
    const openMenu = vi.fn()
    const result = setup(() => useRepoTabInteraction({ openMenu }))

    expect(typeof result.moveTab).toBe('function')
    expect(typeof result.onTabContextMenu).toBe('function')
    expect(typeof result.onProjectContextMenu).toBe('function')

    // tab list 가 비었을 때 onTabContextMenu 는 ev.preventDefault + openMenu 호출 (items 는 있음).
    const ev = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as MouseEvent
    result.onTabContextMenu(ev, 999)
    expect(ev.preventDefault).toHaveBeenCalledOnce()
    expect(openMenu).toHaveBeenCalledOnce()
  })
})
