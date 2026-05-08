<script setup lang="ts">
// Sprint c40 후속 — settings.vue 의 UI Customization 영역 sub-component.
//
// 의존: useUiSettingsStore + useCustomTheme + useThemeIO (custom theme JSON).
import { useUiSettingsStore } from '@/composables/useUserSettings'
import { useCustomTheme } from '@/composables/useCustomTheme'
import { useThemeIO } from '@/composables/useThemeIO'

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
    <h2 class="text-lg font-semibold">UI Customization</h2>
    <p class="text-xs text-muted-foreground">
      Theme / Zoom / Sidebar / Detail 패널은 ⌘ 단축키 + localStorage. 추가 토글 일부 v1.x.
    </p>

    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span class="font-medium">Date locale</span>
      <select
        v-model="ui.dateLocale"
        class="w-32 rounded border border-input bg-background px-2 py-1 text-sm"
      >
        <option value="auto">자동 (OS)</option>
        <option value="ko-KR">한국어</option>
        <option value="en-US">English</option>
      </select>
    </label>

    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span>
        <span class="font-medium">Launchpad 숨김</span>
        <span class="ml-2 text-xs text-muted-foreground">상단 헤더 링크 숨김</span>
      </span>
      <input v-model="ui.hideLaunchpad" type="checkbox" />
    </label>

    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span class="font-medium">아바타 스타일</span>
      <select
        v-model="ui.avatarStyle"
        class="w-32 rounded border border-input bg-background px-2 py-1 text-sm"
      >
        <option value="initial">이니셜</option>
        <option value="gravatar">Gravatar</option>
      </select>
    </label>

    <!-- plan/30 P3-3 — commit time format -->
    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span>
        <span class="font-medium">Commit 시간 형식</span>
        <span class="ml-2 text-xs text-muted-foreground">절대 / 상대 / 둘 다</span>
      </span>
      <select
        v-model="ui.commitTimeFormat"
        class="w-32 rounded border border-input bg-background px-2 py-1 text-sm"
      >
        <option value="absolute">절대 (05.08 17:40)</option>
        <option value="relative">상대 (3시간 전)</option>
        <option value="both">둘 다</option>
      </select>
    </label>

    <!-- plan/30 P1-5 — Mini sidebar 섹션 visibility -->
    <fieldset class="rounded border border-border p-3 text-sm">
      <legend class="px-1 font-medium">Mini sidebar 섹션 표시</legend>
      <p class="mb-2 text-xs text-muted-foreground">
        좌측 사이드바 9 섹션 (Miller 7±2 상한) — 사용 빈도 낮은 섹션 숨김 가능.
      </p>
      <div class="grid grid-cols-2 gap-1.5 text-xs">
        <label class="flex items-center gap-1.5">
          <input v-model="ui.miniSidebarSections.branch" type="checkbox" /> LOCAL 브랜치
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="ui.miniSidebarSections.remote" type="checkbox" /> REMOTE
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="ui.miniSidebarSections.worktree" type="checkbox" /> Worktree
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="ui.miniSidebarSections.stash" type="checkbox" /> Stash
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="ui.miniSidebarSections.submodule" type="checkbox" /> Submodule
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="ui.miniSidebarSections.pr" type="checkbox" /> Open PR
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="ui.miniSidebarSections.tag" type="checkbox" /> Tag
        </label>
      </div>
    </fieldset>

    <p class="text-[10px] text-muted-foreground">
      v1.x 추가 예정: 그래프 메타데이터 토글 / 알림 위치.
    </p>

    <!-- Sprint C4 — Custom theme JSON -->
    <h3 class="mt-4 text-sm font-semibold">Custom theme (JSON)</h3>
    <p class="text-xs text-muted-foreground">
      GitKraken 11.8 부터 일시 비활성된 custom theme — git-fried 가 단순 CSS 변수 export/import 로
      흡수.
      {{
        ctheme.customTheme.value
          ? `현재 적용 중: ${ctheme.customTheme.value.name}`
          : '커스텀 미적용'
      }}
    </p>
    <div class="flex gap-2">
      <button
        type="button"
        class="rounded border border-input px-2 py-0.5 text-xs hover:bg-accent"
        @click="onExportTheme"
      >
        현재 테마 export
      </button>
      <button
        v-if="ctheme.customTheme.value"
        type="button"
        class="rounded border border-destructive/40 px-2 py-0.5 text-xs text-destructive hover:bg-destructive/10"
        @click="onResetTheme"
      >
        기본값 복원
      </button>
    </div>
    <textarea
      v-if="themeExportText"
      :value="themeExportText"
      readonly
      rows="6"
      class="mt-1 w-full rounded border border-border bg-muted/20 p-2 font-mono text-[11px]"
    />
    <button
      v-if="themeExportText"
      type="button"
      class="self-end rounded border border-input px-2 py-0.5 text-xs hover:bg-accent"
      @click="copyThemeExport"
    >
      복사
    </button>
    <textarea
      v-model="themeImportText"
      rows="5"
      placeholder='커스텀 테마 JSON 붙여넣기 — { "name": "...", "mode": "dark"|"light", "vars": { "--background": "240 10% 3.9%", ... } }'
      class="mt-3 w-full rounded border border-border bg-background p-2 font-mono text-[11px]"
    />
    <button
      type="button"
      class="self-end rounded bg-primary px-3 py-0.5 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
      :disabled="!themeImportText.trim()"
      @click="onImportTheme"
    >
      Import / 적용
    </button>
  </div>
</template>
