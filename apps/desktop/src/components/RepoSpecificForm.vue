<script setup lang="ts">
// Repository-Specific Preferences form (`docs/plan/14 §3` B1~B4 + A3 + A4).
//
// 활성 레포의 .git/config 키 read → reactive form → save 버튼으로 일괄 apply.
// dirty 추적 + 빈 input 은 unset 으로 매핑.
//
// v0.4 #1 (UltraPlan plan/31) — per-repo forge account override 추가:
//   .git/config form 과 별개로 repos.forge_account_id (DB 컬럼) 직접 mutation.
//   변경 즉시 적용 (RepoConfig save 버튼 흐름과 분리).
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useReposStore } from '@/stores/repos'
import { useRepoConfig, EMPTY_REPO_CONFIG } from '@/composables/useRepoConfig'
import {
  forgeListAccounts,
  listRepos,
  setRepoForgeAccount,
  type RepoConfigSnapshot,
} from '@/api/git'
import { STALE_TIME } from '@/api/queryClient'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'

const { t } = useI18n()
const reposStore = useReposStore()
const repoIdRef = computed(() => reposStore.activeRepoId)
const qc = useQueryClient()
const toast = useToast()

const { query, applyMut } = useRepoConfig(repoIdRef)

// v0.4 #1 — forge_accounts list (per-repo override 선택지) + 현재 repo 의 forgeAccountId.
const forgeAccountsQuery = useQuery({
  queryKey: ['forge-accounts'],
  queryFn: forgeListAccounts,
  staleTime: STALE_TIME.STATIC,
})
const accounts = computed(() => forgeAccountsQuery.data.value ?? [])

// 활성 workspace 의 repos. 모든 workspace 검색 시 null 전달.
const reposQuery = useQuery({
  queryKey: computed(() => ['repos', reposStore.activeWorkspaceId]),
  queryFn: () => listRepos(reposStore.activeWorkspaceId),
  staleTime: STALE_TIME.STATIC,
})
const activeRepo = computed(() => {
  const id = repoIdRef.value
  if (id == null) return null
  return reposQuery.data.value?.find((r) => r.id === id) ?? null
})

// dropdown 의 v-model — 변경 시 즉시 mutation. .git/config form 과 다르게 별도 mutation.
const forgeAccountId = ref<number | null>(null)
watch(
  () => activeRepo.value?.forgeAccountId ?? null,
  (id) => {
    forgeAccountId.value = id
  },
  { immediate: true },
)

const setRepoForgeAccountMut = useMutation({
  mutationFn: (accountId: number | null) => {
    const id = repoIdRef.value
    if (id == null) return Promise.reject(new Error('no active repo'))
    return setRepoForgeAccount(id, accountId)
  },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['repos'] })
    toast.success(
      t('repoIdentity.forgeAccount.savedTitle'),
      t('repoIdentity.forgeAccount.savedBody'),
    )
  },
  onError: (e) => {
    toast.error(t('repoIdentity.forgeAccount.errorTitle'), describeError(e))
  },
})

function onForgeAccountChange() {
  setRepoForgeAccountMut.mutate(forgeAccountId.value)
}

// effective banner: 본 repo override 가 active Profile default 와 다른지 안내 (Recognition over Recall).
// active Profile default 조회는 별도 IPC 필요해서 일단 단순화: override 가 설정되어 있으면 표시.
const effectiveOverrideBanner = computed(() => activeRepo.value?.forgeAccountId != null)

// reactive form 모델 (서버 값 → form 동기화)
const form = ref<RepoConfigSnapshot>({ ...EMPTY_REPO_CONFIG })
const original = ref<RepoConfigSnapshot>({ ...EMPTY_REPO_CONFIG })

watch(
  () => query.data.value,
  (snap) => {
    if (snap) {
      form.value = { ...snap }
      original.value = { ...snap }
    }
  },
  { immediate: true },
)

const dirty = computed(() => {
  const a = form.value
  const b = original.value
  return (Object.keys(a) as (keyof RepoConfigSnapshot)[]).some((k) => (a[k] ?? '') !== (b[k] ?? ''))
})

function save() {
  // 빈 string 은 null 로 정규화 (unset 의도)
  const norm: RepoConfigSnapshot = { ...form.value }
  for (const k of Object.keys(norm) as (keyof RepoConfigSnapshot)[]) {
    const v = norm[k]
    if (typeof v === 'string' && v.trim() === '') {
      norm[k] = null
    }
  }
  applyMut.mutate(norm)
}

function reset() {
  form.value = { ...original.value }
}

const gpgsignBool = computed({
  get: () => form.value.commitGpgsign === 'true',
  set: (v: boolean) => {
    form.value.commitGpgsign = v ? 'true' : null
  },
})
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-4">
    <h2 class="text-lg font-semibold">Repository-Specific Preferences</h2>
    <p
      v-if="repoIdRef == null"
      class="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400"
    >
      ⚠ 활성 레포가 없습니다. Sidebar 에서 레포를 선택하세요.
    </p>

    <template v-else>
      <p class="text-xs text-muted-foreground">
        선택한 레포의 <code>.git/config --local</code> 키를 직접 수정합니다. 빈 값으로 두고 저장 =
        unset.
      </p>

      <!-- B1 Hooks -->
      <fieldset class="rounded border border-border p-3">
        <legend class="px-1 text-xs font-semibold">B1 · Git Hooks</legend>
        <label class="mt-1 flex items-center justify-between gap-3 text-xs">
          <span class="font-medium">core.hooksPath</span>
          <input
            v-model="form.hooksPath"
            placeholder=".husky / .git/hooks"
            class="w-72 rounded border border-input bg-background px-2 py-1 text-xs"
          />
        </label>
      </fieldset>

      <!-- B2 Encoding -->
      <fieldset class="rounded border border-border p-3">
        <legend class="px-1 text-xs font-semibold">B2 · Encoding (한글 환경)</legend>
        <label class="mt-1 flex items-center justify-between gap-3 text-xs">
          <span class="font-medium">i18n.commitEncoding</span>
          <input
            v-model="form.commitEncoding"
            placeholder="UTF-8"
            class="w-72 rounded border border-input bg-background px-2 py-1 text-xs"
          />
        </label>
        <label class="mt-2 flex items-center justify-between gap-3 text-xs">
          <span class="font-medium">i18n.logOutputEncoding</span>
          <input
            v-model="form.logOutputEncoding"
            placeholder="UTF-8"
            class="w-72 rounded border border-input bg-background px-2 py-1 text-xs"
          />
        </label>
      </fieldset>

      <!-- B3 Gitflow -->
      <fieldset class="rounded border border-border p-3">
        <legend class="px-1 text-xs font-semibold">B3 · Gitflow naming</legend>
        <label class="mt-1 flex items-center justify-between gap-3 text-xs">
          <span class="font-medium">gitflow.branch.master</span>
          <input
            v-model="form.gitflowBranchMaster"
            placeholder="main"
            class="w-72 rounded border border-input bg-background px-2 py-1 text-xs"
          />
        </label>
        <label class="mt-2 flex items-center justify-between gap-3 text-xs">
          <span class="font-medium">gitflow.branch.develop</span>
          <input
            v-model="form.gitflowBranchDevelop"
            placeholder="develop"
            class="w-72 rounded border border-input bg-background px-2 py-1 text-xs"
          />
        </label>
        <label class="mt-2 flex items-center justify-between gap-3 text-xs">
          <span class="font-medium">gitflow.prefix.feature</span>
          <input
            v-model="form.gitflowPrefixFeature"
            placeholder="feature/"
            class="w-72 rounded border border-input bg-background px-2 py-1 text-xs"
          />
        </label>
        <label class="mt-2 flex items-center justify-between gap-3 text-xs">
          <span class="font-medium">gitflow.prefix.release</span>
          <input
            v-model="form.gitflowPrefixRelease"
            placeholder="release/"
            class="w-72 rounded border border-input bg-background px-2 py-1 text-xs"
          />
        </label>
        <label class="mt-2 flex items-center justify-between gap-3 text-xs">
          <span class="font-medium">gitflow.prefix.hotfix</span>
          <input
            v-model="form.gitflowPrefixHotfix"
            placeholder="hotfix/"
            class="w-72 rounded border border-input bg-background px-2 py-1 text-xs"
          />
        </label>
      </fieldset>

      <!-- B4 + A4 Commit Signing -->
      <fieldset class="rounded border border-border p-3">
        <legend class="px-1 text-xs font-semibold">B4 · Commit Signing (GPG/SSH)</legend>
        <label class="mt-1 flex items-center justify-between gap-3 text-xs">
          <span class="font-medium">commit.gpgsign</span>
          <input v-model="gpgsignBool" type="checkbox" />
        </label>
        <label class="mt-2 flex items-center justify-between gap-3 text-xs">
          <span class="font-medium">user.signingkey</span>
          <input
            v-model="form.userSigningkey"
            placeholder="GPG key id 또는 SSH key path"
            class="w-72 rounded border border-input bg-background px-2 py-1 text-xs"
          />
        </label>
        <label class="mt-2 flex items-center justify-between gap-3 text-xs">
          <span class="font-medium">gpg.format</span>
          <select
            v-model="form.gpgFormat"
            class="w-72 rounded border border-input bg-background px-2 py-1 text-xs"
          >
            <option :value="null">(미설정)</option>
            <option value="openpgp">openpgp</option>
            <option value="ssh">ssh</option>
            <option value="x509">x509</option>
          </select>
        </label>
      </fieldset>

      <!-- per-repo identity (자주 쓰는 항목) -->
      <fieldset class="rounded border border-border p-3">
        <legend class="px-1 text-xs font-semibold">
          {{ t('repoIdentity.legend') }}
        </legend>

        <!-- v0.4 #1 (UltraPlan plan/31) — per-repo forge account override.
             .git/config form 과 별개로 repos.forge_account_id (DB 컬럼) 즉시 mutation. -->
        <label class="mt-1 flex items-start justify-between gap-3 text-xs">
          <div class="flex flex-col gap-0.5">
            <span class="font-medium">{{ t('repoIdentity.forgeAccount.label') }}</span>
            <span class="text-3xs text-muted-foreground">
              {{ t('repoIdentity.forgeAccount.hint') }}
            </span>
          </div>
          <select
            v-model="forgeAccountId"
            :disabled="setRepoForgeAccountMut.isPending.value"
            :aria-label="t('repoIdentity.forgeAccount.label')"
            class="w-72 rounded border border-input bg-background px-2 py-1 text-xs disabled:opacity-50"
            @change="onForgeAccountChange"
          >
            <option :value="null">{{ t('repoIdentity.forgeAccount.useProfileDefault') }}</option>
            <option v-for="a in accounts" :key="a.id" :value="a.id">
              {{ a.forgeKind }} — {{ a.username || '?' }} ({{ a.baseUrl }})
            </option>
          </select>
        </label>
        <p
          v-if="effectiveOverrideBanner"
          class="mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-2xs text-amber-700 dark:text-amber-400"
          role="status"
        >
          ⚠ {{ t('repoIdentity.forgeAccount.overrideActive') }}
        </p>

        <label class="mt-2 flex items-center justify-between gap-3 text-xs">
          <span class="font-medium">user.name</span>
          <input
            v-model="form.userName"
            class="w-72 rounded border border-input bg-background px-2 py-1 text-xs"
          />
        </label>
        <label class="mt-2 flex items-center justify-between gap-3 text-xs">
          <span class="font-medium">user.email</span>
          <input
            v-model="form.userEmail"
            class="w-72 rounded border border-input bg-background px-2 py-1 text-xs"
          />
        </label>
      </fieldset>

      <div class="flex items-center justify-end gap-2 pt-2">
        <span v-if="dirty" class="text-2xs text-warning-amber">{{
          t('repoConfig.dirtyLabel')
        }}</span>
        <button
          type="button"
          class="rounded border border-border px-3 py-1.5 min-h-[28px] text-xs hover:bg-accent/40 disabled:opacity-50"
          :disabled="!dirty || applyMut.isPending.value"
          @click="reset"
        >
          {{ t('repoConfig.resetButton') }}
        </button>
        <button
          type="button"
          class="rounded bg-primary px-3 py-1.5 min-h-[28px] text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
          :disabled="!dirty || applyMut.isPending.value"
          @click="save"
        >
          {{ t('repoConfig.saveButton') }}
        </button>
      </div>
    </template>
  </div>
</template>
