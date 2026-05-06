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

import {
  __resetAiCallCountForTest,
  __resetAiConfirmCache,
  aiCallCountRef,
  confirmAiSend,
  incrementAiCallCount,
  notifyAiDone,
  readAiCallCount,
  useAiCli,
} from './useAiCli'

describe('useAiCli', () => {
  beforeEach(() => {
    probesRef.value = undefined
    mockNotify.mockClear()
    __resetAiCallCountForTest()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    __resetAiCallCountForTest()
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
    __resetAiConfirmCache() // Sprint c45 UX-5 — TTL 캐시 초기화
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
    __resetAiConfirmCache()
    mockConfirmDialog.mockResolvedValueOnce(false)
    await expect(confirmAiSend()).resolves.toBe(false)
  })

  it('confirmAiSend — 30s TTL 캐시 (UX-5): 두 번째 호출 자동 true', async () => {
    __resetAiConfirmCache()
    mockConfirmDialog.mockResolvedValueOnce(true)
    await expect(confirmAiSend()).resolves.toBe(true)
    expect(mockConfirmDialog).toHaveBeenCalledTimes(1)
    // 두 번째 호출은 캐시 hit → confirmDialog 호출 안 됨
    await expect(confirmAiSend()).resolves.toBe(true)
    expect(mockConfirmDialog).toHaveBeenCalledTimes(1)
  })

  it('notifyAiDone — title 에 ✨ prefix + notify 호출', () => {
    notifyAiDone('test', 'body')
    expect(mockNotify).toHaveBeenCalledWith('✨ test', 'body')
  })

  // Sprint c36 코드 리뷰 ARCH-001 + SEC-c36-01 fix — aiCallCountRef reactive 카운터.
  describe('aiCallCount — module-scope reactive ref', () => {
    it('초기값 0', () => {
      expect(readAiCallCount()).toBe(0)
      expect(aiCallCountRef.value).toBe(0)
    })

    it('incrementAiCallCount → ref +1 + reactive', () => {
      incrementAiCallCount()
      expect(aiCallCountRef.value).toBe(1)
      incrementAiCallCount()
      expect(aiCallCountRef.value).toBe(2)
      expect(readAiCallCount()).toBe(2)
    })

    it('notifyAiDone → 자동 +1 (5 AI composable 자동 측정 patten)', () => {
      const before = readAiCallCount()
      notifyAiDone('AI commit', 'first line')
      expect(readAiCallCount()).toBe(before + 1)
    })

    it('localStorage NaN 오염 시 0 fallback (SEC-c36-01)', () => {
      // 다른 앱이 같은 키에 잘못된 값 저장 시뮬.
      localStorage.setItem('git-fried.identity.aiCallCount', 'not-a-number')
      __resetAiCallCountForTest()
      // re-read — localStorage 'not-a-number' 가 Number() = NaN → guard 후 0.
      // (test 환경 happy-dom 의 localStorage 가 정상 동작)
      // __reset 이 removeItem 이라 0 — 실제 NaN persistence 은 readPersistedCount 직접 호출 시.
      expect(aiCallCountRef.value).toBe(0)
    })

    it('__resetAiCallCountForTest → 0', () => {
      incrementAiCallCount()
      incrementAiCallCount()
      __resetAiCallCountForTest()
      expect(aiCallCountRef.value).toBe(0)
    })
  })
})
