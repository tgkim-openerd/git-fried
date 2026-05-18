<script setup lang="ts">
// Plan #42 H-1 (Sprint c96+) — Conflict Prevention Settings UI 노출
//
// 트리거: Plan #41 Step 1 발견 — GitKraken Settings 의 Repo-Specific Preferences
// 가 10 항목 (이전 단정 3 REFUTED). Conflict Prevention 은 이미 Rust IPC
// (conflict_prediction.rs + v02_commands::predict_target_conflict) + Vue
// useUserSettings.ts 의 conflictDetection: boolean 으로 구현됨. Settings UI 노출만 신규.
//
// 패턴: SettingsGeneral.vue 와 동일 — useGeneralSettings() Ref<GeneralSettings>
// 에 직접 v-model. localStorage persist 는 useUserSettings 의 watch 가 처리.
//
// per-repo override 는 다음 sprint (M-1.1, RepoSpecificForm + DB migration 패턴) —
// global default 먼저.

import { useI18n } from 'vue-i18n'
import { useGeneralSettings } from '@/composables/useUserSettings'

const { t } = useI18n()
const general = useGeneralSettings()
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-4">
    <h2 class="text-lg font-semibold">{{ t('settings.conflictPrevention.title') }}</h2>
    <p class="text-xs text-muted-foreground">
      {{ t('settings.conflictPrevention.description') }}
    </p>

    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span>
        <span class="font-medium">{{ t('settings.conflictPrevention.enabledLabel') }}</span>
        <span class="ml-2 text-xs text-muted-foreground">
          {{ t('settings.conflictPrevention.enabledHint') }}
        </span>
      </span>
      <input
        v-model="general.conflictDetection"
        type="checkbox"
        data-testid="conflict-prevention-enabled"
      />
    </label>

    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span>
        <span class="font-medium">{{ t('settings.conflictPrevention.intervalLabel') }}</span>
        <span class="ml-2 text-xs text-muted-foreground">
          {{ t('settings.conflictPrevention.intervalHint') }}
        </span>
      </span>
      <span class="flex items-center gap-2">
        <input
          v-model.number="general.conflictDetectionIntervalMin"
          type="number"
          min="0"
          max="60"
          :disabled="!general.conflictDetection"
          class="w-20 rounded border border-input bg-background px-2 py-1 text-right text-sm disabled:opacity-50"
          data-testid="conflict-prevention-interval"
        />
        <span class="text-xs text-muted-foreground">{{
          t('settings.conflictPrevention.intervalUnit')
        }}</span>
      </span>
    </label>

    <p
      class="rounded border border-blue-500/40 bg-blue-500/10 p-2 text-xs text-blue-700 dark:text-blue-400"
    >
      {{ t('settings.conflictPrevention.perRepoNote') }}
    </p>
  </div>
</template>
