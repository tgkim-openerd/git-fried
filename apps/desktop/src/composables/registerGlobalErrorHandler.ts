// Vue 전역 에러 funnel — `app.config.errorHandler` 후크.
//
// 동작:
//   1. `useToast().error(...)` — 사용자 가시 알림 (i18n: errors.unexpected, fallback 영어)
//   2. invoke('report_frontend_error', payload) — Rust tracing::error! sink (`target=frontend`)
//      BE 측에서 secret_mask + CRLF escape + 1초 50건 rate limit 적용 (SEC-1/2/3).
//   3. dev only — `console.error` 보존 (Vue DevTools 의 full stack 추적 유지)
//
// 등록 시점:
//   `main.ts` 의 `createApp` 직후, `app.use(...)` plugin 체인 이전에 등록한다.
//   이렇게 해야 plugin install 단계에서 던지는 에러도 캐치 — 핸들러 내부의
//   useToast / i18n.global.t 는 호출 시점 lazy resolve 라 안전하다.
//
// fire-and-forget:
//   `invoke` 실패해도 swallow → recursive errorHandler 무한 루프 회피.

import type { App, ComponentPublicInstance } from 'vue'

import { invoke } from '@/api/invokeWithTimeout'
import { i18n } from '@/i18n'
import { useToast } from '@/composables/useToast'

export interface FrontendErrorPayload {
  message: string
  source?: string
  info?: string
  component?: string
  // invoke `Record<string, unknown>` 호환 — 향후 필드 확장 시 직렬화 호환성 자동 검증.
  [key: string]: unknown
}

function resolveComponentName(instance: ComponentPublicInstance | null): string | undefined {
  if (!instance) return undefined
  // ComponentPublicInstance.$options.name 은 공식 타입에 노출, __name 만 한정 캐스트.
  const opts = instance.$options as typeof instance.$options & { __name?: string }
  return opts.__name ?? opts.name
}

function unexpectedTitle(): string {
  try {
    return i18n.global.t('errors.unexpected')
  } catch {
    return 'Unexpected error'
  }
}

export function buildPayload(
  err: unknown,
  instance: ComponentPublicInstance | null,
  info: string,
): FrontendErrorPayload {
  const error = err instanceof Error ? err : undefined
  return {
    message: error?.message ?? String(err),
    source: error?.stack,
    info,
    component: resolveComponentName(instance),
  }
}

export function registerGlobalErrorHandler(app: App): void {
  const toast = useToast()
  app.config.errorHandler = (err, instance, info) => {
    const payload = buildPayload(err, instance, info)
    toast.error(unexpectedTitle(), payload.message)
    // invokeWithTimeout 경유 — dev mock / banner 비활성, retry 0, timeout 0 (fire-and-forget).
    invoke<void>('report_frontend_error', payload, {
      timeoutMs: 0,
      retry: 0,
      progressLabel: '',
    }).catch(() => {
      // tracing 자체 실패 시 swallow — recursive errorHandler 회피.
    })
    if (import.meta.env.DEV) {
      console.error('[errorHandler]', err, info, instance)
    }
  }
}
