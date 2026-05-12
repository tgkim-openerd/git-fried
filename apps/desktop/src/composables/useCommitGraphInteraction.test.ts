// Sprint c78 — Pattern 9 sister Interaction smoke (small, c48 Wave B-2).
//
// 회귀 보호: factory 호출 + 단일 export (onRowDblClick / onRowContextMenu / formatDate).
// emit / commitActions buildItems / ctxMenu wiring 검증 — buildItems 깊은 흐름은 useCommitActions 별도 검증.
import { describe, expect, it, vi } from 'vitest'
import { ref, shallowRef } from 'vue'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { useCommitGraphInteraction } from './useCommitGraphInteraction'
import type { GraphRow } from '@/api/git'
// c79 ARCH-006 — sister test 5 family ContextMenuExpose import path 통일 (component re-export).
import type { ContextMenuExpose, ContextMenuItem } from '@/components/ContextMenu.vue'

function setup<T>(fn: () => T): T {
  const i18n = createI18n({
    legacy: false,
    locale: 'ko',
    messages: { ko: { time: { just: '방금' } }, en: { time: { just: 'now' } } },
  })
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

const sampleRow: GraphRow = {
  commit: {
    sha: 'abcdef1234',
    shortSha: 'abcdef1',
    parentShas: [],
    authorName: '김태길',
    authorEmail: 'tg@example.com',
    authorAt: 1_700_000_000,
    committerAt: 1_700_000_000,
    subject: 'subject line',
    body: '',
    signed: false,
    refs: [],
  },
  lane: 0,
  parentLanes: [],
  crossingLanes: [],
  isMerge: false,
}

describe('useCommitGraphInteraction', () => {
  it('factory + onRowContextMenu — ctxMenu.openAt 호출', () => {
    const openAt = vi.fn()
    const ctxMenu = shallowRef<ContextMenuExpose | null>({
      openAt,
      close: vi.fn(),
    } as unknown as ContextMenuExpose)
    const buildItems = vi.fn().mockReturnValue([] as ContextMenuItem[])
    const emit = vi.fn() as unknown as Parameters<typeof useCommitGraphInteraction>[0]['emit']
    const selectedSha = ref<string | null>(null)

    const { onRowContextMenu, onRowDblClick, formatDate } = setup(() =>
      useCommitGraphInteraction({
        selectedSha,
        ctxMenu,
        commitActions: { buildItems },
        emit,
      }),
    )

    expect(typeof onRowDblClick).toBe('function')
    expect(typeof formatDate).toBe('function')
    expect(typeof formatDate(1_700_000_000)).toBe('string')

    const ev = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as MouseEvent
    onRowContextMenu(ev, sampleRow)
    expect(buildItems).toHaveBeenCalledWith('abcdef1234', expect.any(Object))
    expect(openAt).toHaveBeenCalledOnce()
  })
})
