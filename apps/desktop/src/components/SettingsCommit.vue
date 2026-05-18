<script setup lang="ts">
// Plan #42 H-4 (Sprint c96+) — Commit Settings UI
//
// 트리거: Plan #41 Step 1 발견 — GitKraken Settings 의 Repo-Specific Preferences
// 10 항목 중 Commit. 4 toggle + Commit Template (Apply / Summary 72 / Description body /
// Remove comments).
//
// 본 sprint = UI + persistence 만. mutation 측 실 적용 (push-after IPC / --no-verify /
// squash default / template substitution) 은 별도 sprint M-1.2.

import { useI18n } from 'vue-i18n'
import { useGeneralSettings } from '@/composables/useUserSettings'

const { t } = useI18n()
const general = useGeneralSettings()
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-4">
    <h2 class="text-lg font-semibold">{{ t('settings.commitPage.title') }}</h2>
    <p class="text-xs text-muted-foreground">
      {{ t('settings.commitPage.description') }}
    </p>

    <p
      class="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400"
    >
      {{ t('settings.commitPage.uiOnlyNote') }}
    </p>

    <!-- 1. Push after each commit -->
    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span>
        <span class="font-medium">{{ t('settings.commitPage.pushAfterLabel') }}</span>
        <span class="ml-2 text-xs text-muted-foreground">
          {{ t('settings.commitPage.pushAfterHint') }}
        </span>
      </span>
      <input v-model="general.commitPushAfter" type="checkbox" data-testid="commit-push-after" />
    </label>

    <!-- 2. Skip git hooks -->
    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span>
        <span class="font-medium">{{ t('settings.commitPage.skipHooksLabel') }}</span>
        <span class="ml-2 text-xs text-muted-foreground">
          {{ t('settings.commitPage.skipHooksHint') }}
        </span>
      </span>
      <input v-model="general.commitSkipHooks" type="checkbox" data-testid="commit-skip-hooks" />
    </label>

    <!-- 3. Squash by default -->
    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span>
        <span class="font-medium">{{ t('settings.commitPage.squashLabel') }}</span>
        <span class="ml-2 text-xs text-muted-foreground">
          {{ t('settings.commitPage.squashHint') }}
        </span>
      </span>
      <input
        v-model="general.commitSquashByDefault"
        type="checkbox"
        data-testid="commit-squash-default"
      />
    </label>

    <!-- 4. Remove comments -->
    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span>
        <span class="font-medium">{{ t('settings.commitPage.removeCommentsLabel') }}</span>
        <span class="ml-2 text-xs text-muted-foreground">
          {{ t('settings.commitPage.removeCommentsHint') }}
        </span>
      </span>
      <input
        v-model="general.commitRemoveComments"
        type="checkbox"
        data-testid="commit-remove-comments"
      />
    </label>

    <!-- 5. Commit Template -->
    <div class="flex flex-col gap-2 rounded border border-border p-3 text-sm">
      <label class="flex flex-col gap-1">
        <span class="font-medium">{{ t('settings.commitPage.templateLabel') }}</span>
        <span class="text-xs text-muted-foreground">
          {{ t('settings.commitPage.templateHint') }}
        </span>
        <textarea
          v-model="general.commitTemplate"
          :placeholder="t('settings.commitPage.templatePlaceholder')"
          rows="6"
          class="mt-1 rounded border border-input bg-background px-2 py-1 font-mono text-xs"
          data-testid="commit-template"
        ></textarea>
      </label>
    </div>
  </div>
</template>
