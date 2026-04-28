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

  it('confirmAiSend — window.confirm true 시 true', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    expect(confirmAiSend()).toBe(true)
  })

  it('confirmAiSend — window.confirm false 시 false', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    expect(confirmAiSend()).toBe(false)
  })

  it('notifyAiDone — title 에 ✨ prefix + notify 호출', () => {
    notifyAiDone('test', 'body')
    expect(mockNotify).toHaveBeenCalledWith('✨ test', 'body')
  })
})
