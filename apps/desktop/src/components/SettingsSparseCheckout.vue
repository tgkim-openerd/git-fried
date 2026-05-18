<script setup lang="ts">
// Plan #42 M-2 (Sprint c100+) — Sparse Checkout repo manager UI
//
// 트리거: Plan #41 Step 1 발견 — GitKraken Settings Repo-Specific Preferences
// 10 항목 중 Sparse Checkout. git-fried 의 clone-time sparse 외 ongoing 변경
// (list / set / init-cone / disable / reapply).

import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { sparseDisable, sparseInitCone, sparseReapply, sparseSet, sparseStatus } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useReposStore } from '@/stores/repos'
// Plan #42 M-2 (Codex 9차 HIGH fix) — sparse mutations 가 working tree 변경 →
// useStatus refetch 필요.
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { confirmDialog } from '@/composables/useConfirm'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'

const { t } = useI18n()
const toast = useToast()
const qc = useQueryClient()
const reposStore = useReposStore()
const activeRepoId = computed<number | null>(() => reposStore.activeRepoId)
const invalidateRepo = useInvalidateRepoQueries()

const statusQuery = useQuery({
  queryKey: computed(() => ['sparse-status', activeRepoId.value]),
  queryFn: () => {
    if (activeRepoId.value == null) {
      return Promise.resolve({ enabled: false, cone: false, paths: [] })
    }
    return sparseStatus(activeRepoId.value)
  },
  enabled: computed(() => activeRepoId.value != null),
})

const status = computed(() => statusQuery.data.value ?? { enabled: false, cone: false, paths: [] })

// Path 입력 (newline 또는 comma 분리)
const pathsInput = ref('')

function invalidate() {
  if (activeRepoId.value != null) {
    qc.invalidateQueries({ queryKey: ['sparse-status', activeRepoId.value] })
    // Codex 9차 audit `a013fdf5202813c56` HIGH 해소 — sparse mutations 가 working tree
    // 변경 → status/log/repos query 도 refetch 필요.
    invalidateRepo(activeRepoId.value)
  }
}

const initMut = useMutation({
  mutationFn: () => {
    if (activeRepoId.value == null) return Promise.reject(new Error('no repo'))
    return sparseInitCone(activeRepoId.value)
  },
  onSuccess: () => {
    toast.success(t('settings.sparse.toastInitSuccess'))
    invalidate()
  },
  onError: (e) => toast.error(t('settings.sparse.toastInitFail'), describeError(e)),
})

const setMut = useMutation({
  mutationFn: (paths: string[]) => {
    if (activeRepoId.value == null) return Promise.reject(new Error('no repo'))
    return sparseSet(activeRepoId.value, paths)
  },
  onSuccess: () => {
    toast.success(t('settings.sparse.toastSetSuccess'))
    pathsInput.value = ''
    invalidate()
  },
  onError: (e) => toast.error(t('settings.sparse.toastSetFail'), describeError(e)),
})

const disableMut = useMutation({
  mutationFn: () => {
    if (activeRepoId.value == null) return Promise.reject(new Error('no repo'))
    return sparseDisable(activeRepoId.value)
  },
  onSuccess: () => {
    toast.success(t('settings.sparse.toastDisableSuccess'))
    invalidate()
  },
  onError: (e) => toast.error(t('settings.sparse.toastDisableFail'), describeError(e)),
})

const reapplyMut = useMutation({
  mutationFn: () => {
    if (activeRepoId.value == null) return Promise.reject(new Error('no repo'))
    return sparseReapply(activeRepoId.value)
  },
  onSuccess: () => {
    toast.success(t('settings.sparse.toastReapplySuccess'))
    invalidate()
  },
  onError: (e) => toast.error(t('settings.sparse.toastReapplyFail'), describeError(e)),
})

function onApplyPaths() {
  const paths = pathsInput.value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (paths.length === 0) {
    toast.warning(t('settings.sparse.toastEmptyInput'))
    return
  }
  setMut.mutate(paths)
}

// Codex 9차 audit MED — disable 의 대규모 working tree 복원 영향 사용자 확인.
async function onDisableConfirm() {
  const ok = await confirmDialog({
    title: t('settings.sparse.disableButton'),
    message: t('settings.sparse.disableConfirmMessage'),
    danger: true,
  })
  if (!ok) return
  disableMut.mutate()
}
</script>

<template>
  <div class="flex max-w-3xl flex-col gap-4">
    <h2 class="text-lg font-semibold">{{ t('settings.sparse.title') }}</h2>
    <p class="text-xs text-muted-foreground">
      {{ t('settings.sparse.description') }}
    </p>

    <p
      v-if="activeRepoId == null"
      class="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400"
    >
      {{ t('settings.sparse.noActiveRepoWarning') }}
    </p>

    <template v-else>
      <SkeletonBlock v-if="statusQuery.isFetching.value && !statusQuery.data.value" :lines="2" />

      <p
        v-else-if="statusQuery.error.value"
        class="rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-400"
      >
        {{ t('settings.sparse.loadFailed') }} — {{ describeError(statusQuery.error.value) }}
      </p>

      <template v-else>
        <!-- 현재 상태 -->
        <section class="rounded border border-border bg-muted/20 p-4 text-sm">
          <h3 class="mb-2 font-semibold">{{ t('settings.sparse.statusTitle') }}</h3>
          <div class="text-xs">
            <span class="font-mono">enabled = {{ status.enabled }}</span>
            <span class="ml-2 font-mono">cone = {{ status.cone }}</span>
            <span class="ml-2 font-mono">paths = {{ status.paths.length }}</span>
          </div>
          <EmptyState
            v-if="status.paths.length === 0"
            :title="t('settings.sparse.pathsEmpty')"
            :description="
              status.enabled
                ? t('settings.sparse.pathsEmptyEnabled')
                : t('settings.sparse.pathsEmptyDisabled')
            "
          />
          <ul v-else class="mt-2 flex flex-wrap gap-1 text-xs">
            <li
              v-for="p in status.paths"
              :key="p"
              class="rounded border border-border bg-background px-2 py-0.5 font-mono"
            >
              {{ p }}
            </li>
          </ul>
        </section>

        <!-- 액션 -->
        <section class="rounded border border-border bg-muted/20 p-4 text-sm">
          <h3 class="mb-2 font-semibold">{{ t('settings.sparse.actionsTitle') }}</h3>

          <div v-if="!status.enabled" class="flex flex-col gap-2">
            <p class="text-xs text-muted-foreground">
              {{ t('settings.sparse.initDescription') }}
            </p>
            <button
              type="button"
              class="self-start rounded border border-input bg-background px-3 py-1 text-xs hover:bg-accent/40 disabled:opacity-50"
              :disabled="initMut.isPending.value"
              data-testid="sparse-init"
              @click="initMut.mutate()"
            >
              {{
                initMut.isPending.value
                  ? t('settings.sparse.initPending')
                  : t('settings.sparse.initButton')
              }}
            </button>
          </div>

          <div v-else class="flex flex-col gap-3">
            <label class="flex flex-col gap-1">
              <span class="text-xs font-medium">{{ t('settings.sparse.inputLabel') }}</span>
              <span class="text-xs text-muted-foreground">
                {{ t('settings.sparse.inputHint') }}
              </span>
              <textarea
                v-model="pathsInput"
                :placeholder="t('settings.sparse.inputPlaceholder')"
                rows="3"
                class="mt-1 rounded border border-input bg-background px-2 py-1 font-mono text-xs"
                data-testid="sparse-paths-input"
              ></textarea>
            </label>

            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded border border-input bg-background px-3 py-1 text-xs hover:bg-accent/40 disabled:opacity-50"
                :disabled="setMut.isPending.value"
                data-testid="sparse-apply"
                @click="onApplyPaths"
              >
                {{
                  setMut.isPending.value
                    ? t('settings.sparse.setPending')
                    : t('settings.sparse.setButton')
                }}
              </button>

              <button
                type="button"
                class="rounded border border-input bg-background px-3 py-1 text-xs hover:bg-accent/40 disabled:opacity-50"
                :disabled="reapplyMut.isPending.value"
                data-testid="sparse-reapply"
                @click="reapplyMut.mutate()"
              >
                {{
                  reapplyMut.isPending.value
                    ? t('settings.sparse.reapplyPending')
                    : t('settings.sparse.reapplyButton')
                }}
              </button>

              <button
                type="button"
                class="rounded border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs text-red-700 hover:bg-red-500/20 disabled:opacity-50 dark:text-red-300"
                :disabled="disableMut.isPending.value"
                data-testid="sparse-disable"
                @click="onDisableConfirm"
              >
                {{
                  disableMut.isPending.value
                    ? t('settings.sparse.disablePending')
                    : t('settings.sparse.disableButton')
                }}
              </button>
            </div>
          </div>
        </section>

        <p
          class="rounded border border-blue-500/40 bg-blue-500/10 p-2 text-xs text-blue-700 dark:text-blue-400"
        >
          {{ t('settings.sparse.coneNote') }}
        </p>
      </template>
    </template>
  </div>
</template>
