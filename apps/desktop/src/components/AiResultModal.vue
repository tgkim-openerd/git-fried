<script setup lang="ts">
// AI 결과 표시 공용 modal — Explain commit / Explain branch / 기타.
// 마크다운 raw <pre> + 복사 버튼 (간단 v1).
// Sprint 22-5 Q-1/Q-2: BaseModal 마이그레이션.
// Sprint c45 UX-6 — loading timeout (60s) + 재시도 emit.
import { ref, watch, onUnmounted } from 'vue'
import { useToast } from '@/composables/useToast'
import BaseModal from './BaseModal.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    content: string
    loading?: boolean
    error?: string | null
    /** Sprint c45 UX-6 — loading timeout (ms). 0 = 무제한. */
    timeoutMs?: number
  }>(),
  { timeoutMs: 60_000 },
)
const emit = defineEmits<{ close: []; retry: [] }>()

const toast = useToast()
const timedOut = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

function clearTimer() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

watch(
  () => [props.open, props.loading],
  ([open, loading]) => {
    clearTimer()
    timedOut.value = false
    if (open && loading && props.timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut.value = true
      }, props.timeoutMs)
    }
  },
  { immediate: true },
)

onUnmounted(() => clearTimer())

async function copyAll() {
  if (!props.content) return
  try {
    await navigator.clipboard.writeText(props.content)
    toast.success(t('themeIO.clipboardCopy'), '')
  } catch {
    toast.error(t('errors.copyFailed'), '')
  }
}

function onRetry() {
  timedOut.value = false
  emit('retry')
}
</script>

<template>
  <BaseModal :open="open" max-width="2xl" panel-class="max-h-[85vh]" @close="emit('close')">
    <template #header>
      <div class="flex items-center gap-2">
        <h2 class="text-sm font-semibold">✨ {{ title }}</h2>
        <button
          type="button"
          class="rounded border border-border px-2 py-0.5 text-xs hover:bg-accent/40 disabled:opacity-50"
          :disabled="!content || !!loading"
          :aria-label="t('aiResult.btnCopy')"
          @click="copyAll"
        >
          {{ t('aiResult.btnCopy') }}
        </button>
      </div>
    </template>
    <div class="p-4">
      <p
        v-if="error"
        class="rounded border border-destructive bg-destructive/10 p-2 text-xs whitespace-pre-wrap"
      >
        {{ error }}
      </p>
      <div v-else-if="loading && timedOut" class="p-6 text-center text-sm">
        <p class="mb-3 text-warning-amber">{{ t('aiResult.timeout') }}</p>
        <div class="flex justify-center gap-2">
          <button
            type="button"
            class="rounded border border-border px-3 py-1 text-xs hover:bg-accent/40"
            @click="onRetry"
          >
            {{ t('aiResult.btnRetry') }}
          </button>
          <button
            type="button"
            class="rounded border border-border px-3 py-1 text-xs hover:bg-accent/40"
            @click="emit('close')"
          >
            {{ t('common.close') }}
          </button>
        </div>
      </div>
      <p v-else-if="loading" class="p-6 text-center text-sm text-muted-foreground">
        {{ t('aiResult.loading') }}
      </p>
      <pre
        v-else-if="content"
        class="m-0 whitespace-pre-wrap break-words rounded bg-muted/30 p-3 text-[13px]"
        >{{ content }}</pre
      >
      <p v-else class="p-6 text-center text-sm text-muted-foreground">{{ t('aiResult.empty') }}</p>
    </div>
  </BaseModal>
</template>
