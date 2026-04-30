import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { AiProbe } from '@/api/git'

const probesRef = ref<AiProbe[] | undefined>(undefined)

vi.mock('@tanstack/vue-query', () => ({
  useQuery: () => ({
    data: probesRef,
    isFetching: ref(false),
    refetch: vi.fn(),
  }),
}))

vi.mock('@/api/git', () => ({
  aiDetectClis: vi.fn(),
}))

vi.mock('@/api/queryClient', () => ({
  STALE_TIME: { STATIC: 0, NORMAL: 0, REALTIME: 0 },
}))

const mockNotify = vi.fn()
vi.mock('./useNotification', () => ({
  useNotification: () => ({ notify: mockNotify }),
}))

// Sprint c33 — confirmAiSend 가 confirmDialog 로 마이그레이션됨. mock 으로 직접 결과 제어.
const mockConfirmDialog = vi.fn()
vi.mock('@/composables/useConfirm', () => ({
  confirmDialog: (opts: unknown) => mockConfirmDialog(opts),
}))

vi.mock('@/i18n', () => ({
  i18n: {
    global: {
      t: (key: string) => key,
    },
  },
}))

import { confirmAiSend, notifyAiDone, useAiCli } from './useAiCli'

describe('useAiCli', () => {
  beforeEach(() => {
    probesRef.value = undefined
    mockNotify.mockClear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('probes undefined → available null + installedClis 빈 배열', () => {
    const { available, installedClis } = useAiCli()
    expect(available.value).toBe(null)
    expect(installedClis.value).toEqual([])
  })

  it('claude 설치 → available "claude"', () => {
    probesRef.value = [
      { cli: 'claude', installed: true } as AiProbe,
      { cli: 'codex', installed: false } as AiProbe,
    ]
    const { available, installedClis } = useAiCli()
    expect(available.value).toBe('claude')
    expect(installedClis.value).toEqual(['claude'])
  })

  it('claude 미설치 + codex 설치 → available "codex"', () => {
    probesRef.value = [
      { cli: 'claude', installed: false } as AiProbe,
      { cli: 'codex', installed: true } as AiProbe,
    ]
    const { available, installedClis } = useAiCli()
    expect(available.value).toBe('codex')
    expect(installedClis.value).toEqual(['codex'])
  })

  it('둘 다 설치 → claude 우선', () => {
    probesRef.value = [
      { cli: 'claude', installed: true } as AiProbe,
      { cli: 'codex', installed: true } as AiProbe,
    ]
    const { available, installedClis } = useAiCli()
    expect(available.value).toBe('claude')
    expect(installedClis.value).toEqual(['claude', 'codex'])
  })

  it('둘 다 미설치 → available null', () => {
    probesRef.value = [
      { cli: 'claude', installed: false } as AiProbe,
      { cli: 'codex', installed: false } as AiProbe,
    ]
    const { available, installedClis } = useAiCli()
    expect(available.value).toBe(null)
    expect(installedClis.value).toEqual([])
  })

  it('confirmAiSend — confirmDialog resolve true 시 true', async () => {
    mockConfirmDialog.mockResolvedValueOnce(true)
    await expect(confirmAiSend()).resolves.toBe(true)
    expect(mockConfirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'confirm.aiSendTitle',
        message: 'confirm.aiSendMessage',
        danger: true,
      }),
    )
  })

  it('confirmAiSend — confirmDialog resolve false 시 false', async () => {
    mockConfirmDialog.mockResolvedValueOnce(false)
    await expect(confirmAiSend()).resolves.toBe(false)
  })

  it('notifyAiDone — title 에 ✨ prefix + notify 호출', () => {
    notifyAiDone('test', 'body')
    expect(mockNotify).toHaveBeenCalledWith('✨ test', 'body')
  })
})
