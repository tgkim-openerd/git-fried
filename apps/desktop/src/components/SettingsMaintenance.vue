<script setup lang="ts">
// Sprint c40 god comp 분리 — settings.vue (613 LOC) 의 Maintenance (gc / fsck /
// LFS install) 영역 sub-component 분리.
//
// 의존: useReposStore (활성 레포 guard) + useMaintenanceActions (gc/fsck/lfs mutation +
// confirm + result/label).
import { useI18n } from 'vue-i18n'
import { useReposStore } from '@/stores/repos'
import { useMaintenanceActions } from '@/composables/useMaintenanceActions'

const { t } = useI18n()
const reposStore = useReposStore()
const { gcMut, fsckMut, lfsInstallMut, maintLabel, maintResult, confirmAggressiveGc } =
  useMaintenanceActions()
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-4">
    <h2 class="text-lg font-semibold">{{ t('templ.repoMaintenance') }}</h2>
    <p class="text-xs text-muted-foreground">
      {{ t('settings.maintenanceSection.description') }}
    </p>

    <p
      v-if="reposStore.activeRepoId == null"
      class="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400"
    >
      {{ t('settings.maintenanceSection.noActiveRepoWarning') }}
    </p>

    <div v-else class="flex flex-col gap-3 rounded border border-border bg-muted/20 p-4">
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded border border-border bg-background px-3 py-1 text-xs hover:bg-accent/40 disabled:opacity-50"
          :disabled="gcMut.isPending.value"
          @click="gcMut.mutate(false)"
        >
          git gc
          <span class="ml-1 text-[10px] text-muted-foreground">
            {{ t('settings.maintenanceSection.gcHint') }}
          </span>
        </button>
        <button
          type="button"
          class="rounded border border-border bg-background px-3 py-1 text-xs hover:bg-accent/40 disabled:opacity-50"
          :disabled="gcMut.isPending.value"
          @click="confirmAggressiveGc"
        >
          git gc --aggressive --prune=now
        </button>
        <button
          type="button"
          class="rounded border border-border bg-background px-3 py-1 text-xs hover:bg-accent/40 disabled:opacity-50"
          :disabled="fsckMut.isPending.value"
          @click="fsckMut.mutate()"
        >
          git fsck --full
          <span class="ml-1 text-[10px] text-muted-foreground">
            {{ t('settings.maintenanceSection.fsckHint') }}
          </span>
        </button>
        <button
          type="button"
          class="rounded border border-border bg-background px-3 py-1 text-xs hover:bg-accent/40 disabled:opacity-50"
          :disabled="lfsInstallMut.isPending.value"
          @click="lfsInstallMut.mutate()"
        >
          git lfs install
          <span class="ml-1 text-[10px] text-muted-foreground">
            {{ t('settings.maintenanceSection.lfsInstallHint') }}
          </span>
        </button>
      </div>

      <p
        v-if="gcMut.isPending.value || fsckMut.isPending.value || lfsInstallMut.isPending.value"
        class="text-xs text-muted-foreground"
      >
        {{ t('settings.maintenanceSection.running') }}
      </p>

      <div v-if="maintResult" class="mt-2 border-t border-border pt-3">
        <h3 class="text-xs font-semibold">
          {{ maintLabel }}
          <span
            class="ml-1 text-[10px]"
            :class="maintResult.success ? 'text-green-600' : 'text-red-600'"
          >
            exit={{ maintResult.exitCode ?? '?' }}
          </span>
        </h3>
        <pre
          v-if="maintResult.stdout"
          class="mt-1 max-h-48 overflow-auto rounded bg-muted/30 p-2 font-mono text-[10px]"
          >{{ maintResult.stdout }}</pre
        >
        <pre
          v-if="maintResult.stderr"
          class="mt-1 max-h-48 overflow-auto rounded bg-amber-500/10 p-2 font-mono text-[10px] text-amber-700 dark:text-amber-400"
          >{{ maintResult.stderr }}</pre
        >
      </div>
    </div>

    <p class="text-[10px] text-muted-foreground">
      {{ t('settings.maintenanceSection.futureNote') }}
    </p>
  </div>
</template>
