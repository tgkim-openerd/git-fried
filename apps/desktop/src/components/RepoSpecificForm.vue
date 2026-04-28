<script setup lang="ts">
// Repository-Specific Preferences form (`docs/plan/14 §3` B1~B4 + A3 + A4).
//
// 활성 레포의 .git/config 키 read → reactive form → save 버튼으로 일괄 apply.
// dirty 추적 + 빈 input 은 unset 으로 매핑.
import { computed, ref, watch } from 'vue'
import { useReposStore } from '@/stores/repos'
import { useRepoConfig, EMPTY_REPO_CONFIG } from '@/composables/useRepoConfig'
import type { RepoConfigSnapshot } from '@/api/git'

const reposStore = useReposStore()
const repoIdRef = computed(() => reposStore.activeRepoId)

const { query, applyMut } = useRepoConfig(repoIdRef)

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
  return (Object.keys(a) as (keyof RepoConfigSnapshot)[]).some(
    (k) => (a[k] ?? '') !== (b[k] ?? ''),
  )
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
        선택한 레포의 <code>.git/config --local</code> 키를 직접 수정합니다.
        빈 값으로 두고 저장 = unset.
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
        <legend class="px-1 text-xs font-semibold">Per-repo identity (회사/개인 분리)</legend>
        <label class="mt-1 flex items-center justify-between gap-3 text-xs">
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
        <span v-if="dirty" class="text-[11px] text-amber-600">변경됨</span>
        <button
          type="button"
          class="rounded border border-border px-3 py-1 text-xs hover:bg-accent/40 disabled:opacity-50"
          :disabled="!dirty || applyMut.isPending.value"
          @click="reset"
        >
          되돌리기
        </button>
        <button
          type="button"
          class="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
          :disabled="!dirty || applyMut.isPending.value"
          @click="save"
        >
          저장
        </button>
      </div>
    </template>
  </div>
</template>
