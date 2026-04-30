<script setup lang="ts">
// 공용 Confirm 다이얼로그 — Sprint c33 (Phase 0 UX gap fix).
//
// `window.confirm()` 대체 — Von Restorff (danger 시각 구분) + i18n + Jakob's Law 동시 해소.
//
// 사용:
//   import { confirmDialog } from '@/composables/useConfirm'
//   const ok = await confirmDialog({ title, message, danger: true })
//
// 본 컴포넌트는 App.vue 에 한 번 마운트만 됨 (singleton pattern).
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from './BaseModal.vue'
import { useConfirmDialogState } from '@/composables/useConfirm'

const { t } = useI18n()
const state = useConfirmDialogState()

const open = computed(() => state.isOpen.value)
const opts = computed(() => state.options.value)

const titleText = computed(() => opts.value.title || t('confirm.title'))
const cancelText = computed(() => opts.value.cancelText || t('common.cancel'))
const confirmText = computed(() => opts.value.confirmText || t('confirm.confirm'))
const isDanger = computed(() => opts.value.danger === true)

function onCancel() {
  state.resolve(false)
}
function onConfirm() {
  state.resolve(true)
}

// danger=false 시 Enter 자동 확인 (사용자 빠른 진행)
// danger=true 시 Enter 비활성 (실수 방지 — 명시적 클릭 또는 Tab + Space 필요)
function onKeydown(e: KeyboardEvent) {
  if (!open.value) return
  if (e.key === 'Enter' && !isDanger.value) {
    e.preventDefault()
    e.stopPropagation()
    onConfirm()
  }
}

// open 시 적절한 버튼 auto-focus.
//   danger=true → cancel 버튼 (실수 방지)
//   danger=false → confirm 버튼 (빠른 Enter)
const cancelBtn = useTemplateRef<HTMLButtonElement>('cancelBtn')
const confirmBtn = useTemplateRef<HTMLButtonElement>('confirmBtn')
watch(open, async (next) => {
  if (!next) return
  await nextTick()
  if (isDanger.value) cancelBtn.value?.focus()
  else confirmBtn.value?.focus()
})
</script>

<template>
  <BaseModal
    :open="open"
    max-width="sm"
    :title="titleText"
    :show-close-button="false"
    :close-on-backdrop="!isDanger"
    @close="onCancel"
  >
    <div class="px-4 py-3 text-sm whitespace-pre-wrap" @keydown="onKeydown">
      {{ opts.message }}
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <button
          ref="cancelBtn"
          type="button"
          class="rounded border border-input px-3 py-1 text-sm hover:bg-accent"
          @click="onCancel"
        >
          {{ cancelText }}
        </button>
        <button
          ref="confirmBtn"
          type="button"
          :class="[
            'rounded px-3 py-1 text-sm font-medium',
            isDanger
              ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              : 'bg-primary text-primary-foreground hover:bg-primary/90',
          ]"
          @click="onConfirm"
        >
          {{ confirmText }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>
