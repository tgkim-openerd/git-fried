// Sprint c53 — useRemoteInteraction (RemoteManageModal 추출) 회귀 보호.
//
// 핵심 검증:
//   - onRemoteContextMenu 가 ctxMenu.openAt 을 호출 + items 길이 6 (4 actions + 2 dividers)
//   - 첫 항목 = Fetch All, 4번째(divider 후) = Rename, 5번째 = Change URL, 7번째 = Remove(destructive)
//   - removeRemoteSafely 는 confirm 흡수 후 onRemove 콜백 호출 (confirmDialog mock 으로 검증)
//
// confirmDialog 의 깊은 흐름은 useConfirm 자체 spec — 여기서는 wiring 만.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { useRemoteInteraction } from './useRemoteInteraction'
import type { RemoteInfo } from '@/api/git'
import type { ContextMenuExpose } from '@/components/ContextMenu.vue'

vi.mock('@/composables/useConfirm', () => ({
  confirmDialog: vi.fn(),
}))
import { confirmDialog } from '@/composables/useConfirm'
const mockedConfirm = confirmDialog as unknown as ReturnType<typeof vi.fn>

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

const sampleRemote: RemoteInfo = {
  name: 'origin',
  fetchUrl: 'https://example.com/repo.git',
  pushUrl: 'https://example.com/repo.git',
}

describe('useRemoteInteraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('onRemoteContextMenu — 6 items (4 actions + 2 dividers) 빌드 후 ctxMenu.openAt 호출', () => {
    const openAt = vi.fn()
    const ctxMenu = ref<ContextMenuExpose | null>({
      openAt,
      close: vi.fn(),
    } as unknown as ContextMenuExpose)

    const { onRemoteContextMenu } = setup(() =>
      useRemoteInteraction({
        ctxMenu,
        onFetchAll: vi.fn(),
        onStartRename: vi.fn(),
        onStartUrlChange: vi.fn(),
        onRemove: vi.fn(),
      }),
    )

    const ev = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as MouseEvent
    onRemoteContextMenu(ev, sampleRemote)

    expect(ev.preventDefault).toHaveBeenCalled()
    expect(ev.stopPropagation).toHaveBeenCalled()
    expect(openAt).toHaveBeenCalledOnce()
    const items = openAt.mock.calls[0]![1] as Array<{
      label?: string
      divider?: boolean
      destructive?: boolean
    }>
    // Fetch All / divider / Rename / Change URL / divider / Remove = 6
    expect(items).toHaveLength(6)
    expect(items[1]!.divider).toBe(true)
    expect(items[4]!.divider).toBe(true)
    expect(items[5]!.destructive).toBe(true)
  })

  it('context menu 액션 click — 적절한 caller 콜백 호출', () => {
    const onFetchAll = vi.fn()
    const onStartRename = vi.fn()
    const onStartUrlChange = vi.fn()
    const openAt = vi.fn()
    const ctxMenu = ref<ContextMenuExpose | null>({
      openAt,
      close: vi.fn(),
    } as unknown as ContextMenuExpose)

    const { onRemoteContextMenu } = setup(() =>
      useRemoteInteraction({
        ctxMenu,
        onFetchAll,
        onStartRename,
        onStartUrlChange,
        onRemove: vi.fn(),
      }),
    )

    const ev = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as MouseEvent
    onRemoteContextMenu(ev, sampleRemote)
    const items = openAt.mock.calls[0]![1] as Array<{ action?: () => void }>

    items[0]!.action!() // Fetch All
    items[2]!.action!() // Rename
    items[3]!.action!() // Change URL

    expect(onFetchAll).toHaveBeenCalledOnce()
    expect(onStartRename).toHaveBeenCalledWith('origin')
    expect(onStartUrlChange).toHaveBeenCalledWith(sampleRemote)
  })

  it('removeRemoteSafely — confirm 통과 시 onRemove 호출', async () => {
    mockedConfirm.mockResolvedValueOnce(true)
    const onRemove = vi.fn()

    const { removeRemoteSafely } = setup(() =>
      useRemoteInteraction({
        ctxMenu: ref(null),
        onFetchAll: vi.fn(),
        onStartRename: vi.fn(),
        onStartUrlChange: vi.fn(),
        onRemove,
      }),
    )
    await removeRemoteSafely('origin')
    expect(mockedConfirm).toHaveBeenCalledOnce()
    expect(onRemove).toHaveBeenCalledWith('origin')
  })

  it('removeRemoteSafely — confirm 거부 시 onRemove 미호출', async () => {
    mockedConfirm.mockResolvedValueOnce(false)
    const onRemove = vi.fn()

    const { removeRemoteSafely } = setup(() =>
      useRemoteInteraction({
        ctxMenu: ref(null),
        onFetchAll: vi.fn(),
        onStartRename: vi.fn(),
        onStartUrlChange: vi.fn(),
        onRemove,
      }),
    )
    await removeRemoteSafely('origin')
    expect(mockedConfirm).toHaveBeenCalledOnce()
    expect(onRemove).not.toHaveBeenCalled()
  })
})
