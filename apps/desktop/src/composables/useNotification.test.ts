import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// @tauri-apps/plugin-notification mock — Tauri 환경 부재 검증
const mockIsGranted = vi.fn()
const mockRequestPermission = vi.fn()
const mockSendNotification = vi.fn()

vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: () => mockIsGranted(),
  requestPermission: () => mockRequestPermission(),
  sendNotification: (opts: { title: string; body?: string }) => mockSendNotification(opts),
}))

async function importFresh() {
  vi.resetModules()
  return await import('./useNotification')
}

describe('useNotification', () => {
  beforeEach(() => {
    mockIsGranted.mockReset()
    mockRequestPermission.mockReset()
    mockSendNotification.mockReset()
    // document.hasFocus 기본 false (background 가정 — notification 발송 가능)
    if (typeof document !== 'undefined') {
      vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    }
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('이미 permission granted 면 sendNotification 호출', async () => {
    mockIsGranted.mockResolvedValue(true)
    const { useNotification } = await importFresh()
    const { notify } = useNotification()
    await notify('title', 'body')
    expect(mockSendNotification).toHaveBeenCalledWith({ title: 'title', body: 'body' })
    expect(mockRequestPermission).not.toHaveBeenCalled()
  })

  it('permission 미허용 시 requestPermission 호출 + 허용 시 send', async () => {
    mockIsGranted.mockResolvedValue(false)
    mockRequestPermission.mockResolvedValue('granted')
    const { useNotification } = await importFresh()
    const { notify } = useNotification()
    await notify('hi')
    expect(mockRequestPermission).toHaveBeenCalled()
    expect(mockSendNotification).toHaveBeenCalled()
  })

  it('permission 거부 시 silent fail (sendNotification 호출 안 함)', async () => {
    mockIsGranted.mockResolvedValue(false)
    mockRequestPermission.mockResolvedValue('denied')
    const { useNotification } = await importFresh()
    const { notify } = useNotification()
    await notify('hi')
    expect(mockSendNotification).not.toHaveBeenCalled()
  })

  it('window focus 시 notification skip (toast 만 충분)', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    mockIsGranted.mockResolvedValue(true)
    const { useNotification } = await importFresh()
    const { notify } = useNotification()
    await notify('hi')
    expect(mockSendNotification).not.toHaveBeenCalled()
    expect(mockIsGranted).not.toHaveBeenCalled() // 권한 검증도 skip
  })

  it('isPermissionGranted throw 시 silent fail', async () => {
    mockIsGranted.mockRejectedValue(new Error('Tauri 부재'))
    const { useNotification } = await importFresh()
    const { notify } = useNotification()
    await expect(notify('hi')).resolves.toBeUndefined()
    expect(mockSendNotification).not.toHaveBeenCalled()
  })

  it('cachedGranted — 같은 호출 2번 시 isPermissionGranted 1번만', async () => {
    mockIsGranted.mockResolvedValue(true)
    const { useNotification } = await importFresh()
    const { notify } = useNotification()
    await notify('a')
    await notify('b')
    expect(mockIsGranted).toHaveBeenCalledTimes(1)
    expect(mockSendNotification).toHaveBeenCalledTimes(2)
  })
})
