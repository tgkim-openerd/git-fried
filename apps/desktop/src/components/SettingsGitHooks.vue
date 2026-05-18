<script setup lang="ts">
// Plan #42 M-1 (Sprint c99+) — Git Hooks manager UI
//
// 트리거: Plan #41 Step 1 발견 — GitKraken Settings 의 Repo-Specific Preferences
// 10 항목 중 Git Hooks. git-fried 는 `core.hooksPath` config (RepoSpecificForm B1)
// PARTIAL 상태. 본 페이지 = Rust `list_git_hooks` IPC 의 hook list 표시 (read-only).
// enable/disable / edit 은 별도 sprint (M-1 후속).

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuery } from '@tanstack/vue-query'
import { listGitHooks } from '@/api/git'
import { describeError } from '@/api/errors'
import { useReposStore } from '@/stores/repos'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'

const { t } = useI18n()
const reposStore = useReposStore()
const activeRepoId = computed<number | null>(() => reposStore.activeRepoId)

const hooksQuery = useQuery({
  queryKey: computed(() => ['git-hooks', activeRepoId.value]),
  queryFn: () => {
    if (activeRepoId.value == null) return Promise.resolve([])
    return listGitHooks(activeRepoId.value, null)
  },
  enabled: computed(() => activeRepoId.value != null),
})

const hooks = computed(() => hooksQuery.data.value ?? [])
const activeHooks = computed(() => hooks.value.filter((h) => h.exists))
const sampleOnlyHooks = computed(() => hooks.value.filter((h) => !h.exists && h.sampleExists))
const missingHooks = computed(() =>
  hooks.value.filter((h) => !h.exists && !h.sampleExists && h.standard),
)
</script>

<template>
  <div class="flex max-w-3xl flex-col gap-4">
    <h2 class="text-lg font-semibold">{{ t('settings.gitHooks.title') }}</h2>
    <p class="text-xs text-muted-foreground">
      {{ t('settings.gitHooks.description') }}
    </p>

    <p
      v-if="activeRepoId == null"
      class="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400"
    >
      {{ t('settings.gitHooks.noActiveRepoWarning') }}
    </p>

    <template v-else>
      <SkeletonBlock v-if="hooksQuery.isFetching.value && !hooksQuery.data.value" :lines="3" />

      <p
        v-else-if="hooksQuery.error.value"
        class="rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-400"
      >
        {{ t('settings.gitHooks.loadFailed') }} — {{ describeError(hooksQuery.error.value) }}
      </p>

      <template v-else>
        <!-- Active hooks (사용자 실제 등록 hook) -->
        <section class="rounded border border-border bg-muted/20 p-4 text-sm">
          <h3 class="mb-2 font-semibold">
            {{ t('settings.gitHooks.activeTitle') }}
            <span class="ml-1 text-xs text-muted-foreground">({{ activeHooks.length }})</span>
          </h3>
          <EmptyState
            v-if="activeHooks.length === 0"
            :title="t('settings.gitHooks.activeEmpty')"
            :description="t('settings.gitHooks.activeEmptyDescription')"
          />
          <ul v-else class="flex flex-col gap-1 text-xs">
            <li
              v-for="h in activeHooks"
              :key="h.name"
              class="flex items-center justify-between gap-2 rounded border border-border bg-background px-2 py-1"
            >
              <span class="flex items-center gap-2">
                <span class="font-mono">{{ h.name }}</span>
                <span
                  v-if="!h.standard"
                  class="rounded bg-amber-500/20 px-1 text-[10px] text-amber-700 dark:text-amber-300"
                  :title="t('settings.gitHooks.nonStandardHint')"
                >
                  {{ t('settings.gitHooks.nonStandardLabel') }}
                </span>
              </span>
              <span class="text-[11px] text-muted-foreground">
                {{ h.size != null ? `${h.size} bytes` : '' }}
              </span>
            </li>
          </ul>
        </section>

        <!-- Sample-only hooks (.sample 파일만 있음, 활성화 안 됨) -->
        <section
          v-if="sampleOnlyHooks.length > 0"
          class="rounded border border-border bg-muted/20 p-4 text-sm"
        >
          <h3 class="mb-2 font-semibold">
            {{ t('settings.gitHooks.sampleTitle') }}
            <span class="ml-1 text-xs text-muted-foreground">({{ sampleOnlyHooks.length }})</span>
          </h3>
          <p class="mb-2 text-xs text-muted-foreground">
            {{ t('settings.gitHooks.sampleDescription') }}
          </p>
          <ul class="flex flex-wrap gap-1 text-xs">
            <li
              v-for="h in sampleOnlyHooks"
              :key="h.name"
              class="rounded border border-border bg-background px-2 py-0.5 font-mono"
            >
              {{ h.name }}
            </li>
          </ul>
        </section>

        <!-- Missing hooks (.sample 도 없는 표준 hook) -->
        <section v-if="missingHooks.length > 0" class="text-xs text-muted-foreground">
          <details>
            <summary class="cursor-pointer">
              {{ t('settings.gitHooks.missingSummary', { n: missingHooks.length }) }}
            </summary>
            <ul class="mt-1 flex flex-wrap gap-1">
              <li
                v-for="h in missingHooks"
                :key="h.name"
                class="rounded border border-border bg-background/50 px-1.5 py-0.5 font-mono opacity-60"
              >
                {{ h.name }}
              </li>
            </ul>
          </details>
        </section>

        <p
          class="rounded border border-blue-500/40 bg-blue-500/10 p-2 text-xs text-blue-700 dark:text-blue-400"
        >
          {{ t('settings.gitHooks.editNote') }}
        </p>
      </template>
    </template>
  </div>
</template>
