<script setup lang="ts">
// v0.5 #13 (UltraPlan plan/31) — component-level error fallback.
//
// Vue 의 onErrorCaptured + render slot error 흡수. registerGlobalErrorHandler 의
// 전역 핸들러 + invoke('report_frontend_error') tracing 은 이미 적용 — 본 컴포넌트는
// component-tree 일부가 throw 시 **나머지 UI 보존** + fallback UI 렌더 (Whole-app
// blank screen 회귀 회피).
//
// 사용:
//   <ErrorBoundary>
//     <CommitGraph />
//     <template #fallback="{ error, retry }">
//       <div>...</div>
//     </template>
//   </ErrorBoundary>
//
// fallback slot 미지정 시 기본 minimal banner.
import { onErrorCaptured, ref } from 'vue'
import { invoke } from '@/api/invokeWithTimeout'
import { buildPayload } from '@/utils/registerGlobalErrorHandler'

const props = defineProps<{
  /** 디버그 라벨 (어느 영역 에러인지 식별 — tracing 에 포함). */
  label?: string
}>()

const error = ref<Error | null>(null)

onErrorCaptured((err, instance, info) => {
  error.value = err instanceof Error ? err : new Error(String(err))
  // CDX-002 — `return false` 가 app.config.errorHandler 전파를 차단하므로
  //   tracing 보고(report_frontend_error)는 여기서 직접 수행한다.
  //   사용자 알림은 아래 fallback UI 가 담당 → 전역 toast 는 생략(중복 회피).
  invoke<void>(
    'report_frontend_error',
    buildPayload(err, instance ?? null, `errorBoundary[${props.label ?? '?'}]:${info}`),
    { timeoutMs: 0, retry: 0, progressLabel: '' },
  ).catch(() => {
    // tracing 자체 실패는 swallow (recursive error 회피).
  })
  // false 반환 → propagation 차단 (fallback UI 렌더, 전역 toast 미발생).
  return false
})

function retry() {
  error.value = null
}
</script>

<template>
  <slot v-if="!error" />
  <slot v-else name="fallback" :error="error" :retry="retry">
    <!-- 기본 fallback — minimal banner -->
    <div
      role="alert"
      class="m-4 rounded border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-xs text-danger-rose"
    >
      <div class="flex items-start gap-2">
        <span class="mt-0.5 shrink-0 font-bold">⚠</span>
        <div class="flex-1 min-w-0">
          <div class="font-semibold">{{ label ?? 'Component error' }}</div>
          <pre
            class="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] opacity-80"
            >{{ error.message }}</pre
          >
        </div>
        <button
          type="button"
          class="shrink-0 rounded border border-current px-2.5 py-1 min-h-[28px] text-xs hover:bg-current/10"
          @click="retry"
        >
          ↻ 재시도
        </button>
      </div>
    </div>
  </slot>
</template>
