// Sprint c32 — useExplainBranch 단위 테스트.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useExplainBranch } from './useExplainBranch'

// IPC mock
vi.mock('@/api/git', () => ({
  aiExplainBranch: vi.fn(),
}))
vi.mock('@/composables/useAiCli', () => ({
  notifyAiDone: vi.fn(),
}))

import { aiExplainBranch } from '@/api/git'
import { notifyAiDone } from '@/composables/useAiCli'

const aiExplainMock = vi.mocked(aiExplainBranch)
const notifyMock = vi.mocked(notifyAiDone)

beforeEach(() => {
  aiExplainMock.mockReset()
  notifyMock.mockReset()
})

describe('useExplainBranch — initial state', () => {
  it('초기 state: open=false / pending=false / error=null / title=빈', () => {
    const e = useExplainBranch()
    expect(e.explainOpen.value).toBe(false)
    expect(e.explainPending.value).toBe(false)
    expect(e.explainError.value).toBeNull()
    expect(e.explainTitle.value).toBe('')
    expect(e.explainContent.value).toBe('')
  })
})

describe('useExplainBranch — explain 성공', () => {
  it('성공 시 content 채움 + open=true + notifyAiDone 호출', async () => {
    aiExplainMock.mockResolvedValueOnce({
      success: true,
      text: 'This branch fixes auth flow.',
      stderr: '',
      tookMs: 0,
    })
    const e = useExplainBranch()
    await e.explain(1, 'claude', 'feat/auth', 'main')
    expect(e.explainOpen.value).toBe(true)
    expect(e.explainTitle.value).toBe('Branch feat/auth (vs main)')
    expect(e.explainContent.value).toBe('This branch fixes auth flow.')
    expect(e.explainError.value).toBeNull()
    expect(e.explainPending.value).toBe(false)
    expect(notifyMock).toHaveBeenCalledWith('AI 브랜치 설명', 'feat/auth vs main')
  })

  it('aiExplainBranch 가 받는 args (repoId / cli / head / base / staged=true)', async () => {
    aiExplainMock.mockResolvedValueOnce({
      success: true,
      text: 'ok',
      stderr: '',
      tookMs: 0,
    })
    const e = useExplainBranch()
    await e.explain(42, 'codex', 'release/1.0', 'develop')
    expect(aiExplainMock).toHaveBeenCalledWith(42, 'codex', 'release/1.0', 'develop', true)
  })
})

describe('useExplainBranch — explain 실패 (success=false)', () => {
  it('stderr 우선 — error 에 stderr 표시', async () => {
    aiExplainMock.mockResolvedValueOnce({
      success: false,
      text: 'partial output',
      stderr: 'rate limit exceeded',
      tookMs: 100,
    })
    const e = useExplainBranch()
    await e.explain(1, 'claude', 'a', 'b')
    expect(e.explainError.value).toBe('rate limit exceeded')
    expect(e.explainPending.value).toBe(false)
    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('stderr 빈 + text 있으면 text fallback', async () => {
    aiExplainMock.mockResolvedValueOnce({
      success: false,
      text: 'something went wrong',
      stderr: '',
      tookMs: 50,
    })
    const e = useExplainBranch()
    await e.explain(1, 'claude', 'a', 'b')
    expect(e.explainError.value).toBe('something went wrong')
  })

  it('stderr/text 모두 빈 — "응답 실패" fallback', async () => {
    aiExplainMock.mockResolvedValueOnce({
      success: false,
      text: '',
      stderr: '',
      tookMs: 50,
    })
    const e = useExplainBranch()
    await e.explain(1, 'claude', 'a', 'b')
    expect(e.explainError.value).toBe('응답 실패')
  })
})

describe('useExplainBranch — explain throws (catch)', () => {
  it('aiExplainBranch reject — describeError 결과로 error 채움 + pending=false', async () => {
    aiExplainMock.mockRejectedValueOnce(new Error('IPC timeout'))
    const e = useExplainBranch()
    await e.explain(1, 'claude', 'a', 'b')
    expect(e.explainError.value).toContain('IPC timeout')
    expect(e.explainPending.value).toBe(false)
  })
})

describe('useExplainBranch — close', () => {
  it('close() 는 open=false (다른 state 보존)', () => {
    const e = useExplainBranch()
    e.explainOpen.value = true
    e.explainContent.value = 'preserved'
    e.close()
    expect(e.explainOpen.value).toBe(false)
    expect(e.explainContent.value).toBe('preserved') // re-open 시 표시 가능
  })
})

describe('useExplainBranch — pending state during call', () => {
  it('explain 진행 중 pending=true (실측은 awaited 후 false)', async () => {
    let resolveLater!: (value: {
      success: boolean
      text: string
      stderr: string
      tookMs: number
    }) => void
    aiExplainMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLater = resolve
        }),
    )
    const e = useExplainBranch()
    const p = e.explain(1, 'claude', 'a', 'b')
    // pending 동안 true
    expect(e.explainPending.value).toBe(true)
    expect(e.explainOpen.value).toBe(true)
    resolveLater({ success: true, text: 'done', stderr: '', tookMs: 0 })
    await p
    expect(e.explainPending.value).toBe(false)
  })
})
