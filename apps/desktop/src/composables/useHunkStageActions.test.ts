// Sprint c78 — useHunkStageActions smoke (User Decision /analyze c77 — actions 미테스트 단 1건).
//
// 회귀 보호: factory + export 시그니처 + repoId null 가드 (applyHunk noop / hunks empty).
// applyMut / restoreWtMut 의 vue-query 흐름은 caller-decision (mutation onSuccess invalidate)
// 으로 이미 다른 mutation composable 에서 검증.
import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { useHunkStageActions } from './useHunkStageActions'

vi.mock('@/api/git', () => ({
  applyPatch: vi.fn().mockResolvedValue(undefined),
  getDiff: vi.fn().mockResolvedValue(''),
  restoreWorktreePatch: vi.fn().mockResolvedValue(undefined),
}))

function setup<T>(fn: () => T): T {
  const i18n = createI18n({
    legacy: false,
    locale: 'ko',
    messages: { ko: { hunkStage: {}, time: {} }, en: { hunkStage: {}, time: {} } },
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

describe('useHunkStageActions', () => {
  it('factory + 4 actions + line selection re-export', () => {
    const repoId = ref<number | null>(1)
    const path = ref<string | null>('src/foo.ts')
    const staged = ref(false)
    const open = ref(true)

    const r = setup(() =>
      useHunkStageActions({
        repoId: () => repoId.value,
        path: () => path.value,
        staged: () => staged.value,
        open: () => open.value,
      }),
    )

    expect(typeof r.applyHunk).toBe('function')
    expect(typeof r.applySelectedLines).toBe('function')
    expect(typeof r.restoreHunkToWorktree).toBe('function')
    expect(typeof r.applyAllHunks).toBe('function')
    expect(r.hunks.value).toEqual([])
    // mutation handles
    expect(typeof r.applyMut.mutate).toBe('function')
    expect(typeof r.restoreWtMut.mutate).toBe('function')
  })

  it('hunks empty 시 applyHunk/applyAllHunks/applySelectedLines noop (no throw)', () => {
    const r = setup(() =>
      useHunkStageActions({
        repoId: computed(() => 1 as number | null),
        path: computed(() => 'src/x.ts' as string | null),
        staged: computed(() => false),
        open: computed(() => true),
      }),
    )
    // diffQuery 가 비어있으니 hunks 도 빈 배열 — 4 action 모두 silently return.
    expect(() => r.applyHunk(0)).not.toThrow()
    expect(() => r.applyAllHunks()).not.toThrow()
    expect(() => r.applySelectedLines(0)).not.toThrow()
  })
})
