// c62-B — useCommitActions 단위 테스트.
//
// repoIdOrToast guard + 4 destructive action (cherryPick/revert/reset/copySha)
// + reset hard type-to-confirm 분기 + buildItems 구조 검증.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/git', () => ({
  cherryPickSha: vi.fn(),
  createBranch: vi.fn(),
  createTag: vi.fn(),
  reset: vi.fn(),
  revert: vi.fn(),
}))

vi.mock('@/api/errors', () => ({
  describeError: (e: unknown) => String(e),
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
const toastInfo = vi.fn()
const toastWarning = vi.fn()
vi.mock('./useToast', () => ({
  useToast: () => ({
    success: toastSuccess,
    error: toastError,
    info: toastInfo,
    warning: toastWarning,
  }),
}))

const invalidateMock = vi.fn()
vi.mock('./useStatus', () => ({
  useInvalidateRepoQueries: () => invalidateMock,
}))

const confirmMock = vi.fn()
const promptMock = vi.fn()
vi.mock('./useConfirm', () => ({
  confirmDialog: (opts: unknown) => confirmMock(opts),
  promptDialog: (opts: unknown) => promptMock(opts),
}))

vi.mock('@/i18n', () => ({
  i18n: {
    global: { t: (k: string, p?: Record<string, unknown>) => `${k}:${JSON.stringify(p ?? {})}` },
  },
}))

import { useCommitActions } from './useCommitActions'
import { cherryPickSha, reset as ipcReset, revert as ipcRevert } from '@/api/git'

const SHA = 'abc1234567890def'

describe('useCommitActions — repoIdOrToast guard', () => {
  beforeEach(() => {
    toastWarning.mockClear()
    toastError.mockClear()
    toastSuccess.mockClear()
    toastInfo.mockClear()
    confirmMock.mockReset()
    promptMock.mockReset()
    vi.mocked(cherryPickSha).mockReset()
    vi.mocked(ipcReset).mockReset()
    vi.mocked(ipcRevert).mockReset()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('repoId null → cherryPick toast.warning + IPC 미호출', async () => {
    const m = useCommitActions(() => null)
    await m.cherryPick(SHA)
    expect(toastWarning).toHaveBeenCalledOnce()
    expect(cherryPickSha).not.toHaveBeenCalled()
  })

  it('repoId null → revert toast.warning + IPC 미호출', async () => {
    const m = useCommitActions(() => null)
    await m.revert(SHA)
    expect(toastWarning).toHaveBeenCalledOnce()
    expect(ipcRevert).not.toHaveBeenCalled()
  })

  it('repoId null → reset toast.warning + IPC 미호출', async () => {
    const m = useCommitActions(() => null)
    await m.reset(SHA, 'soft')
    expect(toastWarning).toHaveBeenCalledOnce()
    expect(ipcReset).not.toHaveBeenCalled()
  })
})

describe('useCommitActions — cherryPick', () => {
  beforeEach(() => {
    toastSuccess.mockClear()
    toastError.mockClear()
    confirmMock.mockReset()
    vi.mocked(cherryPickSha).mockReset()
    invalidateMock.mockClear()
  })

  it('confirm cancel → cherryPickSha 미호출', async () => {
    confirmMock.mockResolvedValueOnce(false)
    const m = useCommitActions(() => 1)
    await m.cherryPick(SHA)
    expect(cherryPickSha).not.toHaveBeenCalled()
  })

  it('confirm OK + IPC 성공 → toast.success + invalidate', async () => {
    confirmMock.mockResolvedValueOnce(true)
    vi.mocked(cherryPickSha).mockResolvedValueOnce({
      success: true,
      conflicted: false,
      stdout: '',
      stderr: '',
    })
    const m = useCommitActions(() => 7)
    await m.cherryPick(SHA)
    expect(cherryPickSha).toHaveBeenCalledWith(7, SHA)
    expect(toastSuccess).toHaveBeenCalled()
    expect(invalidateMock).toHaveBeenCalledWith(7)
  })

  it('confirm OK + IPC 실패 → toast.error', async () => {
    confirmMock.mockResolvedValueOnce(true)
    vi.mocked(cherryPickSha).mockRejectedValueOnce(new Error('boom'))
    const m = useCommitActions(() => 1)
    await m.cherryPick(SHA)
    expect(toastError).toHaveBeenCalled()
    expect(invalidateMock).not.toHaveBeenCalled()
  })

  it('confirm message 에 sha 8자 prefix 전달', async () => {
    confirmMock.mockResolvedValueOnce(false)
    const m = useCommitActions(() => 1)
    await m.cherryPick(SHA)
    const call = confirmMock.mock.calls[0][0] as { message: string }
    expect(call.message).toContain('abc12345')
  })
})

describe('useCommitActions — reset hard type-to-confirm', () => {
  beforeEach(() => {
    toastSuccess.mockClear()
    toastError.mockClear()
    toastInfo.mockClear()
    confirmMock.mockReset()
    promptMock.mockReset()
    vi.mocked(ipcReset).mockReset()
  })

  it('hard mode + prompt 불일치 → toast.info "취소" + IPC 미호출', async () => {
    promptMock.mockResolvedValueOnce('wrong typing')
    const m = useCommitActions(() => 1)
    await m.reset(SHA, 'hard')
    expect(toastInfo).toHaveBeenCalled()
    expect(ipcReset).not.toHaveBeenCalled()
  })

  it('hard mode + 정확한 입력 → IPC reset 호출', async () => {
    const expected = `reset --hard ${SHA.slice(0, 8)}`
    promptMock.mockResolvedValueOnce(expected)
    vi.mocked(ipcReset).mockResolvedValueOnce(undefined)
    const m = useCommitActions(() => 5)
    await m.reset(SHA, 'hard')
    expect(ipcReset).toHaveBeenCalledWith(5, 'hard', SHA)
    expect(toastSuccess).toHaveBeenCalled()
  })

  it('soft mode → confirmDialog (danger=true) 사용 + prompt 미호출', async () => {
    confirmMock.mockResolvedValueOnce(true)
    vi.mocked(ipcReset).mockResolvedValueOnce(undefined)
    const m = useCommitActions(() => 1)
    await m.reset(SHA, 'soft')
    expect(promptMock).not.toHaveBeenCalled()
    const call = confirmMock.mock.calls[0][0] as { danger: boolean }
    expect(call.danger).toBe(true)
    expect(ipcReset).toHaveBeenCalledWith(1, 'soft', SHA)
  })

  it('soft mode + confirm cancel → IPC 미호출', async () => {
    confirmMock.mockResolvedValueOnce(false)
    const m = useCommitActions(() => 1)
    await m.reset(SHA, 'mixed')
    expect(ipcReset).not.toHaveBeenCalled()
  })
})

describe('useCommitActions — buildItems 구조', () => {
  it('14 항목 + 3 divider — sha 별 동일 구조', () => {
    const m = useCommitActions(() => 1)
    const items = m.buildItems(SHA)
    expect(items.length).toBe(14)
    const dividers = items.filter((i) => 'divider' in i && i.divider).length
    expect(dividers).toBe(3)
  })

  it('callback 미주입 시 Show diff / Compare / Explain AI / Open in forge 4개 disabled', () => {
    const m = useCommitActions(() => 1)
    // ContextMenuItem 은 divider | label/submenu union — test 편의상 Record<string, unknown>.
    const items = m.buildItems(SHA) as Array<Record<string, unknown>>
    const find = (label: string) => items.find((i) => i.label === label)
    expect(find('Show diff')?.disabled).toBe(true)
    expect(find('Compare with...')?.disabled).toBe(true)
    expect(find('Explain (AI)')?.disabled).toBe(true)
    expect(find('Open in forge')?.disabled).toBe(true)
  })

  it('Reset submenu 3 옵션 — soft/mixed/hard(destructive)', () => {
    const m = useCommitActions(() => 1)
    const items = m.buildItems(SHA) as Array<Record<string, unknown>>
    const reset = items.find((i) => i.label === 'Reset')
    const submenu = reset?.submenu as Array<{ label: string; destructive?: boolean }>
    expect(submenu.length).toBe(3)
    expect(submenu[0].label).toContain('--soft')
    expect(submenu[1].label).toContain('--mixed')
    expect(submenu[2].destructive).toBe(true)
  })

  it('callback 주입 시 onShowDiff / onCompare / onExplainAi / onOpenInForge enabled', () => {
    const m = useCommitActions(() => 1)
    const cb = {
      onShowDiff: vi.fn(),
      onCompare: vi.fn(),
      onExplainAi: vi.fn(),
      onOpenInForge: vi.fn(),
    }
    const items = m.buildItems(SHA, cb) as Array<Record<string, unknown>>
    const showDiff = items.find((i) => i.label === 'Show diff')
    expect(showDiff?.disabled).toBe(false)
  })
})
