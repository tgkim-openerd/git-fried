import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, type App, type ComponentPublicInstance } from 'vue'

const invokeMock = vi.fn()
vi.mock('@/api/invokeWithTimeout', () => ({
  invoke: (cmd: string, args: unknown, opts: unknown) => invokeMock(cmd, args, opts),
}))

const toastErrorMock = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    error: (title: string, message?: string) => toastErrorMock(title, message),
  }),
}))

import { buildPayload, registerGlobalErrorHandler } from './registerGlobalErrorHandler'

function makeApp(): App {
  return createApp(
    defineComponent({
      name: 'TestRoot',
      setup: () => () => h('div'),
    }),
  )
}

describe('buildPayload', () => {
  it('Error 인스턴스 → message + stack 추출', () => {
    const err = new Error('boom')
    const payload = buildPayload(err, null, 'setup')
    expect(payload.message).toBe('boom')
    expect(payload.source).toBeDefined()
    expect(payload.source).toContain('Error')
    expect(payload.info).toBe('setup')
    expect(payload.component).toBeUndefined()
  })

  it('non-Error 던지면 String 캐스트', () => {
    const payload = buildPayload('plain string', null, 'render')
    expect(payload.message).toBe('plain string')
    expect(payload.source).toBeUndefined()
  })

  it('컴포넌트 instance __name 추출', () => {
    const fakeInstance = {
      $options: { __name: 'FooBar' },
    } as Partial<ComponentPublicInstance> as ComponentPublicInstance
    const payload = buildPayload(new Error('x'), fakeInstance, 'mounted')
    expect(payload.component).toBe('FooBar')
  })

  it('컴포넌트 instance __name 부재 시 name fallback', () => {
    const fakeInstance = {
      $options: { name: 'LegacyComp' },
    } as Partial<ComponentPublicInstance> as ComponentPublicInstance
    const payload = buildPayload(new Error('x'), fakeInstance, 'mounted')
    expect(payload.component).toBe('LegacyComp')
  })
})

describe('registerGlobalErrorHandler', () => {
  let app: App

  beforeEach(() => {
    invokeMock.mockReset().mockResolvedValue(undefined)
    toastErrorMock.mockClear()
    app = makeApp()
  })

  it('errorHandler 등록 + toast.error + invoke 호출', () => {
    registerGlobalErrorHandler(app)
    expect(typeof app.config.errorHandler).toBe('function')

    const err = new Error('kaboom')
    app.config.errorHandler!(err, null, 'render')

    expect(toastErrorMock).toHaveBeenCalledTimes(1)
    expect(toastErrorMock.mock.calls[0][1]).toBe('kaboom')

    expect(invokeMock).toHaveBeenCalledWith(
      'report_frontend_error',
      expect.objectContaining({
        message: 'kaboom',
        info: 'render',
      }),
      // invokeWithTimeout opts — fire-and-forget 강제 (ARCH-1).
      expect.objectContaining({
        timeoutMs: 0,
        retry: 0,
        progressLabel: '',
      }),
    )
  })

  it('invoke 실패해도 swallow (recursive 회피)', async () => {
    invokeMock.mockRejectedValueOnce(new Error('IPC offline'))
    registerGlobalErrorHandler(app)

    expect(() => {
      app.config.errorHandler!(new Error('inner'), null, 'setup')
    }).not.toThrow()

    // microtask flush — fire-and-forget catch 가 reject 를 흡수하는지.
    await Promise.resolve()
    expect(toastErrorMock).toHaveBeenCalledTimes(1)
  })

  it('payload 가 Record<string, unknown> 호환 — invokeWithTimeout 시그니처 충족', () => {
    registerGlobalErrorHandler(app)
    app.config.errorHandler!(new Error('m'), null, 'i')
    const args = invokeMock.mock.calls[0][1] as Record<string, unknown>
    // index signature 동작 확인 — 확장 필드도 OK.
    expect(typeof args.message).toBe('string')
  })
})
