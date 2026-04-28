<script setup lang="ts">
// AI 결과 표시 공용 modal — Explain commit / Explain branch / 기타.
// 마크다운 raw <pre> + 복사 버튼 (간단 v1).
// Sprint 22-5 Q-1/Q-2: BaseModal 마이그레이션.
import { useToast } from '@/composables/useToast'
import BaseModal from './BaseModal.vue'

const props = defineProps<{
  open: boolean
  title: string
  content: string
  loading?: boolean
  error?: string | null
}>()
const emit = defineEmits<{ close: [] }>()

const toast = useToast()

async function copyAll() {
  if (!props.content) return
  try {
    await navigator.clipboard.writeText(props.content)
    toast.success('클립보드에 복사', '')
  } catch {
    toast.error('복사 실패', '')
  }
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
          aria-label="결과 전체 복사"
          @click="copyAll"
        >
          복사
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
      <p
        v-else-if="loading"
        class="p-6 text-center text-sm text-muted-foreground"
      >
        AI 응답 대기 중...
      </p>
      <pre
        v-else-if="content"
        class="m-0 whitespace-pre-wrap break-words rounded bg-muted/30 p-3 text-[13px]"
      >{{ content }}</pre>
      <p v-else class="p-6 text-center text-sm text-muted-foreground">
        응답 없음.
      </p>
    </div>
  </BaseModal>
</template>
