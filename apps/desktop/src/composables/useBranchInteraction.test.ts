// Sprint c78 — Pattern 9 sister Interaction smoke (delegate sister 변형).
//
// 회귀 보호: factory 호출 + 단일 export (onBranchContextMenu) + ev.preventDefault 호출.
// 깊은 흐름 (buildItems delegate / hide/solo state) 은 useBranchActions / useHiddenRefs 별도 검증.
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { useBranchInteraction } from './useBranchInteraction'
import type { BranchInfo } from '@/api/git'
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

const sampleBranch: BranchInfo = {
  name: 'feat/x',
  kind: 'local',
  isHead: false,
  upstream: null,
  lastCommitSha: null,
  lastCommitSubject: null,
  ahead: 0,
  behind: 0,
}

describe('useBranchInteraction', () => {
  it('factory + onBranchContextMenu wiring + ev guards', () => {
    const openAt = vi.fn()
    const ctxMenu = ref<ContextMenuExpose | null>({
      openAt,
      close: vi.fn(),
    } as unknown as ContextMenuExpose)

    const { onBranchContextMenu } = setup(() => useBranchInteraction({ ctxMenu, repoId: () => 1 }))

    const ev = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as MouseEvent
    onBranchContextMenu(ev, sampleBranch)

    expect(ev.preventDefault).toHaveBeenCalledOnce()
    expect(ev.stopPropagation).toHaveBeenCalledOnce()
    expect(openAt).toHaveBeenCalledOnce()
  })
})
