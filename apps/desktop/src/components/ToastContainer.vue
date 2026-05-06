<script setup lang="ts">
import { useToast } from '@/composables/useToast'
import type { ToastKind } from '@/composables/useToast'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { toasts, dismiss } = useToast()

function kindClass(kind: ToastKind): string {
  switch (kind) {
    case 'success':
      return 'border-emerald-500/40 bg-emerald-500/10 text-diff-add'
    case 'info':
      return 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-500'
    case 'warning':
      return 'border-amber-500/40 bg-amber-500/10 text-warning-amber'
    case 'error':
      return 'border-rose-500/40 bg-rose-500/10 text-danger-rose'
  }
}

function kindIcon(kind: ToastKind): string {
  switch (kind) {
    case 'success':
      return '✓'
    case 'info':
      return 'ℹ'
    case 'warning':
      return '⚠'
    case 'error':
      return '✕'
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-96 max-w-[90vw] flex-col-reverse gap-2"
    >
      <TransitionGroup name="toast" tag="div" class="flex flex-col-reverse gap-2">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto rounded-md border bg-card shadow-lg"
          :class="kindClass(toast.kind)"
        >
          <div class="flex items-start gap-2 px-3 py-2">
            <span class="mt-0.5 shrink-0 font-bold">{{ kindIcon(toast.kind) }}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 text-sm font-semibold">
                <span class="truncate">{{ toast.title }}</span>
                <!-- Sprint 22-12 Q-6 — dedup count badge ("같은 메시지 +N") -->
                <span
                  v-if="toast.count > 1"
                  class="shrink-0 rounded-full bg-current/20 px-1.5 text-[10px] font-bold tabular-nums"
                  :title="`같은 메시지 ${toast.count}회 누적 (1초 내 dedup)`"
                  :aria-label="`${toast.count}회 누적`"
                >
                  +{{ toast.count - 1 }}
                </span>
              </div>
              <pre
                v-if="toast.message"
                class="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] opacity-90"
                >{{ toast.message }}</pre
              >
            </div>
            <button
              type="button"
              class="shrink-0 text-xs opacity-60 hover:opacity-100"
              :aria-label="t('templ.toastClose')"
              @click="dismiss(toast.id)"
            >
              ✕
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
/* Sprint 22-12 Q-5 — Toast slide-in transition (CSS var 통합, design 04 §6).
 * 200ms enter / 100ms exit + slide right + opacity.
 */
.toast-enter-active {
  transition:
    opacity var(--transition-slow) var(--ease-out),
    transform var(--transition-slow) var(--ease-out);
}
.toast-leave-active {
  transition:
    opacity 100ms var(--ease-in),
    transform 100ms var(--ease-in);
  position: absolute;
  right: 0;
  width: 100%;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
