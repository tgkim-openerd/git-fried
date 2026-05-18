<script setup lang="ts">
// Plan #42 H-2 (Sprint c96+) — Git LFS Settings UI 노출
//
// 트리거: Plan #41 Step 1 발견 — GitKraken Settings 의 Repo-Specific Preferences
// 10 항목 중 LFS. git-fried 는 이미 Rust `lfs.rs` + `lfs_commands.rs` (9 IPC) +
// Vue `LfsPanel.vue` (280 LOC) 으로 구현됨. Settings 페이지 진입점만 신규.
//
// 패턴: LfsPanel 을 Settings 안에서 wrap — useReposStore.activeRepoId 전달.
// 다른 SettingsXxx.vue 와 일관 — 상단 title + description + active repo guard.

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useReposStore } from '@/stores/repos'
import LfsPanel from '@/components/LfsPanel.vue'

const { t } = useI18n()
const reposStore = useReposStore()

const activeRepoId = computed<number | null>(() => reposStore.activeRepoId)
</script>

<template>
  <div class="flex max-w-4xl flex-col gap-4">
    <h2 class="text-lg font-semibold">{{ t('settings.lfs.title') }}</h2>
    <p class="text-xs text-muted-foreground">
      {{ t('settings.lfs.description') }}
    </p>

    <p
      v-if="activeRepoId == null"
      class="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400"
    >
      {{ t('settings.lfs.noActiveRepoWarning') }}
    </p>

    <p
      class="rounded border border-blue-500/40 bg-blue-500/10 p-2 text-xs text-blue-700 dark:text-blue-400"
    >
      {{ t('settings.lfs.perRepoNote') }}
    </p>

    <LfsPanel :repo-id="activeRepoId" />
  </div>
</template>
