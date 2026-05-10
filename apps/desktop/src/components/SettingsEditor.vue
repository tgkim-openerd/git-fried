<script setup lang="ts">
// Sprint c40 후속 — settings.vue 의 Editor / Terminal 영역 sub-component.
//
// 단순 표시 영역 (zoom 정보 외 props 0). zoomPx 는 useUiState 에서 직접 조회.
// c60 — i18n 마이그.
import { useI18n } from 'vue-i18n'
import { useUiState } from '@/composables/useUiState'

const { t } = useI18n()
const uiState = useUiState()
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-4">
    <h2 class="text-lg font-semibold">{{ t('settings.editor.title') }}</h2>
    <p class="text-xs text-muted-foreground">
      {{ t('settings.editor.description') }}
    </p>
    <ul
      class="space-y-1 rounded border border-border bg-muted/20 p-3 text-xs text-muted-foreground"
    >
      <li>{{ t('settings.editor.fontSizeRow', { n: uiState.zoomPx.value }) }}</li>
      <li>{{ t('settings.editor.diffModeRow') }}</li>
      <li>{{ t('settings.editor.terminalRow') }}</li>
    </ul>
    <p class="text-[10px] text-muted-foreground">
      {{ t('settings.editor.futureNote') }}
    </p>
  </div>
</template>
