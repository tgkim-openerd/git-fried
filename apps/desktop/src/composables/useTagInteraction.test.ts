// Sprint c52 — useTagInteraction (TagPanel 추출) 회귀 보호.
//
// 핵심 검증:
//   - onTagContextMenu 가 ctxMenu.openAt 을 호출 + items 길이 7
//   - copyTagSha 가 navigator.clipboard.writeText 호출
//   - repoId null 시 checkoutTag/createBranchFromTag noop (조기 return)
//
// confirmDialog/promptDialog/switchBranch/createBranch 의 깊은 흐름은 별도 composable
// (useConfirm / api/git) 에서 검증 — 여기서는 wiring 만.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { useTagInteraction } from './useTagInteraction'
import type { TagInfo } from '@/api/git'
import type { ContextMenuExpose } from '@/components/ContextMenu.vue'
import { promptDialog } from '@/composables/useConfirm'

// plan #45 M2 — annotateTag 무효화 테스트용. api/useConfirm 의 user-facing side effect 만
// stub (기존 테스트는 repoId null 조기 return / contextmenu / clipboard 라 영향 없음).
vi.mock('@/api/git', () => ({
  annotateExistingTag: vi.fn().mockResolvedValue(undefined),
  createBranch: vi.fn().mockResolvedValue(undefined),
  switchBranch: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/composables/useConfirm', () => ({
  promptDialog: vi.fn(),
  confirmDialog: vi.fn().mockResolvedValue(false),
}))

// vue-query / pinia / i18n 환경 setup helper — useToast / useInvalidateRepoQueries 가
// queryClient 를 inject 해야 함.
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
    {
      global: {
        plugins: [i18n, [VueQueryPlugin, { queryClient: qc }]],
      },
    },
  )
  return result!
}

const sampleTag: TagInfo = {
  name: 'v1.0.0',
  annotated: false,
  commitSha: 'abc123def456',
  taggerName: null,
  taggerAt: null,
  subject: null,
}

describe('useTagInteraction', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('onTagContextMenu — 8 items 빌드 후 ctxMenu.openAt 호출', () => {
    const openAt = vi.fn()
    const ctxMenu = ref<ContextMenuExpose | null>({
      openAt,
      close: vi.fn(),
    } as unknown as ContextMenuExpose)

    const { onTagContextMenu } = setup(() =>
      useTagInteraction({
        repoId: () => 1,
        ctxMenu,
        onPush: vi.fn(),
        onDelete: vi.fn(),
        onDeleteRemote: vi.fn(),
      }),
    )

    const ev = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as MouseEvent
    onTagContextMenu(ev, sampleTag)

    expect(openAt).toHaveBeenCalledOnce()
    const items = openAt.mock.calls[0]![1] as Array<{ label?: string; divider?: boolean }>
    // SB-033 (Sprint c95, 2026-05-18) — annotate 추가로 9 items:
    // 3 actions (push/checkout/createBranch) + 1 annotate + divider + 1 copy +
    // divider + 2 delete = 9
    expect(items).toHaveLength(9)
    expect(items[0]!.label).toBeTruthy()
    expect(items[4]!.divider).toBe(true) // first divider after 3 actions + 1 annotate
    expect(items[6]!.divider).toBe(true) // second divider before delete pair
  })

  it('copyTagSha — clipboard.writeText 호출 (commitSha 8자)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    // happy-dom 의 navigator.clipboard 는 getter 라 Object.assign 불가 → defineProperty.
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    const { copyTagSha } = setup(() =>
      useTagInteraction({
        repoId: () => 1,
        ctxMenu: ref(null),
        onPush: vi.fn(),
        onDelete: vi.fn(),
        onDeleteRemote: vi.fn(),
      }),
    )
    await copyTagSha(sampleTag)
    expect(writeText).toHaveBeenCalledWith('abc123def456')
  })

  it('repoId null 시 checkoutTag/createBranchFromTag noop', async () => {
    const { checkoutTag, createBranchFromTag } = setup(() =>
      useTagInteraction({
        repoId: () => null,
        ctxMenu: ref(null),
        onPush: vi.fn(),
        onDelete: vi.fn(),
        onDeleteRemote: vi.fn(),
      }),
    )
    // confirm/prompt 가 호출되지 않아야 함 — 조기 return
    await expect(checkoutTag(sampleTag)).resolves.toBeUndefined()
    await expect(createBranchFromTag(sampleTag)).resolves.toBeUndefined()
  })

  // plan #45 M2 — annotateTag 는 tags 뿐 아니라 graph + log 도 무효화해야 함
  // (CommitGraph 의 tag ring / CommitRefPill 이 stale 되지 않도록).
  it('annotateTag — graph+log+tags 무효화 (M2)', async () => {
    vi.mocked(promptDialog).mockResolvedValue('annotated message')
    const i18n = createI18n({ legacy: false, locale: 'ko', messages: { ko: {}, en: {} } })
    const qc = new QueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    setActivePinia(createPinia())
    let api!: ReturnType<typeof useTagInteraction>
    mount(
      {
        setup() {
          api = useTagInteraction({
            repoId: () => 1,
            ctxMenu: ref(null),
            onPush: vi.fn(),
            onDelete: vi.fn(),
            onDeleteRemote: vi.fn(),
          })
          return () => null
        },
      },
      { global: { plugins: [i18n, [VueQueryPlugin, { queryClient: qc }]] } },
    )

    await api.annotateTag({ ...sampleTag, commitSha: 'abc123def456' })

    const keys = invalidateSpy.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey)
    expect(keys).toContainEqual(['tags', 1])
    expect(keys).toContainEqual(['graph', 1])
    expect(keys).toContainEqual(['log', 1])
  })
})
