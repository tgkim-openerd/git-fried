<script setup lang="ts">
// Sprint c40 후속 — settings.vue 의 Editor / Terminal 영역 sub-component.
//
// 단순 표시 영역 (zoom 정보 외 props 0). zoomPx 는 useUiState 에서 직접 조회.
// c60 — i18n 마이그.
// v0.4 #6 (UltraPlan plan/31) — 외부 editor 통합 (GK Settings 매트릭스 GK7).
import { useI18n } from 'vue-i18n'
import { useUiState } from '@/composables/useUiState'
import { useUiSettingsStore, type ExternalEditorKind } from '@/composables/useUserSettings'

const { t } = useI18n()
const uiState = useUiState()
const uiSettings = useUiSettingsStore()

// v-model 의 직접 바인딩 — useUiSettingsStore 가 ref<UiSettings> 라 .value 통해 mutate.
function setExternalEditor(kind: ExternalEditorKind) {
  uiSettings.value = { ...uiSettings.value, externalEditor: kind }
}

const EDITOR_OPTIONS: { kind: ExternalEditorKind; labelKey: string }[] = [
  { kind: 'none', labelKey: 'settings.editor.external.none' },
  { kind: 'vscode', labelKey: 'settings.editor.external.vscode' },
  { kind: 'vscode-insiders', labelKey: 'settings.editor.external.vscodeInsiders' },
  { kind: 'cursor', labelKey: 'settings.editor.external.cursor' },
  { kind: 'sublime', labelKey: 'settings.editor.external.sublime' },
  { kind: 'intellij', labelKey: 'settings.editor.external.intellij' },
  { kind: 'webstorm', labelKey: 'settings.editor.external.webstorm' },
]
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-4">
    <h2 class="text-lg font-semibold">{{ t('settings.editor.title') }}</h2>
    <p class="text-xs text-muted-foreground">
      {{ t('settings.editor.description') }}
    </p>

    <!-- v0.4 #6 — 외부 editor 통합 dropdown -->
    <fieldset class="rounded border border-border p-3">
      <legend class="px-1 text-xs font-semibold">
        {{ t('settings.editor.external.legend') }}
      </legend>
      <label class="mt-1 flex items-start justify-between gap-3 text-xs">
        <div class="flex flex-col gap-0.5">
          <span class="font-medium">{{ t('settings.editor.external.label') }}</span>
          <span class="text-3xs text-muted-foreground">
            {{ t('settings.editor.external.hint') }}
          </span>
        </div>
        <select
          :value="uiSettings.externalEditor"
          :aria-label="t('settings.editor.external.label')"
          class="w-72 rounded border border-input bg-background px-2 py-1 text-xs"
          @change="
            setExternalEditor(($event.target as HTMLSelectElement).value as ExternalEditorKind)
          "
        >
          <option v-for="opt in EDITOR_OPTIONS" :key="opt.kind" :value="opt.kind">
            {{ t(opt.labelKey) }}
          </option>
        </select>
      </label>
    </fieldset>

    <ul
      class="space-y-1 rounded border border-border bg-muted/20 p-3 text-xs text-muted-foreground"
    >
      <li>{{ t('settings.editor.fontSizeRow', { n: uiState.zoomPx.value }) }}</li>
      <li>{{ t('settings.editor.diffModeRow') }}</li>
      <li>{{ t('settings.editor.terminalRow') }}</li>
    </ul>
    <p class="text-3xs text-muted-foreground">
      {{ t('settings.editor.futureNote') }}
    </p>
  </div>
</template>
