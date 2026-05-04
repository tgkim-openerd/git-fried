<script setup lang="ts">
// 공용 Prompt 다이얼로그 — Sprint c38 / plan/29 E5 (window.prompt 대체).
//
// `window.prompt()` 의 OS 다이얼로그 대체:
//   1. a11y / 키보드 일관성 (i18n + focus management)
//   2. 한글 IME composition 안전 (input element + IME 정상 동작)
//   3. 디자인 통일 (BaseModal 재사용)
//
// 사용:
//   import { promptDialog } from '@/composables/useConfirm'
//   const v = await promptDialog({ title, message, defaultValue: 'foo' })
//   if (v == null) return                 // cancel
//   const trimmed = v.trim()
//   if (!trimmed) return                  // empty
//
// App.vue 에 한 번 마운트.
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from './BaseModal.vue'
import { usePromptDialogState } from '@/composables/useConfirm'

const { t } = useI18n()
const state = usePromptDialogState()

const open = computed(() => state.isOpen.value)
const opts = computed(() => state.options.value)

const titleText = computed(() => opts.value.title || t('confirm.title'))
const cancelText = computed(() => opts.value.cancelText || t('common.cancel'))
const confirmText = computed(() => opts.value.confirmText || t('confirm.confirm'))

const inputValue = ref<string>('')

// 다이얼로그 open 시 defaultValue 채우고 input focus.
const inputRef = useTemplateRef<HTMLInputElement>('inputRef')
watch(open, async (next) => {
  if (!next) return
  inputValue.value = opts.value.defaultValue ?? ''
  await nextTick()
  inputRef.value?.focus()
  inputRef.value?.select()
})

function onCancel() {
  state.resolve(null)
}
function onConfirm() {
  state.resolve(inputValue.value)
}
function onKeydown(e: KeyboardEvent) {
  if (!open.value) return
  // 한글 IME composition 중에는 Enter 가 confirm 으로 새지 않음.
  if (e.key === 'Enter' && !e.isComposing) {
    e.preventDefault()
    e.stopPropagation()
    onConfirm()
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    max-width="sm"
    :title="titleText"
    :show-close-button="false"
    @close="onCancel"
  >
    <div class="px-4 py-3 text-sm">
      <p class="mb-2 whitespace-pre-wrap">{{ opts.message }}</p>
      <input
        ref="inputRef"
        v-model="inputValue"
        type="text"
        :placeholder="opts.placeholder ?? ''"
        class="w-full rounded border border-input bg-background px-2 py-1 font-mono text-xs"
        @keydown="onKeydown"
      />
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="rounded border border-input px-3 py-1 text-sm hover:bg-accent"
          @click="onCancel"
        >
          {{ cancelText }}
        </button>
        <button
          type="button"
          class="rounded bg-primary px-3 py-1 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          @click="onConfirm"
        >
          {{ confirmText }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>
