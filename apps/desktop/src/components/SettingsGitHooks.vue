<script setup lang="ts">
// Plan #42 M-1 (Sprint c99+) — Git Hooks manager UI
//
// 트리거: Plan #41 Step 1 발견 — GitKraken Settings 의 Repo-Specific Preferences
// 10 항목 중 Git Hooks. git-fried 는 `core.hooksPath` config (RepoSpecificForm B1)
// PARTIAL 상태. 본 페이지 = Rust `list_git_hooks` IPC 의 hook list 표시 (read-only).
// enable/disable / edit 은 별도 sprint (M-1 후속).

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { hookActivate, hookDeactivate, listGitHooks } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useReposStore } from '@/stores/repos'
// Plan #42 M-1 (Codex 8차 HIGH fix) — core.hooksPath 자동 반영 (RepoSpecificForm
// 의 hooksPath 변경 시 hook list 도 그 경로 scan).
import { useRepoConfig } from '@/composables/useRepoConfig'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'

const { t } = useI18n()
const toast = useToast()
const qc = useQueryClient()
const reposStore = useReposStore()
const activeRepoId = computed<number | null>(() => reposStore.activeRepoId)
const repoConfig = useRepoConfig(activeRepoId)
const hooksPathOverride = computed<string | null>(
  () => repoConfig.query.data.value?.hooksPath ?? null,
)

// plan #45 H (경고+허용) — core.hooksPath 가 repo 밖(절대경로 / `..` 시작)을 가리키면
// UI 경고. 보안 차단은 Rust 측 서버 해석이 담당(거부 아님) — 본 배너는 사용자 주의 환기.
const hooksExternal = computed<boolean>(() => {
  const p = hooksPathOverride.value?.trim()
  if (!p) return false
  return /^([/\\]|[A-Za-z]:[\\/]|\.\.[/\\])/.test(p) || p === '..'
})

// Plan #42 M-1 후속 (Sprint c104) — enable/disable toggle mutation.
function invalidateHooks() {
  if (activeRepoId.value != null) {
    qc.invalidateQueries({ queryKey: ['git-hooks', activeRepoId.value] })
  }
}

const activateMut = useMutation({
  mutationFn: (name: string) => {
    if (activeRepoId.value == null) return Promise.reject(new Error('no repo'))
    return hookActivate(activeRepoId.value, name, hooksPathOverride.value)
  },
  onSuccess: (_, name) => {
    toast.success(t('settings.gitHooks.toastActivateSuccess', { name }))
    invalidateHooks()
  },
  onError: (e) => toast.error(t('settings.gitHooks.toastActivateFail'), describeError(e)),
})

const deactivateMut = useMutation({
  mutationFn: (name: string) => {
    if (activeRepoId.value == null) return Promise.reject(new Error('no repo'))
    return hookDeactivate(activeRepoId.value, name, hooksPathOverride.value)
  },
  onSuccess: (_, name) => {
    toast.success(t('settings.gitHooks.toastDeactivateSuccess', { name }))
    invalidateHooks()
  },
  onError: (e) => toast.error(t('settings.gitHooks.toastDeactivateFail'), describeError(e)),
})

const hooksQuery = useQuery({
  // Codex 8차 MED — hooksPath 변경 시 자동 refetch (queryKey 에 포함).
  queryKey: computed(() => ['git-hooks', activeRepoId.value, hooksPathOverride.value]),
  queryFn: () => {
    if (activeRepoId.value == null) return Promise.resolve([])
    return listGitHooks(activeRepoId.value, hooksPathOverride.value)
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

    <!-- R2-GH1 — repo 미선택 경고에 저장소 관리 이동 CTA -->
    <div
      v-if="activeRepoId == null"
      class="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400"
    >
      <p>{{ t('settings.gitHooks.noActiveRepoWarning') }}</p>
      <RouterLink
        to="/repositories"
        class="mt-1.5 inline-block rounded border border-amber-500/50 px-2 py-0.5 font-medium hover:bg-amber-500/15"
      >
        {{ t('settings.gitHooks.goToRepos') }}
      </RouterLink>
    </div>

    <template v-else>
      <!-- plan #45 H — 외부 core.hooksPath 경고 (경고+허용 정책) -->
      <div
        v-if="hooksExternal"
        class="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400"
      >
        {{ t('settings.gitHooks.externalWarning') }}
      </div>

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
                  class="rounded bg-amber-500/20 px-1 text-3xs text-amber-700 dark:text-amber-300"
                  :title="t('settings.gitHooks.nonStandardHint')"
                >
                  {{ t('settings.gitHooks.nonStandardLabel') }}
                </span>
                <!-- Codex 8차 HIGH — non-executable hook 은 git 이 ignore. 사용자 안내. -->
                <span
                  v-if="!h.executable"
                  class="rounded bg-red-500/20 px-1 text-3xs text-red-700 dark:text-red-300"
                  :title="t('settings.gitHooks.notExecutableHint')"
                >
                  {{ t('settings.gitHooks.notExecutableLabel') }}
                </span>
              </span>
              <span class="flex items-center gap-2">
                <span class="text-2xs text-muted-foreground">
                  {{ h.size != null ? `${h.size} bytes` : '' }}
                </span>
                <button
                  v-if="h.standard"
                  type="button"
                  class="rounded border border-input bg-background px-2 py-1 min-h-[24px] text-xs hover:bg-accent/40 disabled:opacity-50"
                  :disabled="deactivateMut.isPending.value"
                  :title="t('settings.gitHooks.deactivateButtonTitle', { name: h.name })"
                  @click="deactivateMut.mutate(h.name)"
                >
                  {{ t('settings.gitHooks.deactivateButton') }}
                </button>
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
          <ul class="flex flex-col gap-1 text-xs">
            <li
              v-for="h in sampleOnlyHooks"
              :key="h.name"
              class="flex items-center justify-between gap-2 rounded border border-border bg-background px-2 py-0.5"
            >
              <span class="font-mono">{{ h.name }}</span>
              <button
                type="button"
                class="rounded border border-input bg-background px-2 py-1 min-h-[24px] text-xs hover:bg-accent/40 disabled:opacity-50"
                :disabled="activateMut.isPending.value"
                :title="t('settings.gitHooks.activateButtonTitle', { name: h.name })"
                @click="activateMut.mutate(h.name)"
              >
                {{ t('settings.gitHooks.activateButton') }}
              </button>
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
