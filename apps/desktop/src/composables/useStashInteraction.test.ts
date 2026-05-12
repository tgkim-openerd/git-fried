// Sprint c78 — Pattern 9 sister Interaction smoke (small).
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { useStashInteraction } from './useStashInteraction'
import type { StashEntry } from '@/api/git'
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

const sampleStash: StashEntry = {
  index: 0,
  sha: 'abc1234567',
  message: 'WIP on main',
  branch: 'main',
  createdAt: 1_700_000_000,
}

describe('useStashInteraction', () => {
  it('factory + onStashContextMenu — ctxMenu.openAt 호출 + 6 items', () => {
    const openAt = vi.fn()
    const ctxMenu = ref<ContextMenuExpose | null>({
      openAt,
      close: vi.fn(),
    } as unknown as ContextMenuExpose)

    const { onStashContextMenu } = setup(() =>
      useStashInteraction({
        repoId: () => 1,
        ctxMenu,
        onApply: vi.fn(),
        onPop: vi.fn(),
        onDrop: vi.fn(),
      }),
    )

    const ev = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as MouseEvent
    onStashContextMenu(ev, sampleStash)

    expect(ev.preventDefault).toHaveBeenCalledOnce()
    expect(openAt).toHaveBeenCalledOnce()
    const items = openAt.mock.calls[0]![1] as Array<{ label?: string; divider?: boolean }>
    // apply / pop / divider / copy / divider / drop = 6
    expect(items).toHaveLength(6)
    expect(items[2]!.divider).toBe(true)
    expect(items[4]!.divider).toBe(true)
  })
})
