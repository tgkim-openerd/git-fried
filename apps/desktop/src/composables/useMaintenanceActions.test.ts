// c61 Wave B — useMaintenanceActions 단위 테스트.
//
// confirmAggressiveGc guard + onMaintenanceDone label/result 분기만 검증.
// (gcMut/fsckMut/lfsInstallMut 본체는 vue-query mock — mutationFn 분기는 c62.)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mutateMockFns: Array<ReturnType<typeof vi.fn>> = []
const onSuccessFns: Array<(...args: unknown[]) => void> = []
const onErrorFns: Array<(...args: unknown[]) => void> = []

vi.mock('@tanstack/vue-query', () => ({
  useMutation: (opts: {
    mutationFn: unknown
    onSuccess?: (...args: unknown[]) => void
    onError?: (...args: unknown[]) => void
  }) => {
    const mutate = vi.fn()
    mutateMockFns.push(mutate)
    if (opts.onSuccess) onSuccessFns.push(opts.onSuccess)
    if (opts.onError) onErrorFns.push(opts.onError)
    return { mutate, mutationFn: opts.mutationFn, isPending: { value: false } }
  },
}))

const reposStoreState = { activeRepoId: 1 as number | null }
vi.mock('@/stores/repos', () => ({
  useReposStore: () => reposStoreState,
}))

vi.mock('@/api/git', () => ({
  lfsInstall: vi.fn(),
  maintenanceFsck: vi.fn(),
  maintenanceGc: vi.fn(),
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

const confirmMock = vi.fn()
vi.mock('./useConfirm', () => ({
  confirmDialog: (opts: unknown) => confirmMock(opts),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}))

import { useMaintenanceActions } from './useMaintenanceActions'

// mutateMockFns 등록 순서: 0=gcMut, 1=fsckMut, 2=lfsInstallMut
// onSuccessFns 등록 순서: 0=gcMut.onSuccess, 1=fsckMut.onSuccess, 2=lfsInstallMut.onSuccess

describe('useMaintenanceActions — confirmAggressiveGc', () => {
  beforeEach(() => {
    mutateMockFns.length = 0
    onSuccessFns.length = 0
    onErrorFns.length = 0
    confirmMock.mockReset()
    toastSuccess.mockClear()
    toastError.mockClear()
    toastWarning.mockClear()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('confirm cancel → gcMut.mutate(true) 미호출', async () => {
    confirmMock.mockResolvedValueOnce(false)
    const m = useMaintenanceActions()
    await m.confirmAggressiveGc()
    expect(confirmMock).toHaveBeenCalledOnce()
    expect(mutateMockFns[0]).not.toHaveBeenCalled()
  })

  it('confirm OK → gcMut.mutate(true) 호출 (aggressive flag)', async () => {
    confirmMock.mockResolvedValueOnce(true)
    const m = useMaintenanceActions()
    await m.confirmAggressiveGc()
    expect(mutateMockFns[0]).toHaveBeenCalledWith(true)
  })

  it('confirm 옵션에 title + message 전달 (aggressiveGc i18n keys)', async () => {
    confirmMock.mockResolvedValueOnce(false)
    const m = useMaintenanceActions()
    await m.confirmAggressiveGc()
    const call = confirmMock.mock.calls[0][0] as { title: string; message: string }
    expect(call.title).toContain('aggressiveGc')
    expect(call.message).toContain('aggressiveGc')
  })
})

describe('useMaintenanceActions — onMaintenanceDone (gc onSuccess)', () => {
  beforeEach(() => {
    mutateMockFns.length = 0
    onSuccessFns.length = 0
    onErrorFns.length = 0
    toastSuccess.mockClear()
    toastWarning.mockClear()
    reposStoreState.activeRepoId = 1
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('gc 성공 (aggressive=false) → maintLabel="git gc" + maintResult.success', () => {
    const m = useMaintenanceActions()
    const result = { success: true, stdout: 'OK', stderr: '', exitCode: 0 }
    onSuccessFns[0](result, false)
    expect(m.maintLabel.value).toBe('git gc')
    expect(m.maintResult.value).toEqual(result)
    expect(toastSuccess).toHaveBeenCalledWith('git gc 완료', '')
  })

  it('gc 성공 (aggressive=true) → maintLabel 에 --aggressive 포함', () => {
    const m = useMaintenanceActions()
    const result = { success: true, stdout: '', stderr: '', exitCode: 0 }
    onSuccessFns[0](result, true)
    expect(m.maintLabel.value).toContain('--aggressive')
    expect(m.maintLabel.value).toContain('--prune=now')
  })

  it('gc 비정상 종료 → toast.warning + exitCode 표시', () => {
    const m = useMaintenanceActions()
    const result = { success: false, stdout: '', stderr: 'err', exitCode: 1 }
    onSuccessFns[0](result, false)
    expect(toastWarning).toHaveBeenCalled()
    expect(m.maintResult.value).toEqual(result)
  })

  it('exitCode null → "?" fallback', () => {
    useMaintenanceActions()
    const result = { success: false, stdout: '', stderr: '', exitCode: null }
    onSuccessFns[0](result, false)
    const call = toastWarning.mock.calls[0]
    expect(call[1]).toContain('?')
  })

  it('fsck 성공 → maintLabel="git fsck --full"', () => {
    const m = useMaintenanceActions()
    const result = { success: true, stdout: '', stderr: '', exitCode: 0 }
    onSuccessFns[1](result)
    expect(m.maintLabel.value).toBe('git fsck --full')
  })
})

describe('useMaintenanceActions — lfsInstallMut.onSuccess', () => {
  beforeEach(() => {
    mutateMockFns.length = 0
    onSuccessFns.length = 0
    toastSuccess.mockClear()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('LFS install 성공 → maintLabel + 인공 result (D-LFS-002 contract — filter only, hook 미설치)', () => {
    const m = useMaintenanceActions()
    onSuccessFns[2]()
    // D-LFS-002 (Codex c82 audit) — backend --local --skip-repo 라 hook 등록 안 함.
    // UI 메시지도 filter 활성화만 보고하도록 정정.
    expect(m.maintLabel.value).toBe('git lfs install --local --skip-repo')
    expect(m.maintResult.value?.success).toBe(true)
    expect(m.maintResult.value?.exitCode).toBe(0)
    expect(toastSuccess).toHaveBeenCalledWith(
      'LFS 초기화',
      'filter clean/smudge 활성화 (hook 미설치)',
    )
  })
})
