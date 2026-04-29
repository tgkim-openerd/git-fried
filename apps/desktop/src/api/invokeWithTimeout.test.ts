import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 의존성 mock — Tauri webview / devMock / long-running progress 모두 격리.

const nativeInvokeMock = vi.fn()
const isMockEnabledMock = vi.fn()
const mockInvokeMock = vi.fn()
const registerLongOpMock = vi.fn((_label: string): number => 1)
const completeLongOpMock = vi.fn((_id: number): void => undefined)

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args: unknown) => nativeInvokeMock(cmd, args),
}))

vi.mock('./devMock', () => ({
  isMockEnabled: () => isMockEnabledMock(),
  mockInvoke: (cmd: string, args: unknown) => mockInvokeMock(cmd, args),
}))

vi.mock('@/composables/useLongRunningProgress', () => ({
  registerOperation: (label: string) => registerLongOpMock(label),
  completeOperation: (id: number) => completeLongOpMock(id),
}))

import { invoke } from './invokeWithTimeout'

describe('invokeWithTimeout', () => {
  beforeEach(() => {
    nativeInvokeMock.mockReset().mockResolvedValue('result')
    isMockEnabledMock.mockReset().mockReturnValue(false)
    mockInvokeMock.mockReset().mockResolvedValue('mock-result')
    registerLongOpMock.mockClear()
    completeLongOpMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mock 환경에서는 mockInvoke 사용', async () => {
    isMockEnabledMock.mockReturnValue(true)
    const result = await invoke('any_cmd')
    expect(result).toBe('mock-result')
    expect(nativeInvokeMock).not.toHaveBeenCalled()
    expect(mockInvokeMock).toHaveBeenCalledWith('any_cmd', undefined)
  })

  it('일반 명령은 nativeInvoke 호출 + 30s timeout', async () => {
    const result = await invoke('list_branches', { repoId: 1 })
    expect(result).toBe('result')
    expect(nativeInvokeMock).toHaveBeenCalledWith('list_branches', { repoId: 1 })
  })

  it('long-running prefix (clone_) → registerOperation 호출', async () => {
    await invoke('clone_repo', { url: 'x' })
    expect(registerLongOpMock).toHaveBeenCalledWith('clone_repo')
    expect(completeLongOpMock).toHaveBeenCalledWith(1)
  })

  it('long-running prefix (bulk_, fetch_, pull, push, ai_, maintenance_) 자동 감지', async () => {
    await invoke('bulk_fetch')
    await invoke('fetch_all')
    await invoke('pull')
    await invoke('push')
    await invoke('ai_explain')
    await invoke('maintenance_gc')
    expect(registerLongOpMock).toHaveBeenCalledTimes(6)
  })

  it('progressLabel="" 옵션 → register 안 함', async () => {
    await invoke('clone_repo', undefined, { progressLabel: '' })
    expect(registerLongOpMock).not.toHaveBeenCalled()
  })

  it('progressLabel 명시 — 명시 라벨로 register', async () => {
    await invoke('list_branches', undefined, { progressLabel: '일괄 검색 중' })
    expect(registerLongOpMock).toHaveBeenCalledWith('일괄 검색 중')
  })

  it('timeoutMs=0 → timeout 비활성', async () => {
    const result = await invoke('long_op', undefined, { timeoutMs: 0 })
    expect(result).toBe('result')
  })

  it('timeout 경과 시 reject + finalize 호출', async () => {
    vi.useFakeTimers()
    nativeInvokeMock.mockImplementation(() => new Promise(() => {})) // hang
    const promise = invoke('clone_repo')
    vi.advanceTimersByTime(5 * 60_000)
    await expect(promise).rejects.toThrow(/IPC timeout/)
    expect(completeLongOpMock).toHaveBeenCalled()
  })

  it('reject 시 finalize 호출 (long-running 등록 정리)', async () => {
    nativeInvokeMock.mockRejectedValue(new Error('boom'))
    await expect(invoke('clone_repo')).rejects.toThrow('boom')
    expect(registerLongOpMock).toHaveBeenCalled()
    expect(completeLongOpMock).toHaveBeenCalled()
  })

  it('resolve 후 한 번만 finalize (race-condition 방지)', async () => {
    await invoke('clone_repo')
    expect(completeLongOpMock).toHaveBeenCalledTimes(1)
  })

  // Sprint c30 / MED 1 — Retry policy
  describe('retry (network-flaky)', () => {
    it('clone_ transient 실패 → 1회 자동 retry → 성공', async () => {
      let calls = 0
      nativeInvokeMock.mockImplementation(() => {
        calls += 1
        if (calls === 1) return Promise.reject(new Error('connection reset'))
        return Promise.resolve('ok')
      })
      const result = await invoke('clone_repo')
      expect(result).toBe('ok')
      expect(calls).toBe(2)
    })

    it('fetch_ 인증 실패 (401) → retry 안 함', async () => {
      let calls = 0
      nativeInvokeMock.mockImplementation(() => {
        calls += 1
        return Promise.reject(new Error('401 unauthorized'))
      })
      await expect(invoke('fetch_all')).rejects.toThrow(/401/)
      expect(calls).toBe(1)
    })

    it('pull AppError kind=auth_expired → retry 안 함', async () => {
      let calls = 0
      nativeInvokeMock.mockImplementation(() => {
        calls += 1
        return Promise.reject({ kind: 'auth_expired', message: '토큰 만료' })
      })
      await expect(invoke('pull')).rejects.toMatchObject({ kind: 'auth_expired' })
      expect(calls).toBe(1)
    })

    it('list_branches (non-retryable cmd) → retry 안 함', async () => {
      let calls = 0
      nativeInvokeMock.mockImplementation(() => {
        calls += 1
        return Promise.reject(new Error('boom'))
      })
      await expect(invoke('list_branches')).rejects.toThrow('boom')
      expect(calls).toBe(1)
    })

    it('opts.retry=0 → 명시 비활성 (clone_ 라도)', async () => {
      let calls = 0
      nativeInvokeMock.mockImplementation(() => {
        calls += 1
        return Promise.reject(new Error('boom'))
      })
      await expect(invoke('clone_repo', undefined, { retry: 0 })).rejects.toThrow('boom')
      expect(calls).toBe(1)
    })

    it('opts.retry=2 → 일반 명령에도 적용', async () => {
      let calls = 0
      nativeInvokeMock.mockImplementation(() => {
        calls += 1
        if (calls < 3) return Promise.reject(new Error('flaky'))
        return Promise.resolve('ok')
      })
      const result = await invoke('list_branches', undefined, { retry: 2 })
      expect(result).toBe('ok')
      expect(calls).toBe(3)
    })

    it('cancelled 에러는 retry 안 함', async () => {
      let calls = 0
      nativeInvokeMock.mockImplementation(() => {
        calls += 1
        return Promise.reject(new Error('user cancelled'))
      })
      await expect(invoke('clone_repo')).rejects.toThrow(/cancelled/)
      expect(calls).toBe(1)
    })

    it('IPC timeout 자체는 retry 안 함 (사용자 cancel 의지)', async () => {
      vi.useFakeTimers()
      nativeInvokeMock.mockImplementation(() => new Promise(() => {})) // hang
      const promise = invoke('clone_repo')
      vi.advanceTimersByTime(5 * 60_000)
      await expect(promise).rejects.toThrow(/IPC timeout/)
    })
  })
})
