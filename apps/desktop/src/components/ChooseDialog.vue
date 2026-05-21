<script setup lang="ts">
// UXF-10 — 다중 옵션 action sheet (confirm/prompt 형제).
//
// `window.prompt('m | r | cancel')` 같은 텍스트 입력 안티패턴 대체 (Hick's Law).
// 사용:
//   import { chooseDialog } from '@/composables/useConfirm'
//   const v = await chooseDialog({ title, message, options: [...] })
//
// App.vue 에 한 번 마운트 (singleton pattern).
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from './BaseModal.vue'
import { useChooseDialogState } from '@/composables/useConfirm'

const { t } = useI18n()
const state = useChooseDialogState()

const open = computed(() => state.isOpen.value)
const opts = computed(() => state.options.value)

const titleText = computed(() => opts.value.title || t('confirm.title'))
const cancelText = computed(() => opts.value.cancelText || t('common.cancel'))

function onCancel() {
  state.resolve(null)
}
function onChoose(value: string) {
  state.resolve(value)
}

// open 시 첫 옵션 버튼 auto-focus.
const firstBtn = useTemplateRef<HTMLButtonElement>('firstBtn')
watch(open, async (next) => {
  if (!next) return
  await nextTick()
  firstBtn.value?.focus()
})
</script>

<template>
  <BaseModal
    :open="open"
    max-width="sm"
    :title="titleText"
    :show-close-button="false"
    @close="onCancel"
  >
    <div class="px-4 py-3 text-sm whitespace-pre-wrap">
      {{ opts.message }}
    </div>
    <template #footer>
      <div class="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          class="rounded border border-input px-3 py-1 text-sm hover:bg-accent"
          @click="onCancel"
        >
          {{ cancelText }}
        </button>
        <button
          v-for="(o, i) in opts.options"
          :key="o.value"
          :ref="i === 0 ? 'firstBtn' : undefined"
          type="button"
          :class="[
            'rounded px-3 py-1 text-sm font-medium',
            o.danger
              ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              : 'bg-primary text-primary-foreground hover:bg-primary/90',
          ]"
          @click="onChoose(o.value)"
        >
          {{ o.label }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>
