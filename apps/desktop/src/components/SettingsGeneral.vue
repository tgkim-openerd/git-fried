<script setup lang="ts">
// Sprint c40 후속 — settings.vue 의 General 영역 sub-component.
//
// localStorage 영속 (useGeneralSettings composable 직접 사용).
import { useI18n } from 'vue-i18n'
import { useGeneralSettings } from '@/composables/useUserSettings'

const { t } = useI18n()
const general = useGeneralSettings()
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-4">
    <h2 class="text-lg font-semibold">{{ t('settings.general.title') }}</h2>
    <p class="text-xs text-muted-foreground">
      {{ t('settings.general.description') }}
    </p>

    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span>
        <span class="font-medium">{{ t('settings.general.autoFetchLabel') }}</span>
        <span class="ml-2 text-xs text-muted-foreground">
          {{ t('settings.general.autoFetchHint') }}
        </span>
      </span>
      <input
        v-model.number="general.autoFetchIntervalMin"
        type="number"
        min="0"
        max="120"
        class="w-20 rounded border border-input bg-background px-2 py-1 text-right text-sm"
      />
    </label>

    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span>
        <span class="font-medium">{{ t('settings.general.autoPruneLabel') }}</span>
        <span class="ml-2 text-xs text-muted-foreground">{{ t('templ.autoPruneHint') }}</span>
      </span>
      <input v-model="general.autoPruneOnFetch" type="checkbox" />
    </label>

    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span>
        <span class="font-medium">{{ t('settings.general.rememberTabsLabel') }}</span>
        <span class="ml-2 text-xs text-muted-foreground">
          {{ t('settings.general.rememberTabsHint') }}
        </span>
      </span>
      <input v-model="general.rememberTabs" type="checkbox" disabled />
    </label>
    <p class="-mt-3 text-3xs text-muted-foreground">
      {{ t('settings.general.rememberTabsNote') }}
    </p>

    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span>
        <span class="font-medium">{{ t('settings.general.defaultBranchLabel') }}</span>
      </span>
      <input
        v-model="general.defaultBranch"
        class="w-32 rounded border border-input bg-background px-2 py-1 text-sm"
      />
    </label>

    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span>
        <span class="font-medium">{{ t('settings.general.conflictDetectionLabel') }}</span>
        <span class="ml-2 text-xs text-muted-foreground">
          {{ t('settings.general.conflictDetectionHint') }}
        </span>
      </span>
      <input v-model="general.conflictDetection" type="checkbox" />
    </label>

    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span>
        <span class="font-medium">{{ t('settings.general.autoSubmoduleLabel') }}</span>
        <span class="ml-2 text-xs text-muted-foreground">
          {{ t('settings.general.autoSubmoduleHint') }}
        </span>
      </span>
      <input v-model="general.autoUpdateSubmodules" type="checkbox" />
    </label>

    <p class="text-3xs text-muted-foreground">
      {{ t('settings.general.futureNote') }}
    </p>
  </div>
</template>
