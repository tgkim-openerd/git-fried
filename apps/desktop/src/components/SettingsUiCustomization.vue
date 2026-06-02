<script setup lang="ts">
// Sprint c40 후속 — settings.vue 의 UI Customization 영역 sub-component.
//
// 의존: useUiSettingsStore + useCustomTheme + useThemeIO (custom theme JSON).
// c61 — i18n 마이그.
import { useI18n } from 'vue-i18n'
import { useUiSettingsStore } from '@/composables/useUserSettings'
import { useCustomTheme } from '@/composables/useCustomTheme'
import { useThemeIO } from '@/composables/useThemeIO'

const { t } = useI18n()
const ui = useUiSettingsStore()
const ctheme = useCustomTheme()
const {
  exportText: themeExportText,
  importText: themeImportText,
  onExport: onExportTheme,
  onImport: onImportTheme,
  onReset: onResetTheme,
  onCopy: copyThemeExport,
} = useThemeIO()
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-4">
    <h2 class="text-lg font-semibold">{{ t('settings.uiCustomization.title') }}</h2>
    <p class="text-xs text-muted-foreground">
      {{ t('settings.uiCustomization.description') }}
    </p>

    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span class="font-medium">{{ t('settings.uiCustomization.dateLocaleLabel') }}</span>
      <select
        v-model="ui.dateLocale"
        class="w-32 rounded border border-input bg-background px-2 py-1 text-sm"
      >
        <option value="auto">{{ t('settings.uiCustomization.dateLocaleAuto') }}</option>
        <option value="ko-KR">{{ t('settings.uiCustomization.dateLocaleKo') }}</option>
        <option value="en-US">{{ t('settings.uiCustomization.dateLocaleEn') }}</option>
      </select>
    </label>

    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span>
        <span class="font-medium">{{ t('settings.uiCustomization.hideLaunchpadLabel') }}</span>
        <span class="ml-2 text-xs text-muted-foreground">
          {{ t('settings.uiCustomization.hideLaunchpadHint') }}
        </span>
      </span>
      <input v-model="ui.hideLaunchpad" type="checkbox" />
    </label>

    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span class="font-medium">{{ t('settings.uiCustomization.avatarStyleLabel') }}</span>
      <select
        v-model="ui.avatarStyle"
        class="w-32 rounded border border-input bg-background px-2 py-1 text-sm"
      >
        <option value="initial">{{ t('settings.uiCustomization.avatarStyleInitial') }}</option>
        <option value="gravatar">{{ t('settings.uiCustomization.avatarStyleGravatar') }}</option>
      </select>
    </label>

    <!-- plan/30 P3-3 — commit time format -->
    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span>
        <span class="font-medium">{{ t('settings.uiCustomization.commitTimeFormatLabel') }}</span>
        <span class="ml-2 text-xs text-muted-foreground">
          {{ t('settings.uiCustomization.commitTimeFormatHint') }}
        </span>
      </span>
      <select
        v-model="ui.commitTimeFormat"
        class="w-32 rounded border border-input bg-background px-2 py-1 text-sm"
      >
        <option value="absolute">
          {{ t('settings.uiCustomization.commitTimeFormatAbsolute') }}
        </option>
        <option value="relative">
          {{ t('settings.uiCustomization.commitTimeFormatRelative') }}
        </option>
        <option value="both">{{ t('settings.uiCustomization.commitTimeFormatBoth') }}</option>
      </select>
    </label>

    <!-- plan/30 P1-5 — Mini sidebar 섹션 visibility -->
    <fieldset class="rounded border border-border p-3 text-sm">
      <legend class="px-1 font-medium">
        {{ t('settings.uiCustomization.miniSidebarLegend') }}
      </legend>
      <p class="mb-2 text-xs text-muted-foreground">
        {{ t('settings.uiCustomization.miniSidebarHint') }}
      </p>
      <div class="grid grid-cols-2 gap-1.5 text-xs">
        <label class="flex items-center gap-1.5">
          <input v-model="ui.miniSidebarSections.branch" type="checkbox" />
          {{ t('settings.uiCustomization.miniBranch') }}
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="ui.miniSidebarSections.remote" type="checkbox" />
          {{ t('settings.uiCustomization.miniRemote') }}
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="ui.miniSidebarSections.worktree" type="checkbox" />
          {{ t('settings.uiCustomization.miniWorktree') }}
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="ui.miniSidebarSections.stash" type="checkbox" />
          {{ t('settings.uiCustomization.miniStash') }}
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="ui.miniSidebarSections.submodule" type="checkbox" />
          {{ t('settings.uiCustomization.miniSubmodule') }}
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="ui.miniSidebarSections.pr" type="checkbox" />
          {{ t('settings.uiCustomization.miniPr') }}
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="ui.miniSidebarSections.tag" type="checkbox" />
          {{ t('settings.uiCustomization.miniTag') }}
        </label>
      </div>
    </fieldset>

    <p class="text-3xs text-muted-foreground">
      {{ t('settings.uiCustomization.futureNote') }}
    </p>

    <!-- Sprint C4 — Custom theme JSON -->
    <h3 class="mt-4 text-sm font-semibold">
      {{ t('settings.uiCustomization.customThemeTitle') }}
    </h3>
    <p class="text-xs text-muted-foreground">
      {{ t('settings.uiCustomization.customThemeDescription') }}
      {{
        ctheme.customTheme.value
          ? t('settings.uiCustomization.customThemeApplied', {
              name: ctheme.customTheme.value.name,
            })
          : t('settings.uiCustomization.customThemeNone')
      }}
    </p>
    <div class="flex gap-2">
      <button
        type="button"
        class="rounded border border-input px-2 py-0.5 text-xs hover:bg-accent"
        @click="onExportTheme"
      >
        {{ t('settings.uiCustomization.btnExportTheme') }}
      </button>
      <button
        v-if="ctheme.customTheme.value"
        type="button"
        class="rounded border border-destructive/40 px-2 py-0.5 text-xs text-destructive hover:bg-destructive/10"
        @click="onResetTheme"
      >
        {{ t('settings.uiCustomization.btnResetTheme') }}
      </button>
    </div>
    <textarea
      v-if="themeExportText"
      :value="themeExportText"
      readonly
      rows="6"
      class="mt-1 w-full rounded border border-border bg-muted/20 p-2 font-mono text-2xs"
    />
    <button
      v-if="themeExportText"
      type="button"
      class="self-end rounded border border-input px-2 py-0.5 text-xs hover:bg-accent"
      @click="copyThemeExport"
    >
      {{ t('settings.uiCustomization.btnCopy') }}
    </button>
    <textarea
      v-model="themeImportText"
      rows="5"
      :placeholder="t('settings.uiCustomization.importPlaceholder')"
      class="mt-3 w-full rounded border border-border bg-background p-2 font-mono text-2xs"
    />
    <button
      type="button"
      class="self-end rounded bg-primary px-3 py-0.5 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
      :disabled="!themeImportText.trim()"
      @click="onImportTheme"
    >
      {{ t('settings.uiCustomization.btnImport') }}
    </button>
  </div>
</template>
