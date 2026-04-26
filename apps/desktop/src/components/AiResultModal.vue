<script setup lang="ts">
// AI 결과 표시 공용 modal — Explain commit / Explain branch / 기타.
// 마크다운 raw <pre> + 복사 버튼 (간단 v1).
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  open: boolean
  title: string
  content: string
  loading?: boolean
  error?: string | null
}>()
defineEmits<{ close: [] }>()

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
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="$emit('close')"
    >
      <div
        class="flex max-h-[85vh] w-[680px] max-w-full flex-col rounded-lg border border-border bg-card shadow-xl"
      >
        <header
          class="flex items-center justify-between border-b border-border px-4 py-2"
        >
          <h2 class="text-sm font-semibold">✨ {{ title }}</h2>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded border border-border px-2 py-0.5 text-xs hover:bg-accent/40 disabled:opacity-50"
              :disabled="!content || !!loading"
              @click="copyAll"
            >
              복사
            </button>
            <button
              type="button"
              class="text-muted-foreground hover:text-foreground"
              @click="$emit('close')"
            >
              ✕
            </button>
          </div>
        </header>
        <div class="flex-1 overflow-auto p-4">
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
      </div>
    </div>
  </Teleport>
</template>
