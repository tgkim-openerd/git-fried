// Sprint c78 — Pattern 9 sister Interaction smoke (small).
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { useSubmoduleInteraction } from './useSubmoduleInteraction'
import type { SubmoduleEntry } from '@/api/git'
import type { ContextMenuExpose } from '@/components/ContextMenu.vue'

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

const sampleSub: SubmoduleEntry = {
  path: 'vendor/lib',
  sha: 'abc1234567',
  status: 'initialized',
  flag: ' ',
}

describe('useSubmoduleInteraction', () => {
  it('factory exports + onSubmoduleContextMenu wiring', () => {
    const openAt = vi.fn()
    const ctxMenu = ref<ContextMenuExpose | null>({
      openAt,
      close: vi.fn(),
    } as unknown as ContextMenuExpose)

    const result = setup(() =>
      useSubmoduleInteraction({ ctxMenu, onInvalidate: vi.fn() }),
    )
    expect(typeof result.openAsRepo).toBe('function')
    expect(typeof result.initOne).toBe('function')
    expect(typeof result.copyPath).toBe('function')
    expect(typeof result.copySha).toBe('function')

    const ev = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as MouseEvent
    result.onSubmoduleContextMenu(ev, sampleSub)
    expect(openAt).toHaveBeenCalledOnce()
  })
})
