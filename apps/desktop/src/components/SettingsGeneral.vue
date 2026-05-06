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
    <h2 class="text-lg font-semibold">General</h2>
    <p class="text-xs text-muted-foreground">
      GitKraken Preferences > General 의 핵심 토글 흡수. localStorage 영속.
    </p>

    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span>
        <span class="font-medium">Auto-Fetch 간격 (분)</span>
        <span class="ml-2 text-xs text-muted-foreground">0 = 비활성</span>
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
        <span class="font-medium">Auto-Prune on fetch</span>
        <span class="ml-2 text-xs text-muted-foreground">{{ t('templ.autoPruneHint') }}</span>
      </span>
      <input v-model="general.autoPruneOnFetch" type="checkbox" />
    </label>

    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span>
        <span class="font-medium">Remember tabs per profile</span>
        <span class="ml-2 text-xs text-muted-foreground">profile 전환 시 마지막 탭 복원</span>
      </span>
      <input v-model="general.rememberTabs" type="checkbox" disabled />
    </label>
    <p class="-mt-3 text-[10px] text-muted-foreground">
      (영구 활성 — Sprint B10 의 useTabPerProfile composable 동작.)
    </p>

    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span>
        <span class="font-medium">Default 브랜치 (새 레포)</span>
      </span>
      <input
        v-model="general.defaultBranch"
        class="w-32 rounded border border-input bg-background px-2 py-1 text-sm"
      />
    </label>

    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span>
        <span class="font-medium">Conflict Detection</span>
        <span class="ml-2 text-xs text-muted-foreground">
          StatusBar 의 target-branch 충돌 예측 (60s 폴링)
        </span>
      </span>
      <input v-model="general.conflictDetection" type="checkbox" />
    </label>

    <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
      <span>
        <span class="font-medium">Pull 후 submodule 자동 update</span>
        <span class="ml-2 text-xs text-muted-foreground">
          git submodule update --init --recursive
        </span>
      </span>
      <input v-model="general.autoUpdateSubmodules" type="checkbox" />
    </label>

    <p class="text-[10px] text-muted-foreground">
      v1.x 추가 예정: .orig 자동 삭제 / Longpaths / AutoCRLF / Logging level.
    </p>
  </div>
</template>
