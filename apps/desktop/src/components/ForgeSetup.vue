<script setup lang="ts">
// Forge 계정 (PAT) 등록 + 검증 마법사.
// v0.0~v0.1 에서는 PAT 만 지원. OAuth 는 v1.x.
import { ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  forgeDeleteAccount,
  forgeListAccounts,
  forgeSaveToken,
  forgeWhoami,
} from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import type { ForgeAccount, ForgeAuthor } from '@/api/git'

const toast = useToast()
const qc = useQueryClient()

const { data: accounts } = useQuery({
  queryKey: ['forgeAccounts'],
  queryFn: forgeListAccounts,
})

const kind = ref<'gitea' | 'github'>('gitea')
const baseUrl = ref('')
const username = ref('')
const token = ref('')
const verified = ref<ForgeAuthor | null>(null)
const verifyError = ref<string | null>(null)

function defaultBase(k: 'gitea' | 'github'): string {
  return k === 'github' ? 'https://api.github.com' : 'https://git.dev.opnd.io'
}

const verifyMut = useMutation({
  mutationFn: () => forgeWhoami(kind.value, baseUrl.value || defaultBase(kind.value), token.value),
  onSuccess: (a) => {
    verified.value = a
    verifyError.value = null
    if (!username.value) username.value = a.username
  },
  onError: (e) => {
    verified.value = null
    verifyError.value = describeError(e)
  },
})

const saveMut = useMutation({
  mutationFn: () =>
    forgeSaveToken(
      kind.value,
      baseUrl.value || defaultBase(kind.value),
      username.value || null,
      token.value,
    ),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['forgeAccounts'] })
    token.value = ''
    verified.value = null
    toast.success('Forge 계정 등록 완료')
  },
  onError: (e) => toast.error('Forge 계정 등록 실패', describeError(e)),
})

const deleteMut = useMutation({
  mutationFn: (id: number) => forgeDeleteAccount(id),
  onSuccess: () => qc.invalidateQueries({ queryKey: ['forgeAccounts'] }),
})

function onDelete(a: ForgeAccount) {
  if (
    confirm(
      `[${a.forgeKind}] ${a.baseUrl} (${a.username || '?'}) 계정을 삭제하시겠습니까?`,
    )
  )
    deleteMut.mutate(a.id)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <h2 class="text-lg font-semibold">Forge 계정</h2>

    <!-- 등록된 계정 -->
    <section class="rounded-md border border-border p-3">
      <h3 class="mb-2 text-sm font-semibold">등록된 계정</h3>
      <ul class="space-y-1 text-sm">
        <li
          v-for="a in accounts"
          :key="a.id"
          class="flex items-center justify-between rounded px-2 py-1 hover:bg-accent/40"
        >
          <span>
            <span class="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
              {{ a.forgeKind }}
            </span>
            <span class="ml-2 font-mono text-xs">{{ a.baseUrl }}</span>
            <span v-if="a.username" class="ml-2 text-muted-foreground">@{{ a.username }}</span>
          </span>
          <button
            type="button"
            class="text-xs text-destructive hover:underline"
            @click="onDelete(a)"
          >
            삭제
          </button>
        </li>
        <li v-if="accounts && accounts.length === 0" class="text-xs text-muted-foreground">
          등록된 계정 없음
        </li>
      </ul>
    </section>

    <!-- 새 계정 -->
    <section class="rounded-md border border-border p-3">
      <h3 class="mb-2 text-sm font-semibold">새 계정 등록</h3>
      <div class="grid grid-cols-2 gap-2">
        <label class="text-xs text-muted-foreground">
          forge
          <select
            v-model="kind"
            class="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            <option value="gitea">Gitea (회사)</option>
            <option value="github">GitHub (개인)</option>
          </select>
        </label>
        <label class="text-xs text-muted-foreground">
          username (선택)
          <input
            v-model="username"
            class="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
            placeholder="tgkim"
          />
        </label>
        <label class="col-span-2 text-xs text-muted-foreground">
          base URL
          <input
            v-model="baseUrl"
            :placeholder="defaultBase(kind)"
            class="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-sm font-mono"
          />
        </label>
        <label class="col-span-2 text-xs text-muted-foreground">
          PAT
          <input
            v-model="token"
            type="password"
            placeholder="ghp_xxxx... 또는 Gitea 토큰"
            class="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-sm font-mono"
            autocomplete="off"
          />
        </label>
      </div>
      <div class="mt-3 flex items-center justify-between gap-2 text-xs">
        <div>
          <span v-if="verified" class="text-emerald-500">
            ✓ 검증 완료 — {{ verified.username }} ({{ verified.displayName || '?' }})
          </span>
          <span v-else-if="verifyError" class="text-destructive">{{ verifyError }}</span>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-md border border-input px-3 py-1 hover:bg-accent disabled:opacity-50"
            :disabled="!token || verifyMut.isPending.value"
            @click="verifyMut.mutate()"
          >
            검증
          </button>
          <button
            type="button"
            class="rounded-md bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50"
            :disabled="!token || saveMut.isPending.value"
            @click="saveMut.mutate()"
          >
            저장
          </button>
        </div>
      </div>
      <p class="mt-2 text-[10px] text-muted-foreground">
        토큰은 OS keychain (Windows Credential Manager / macOS Keychain) 에 저장됩니다.
        DB 에는 keychain reference 만 보관.
      </p>
    </section>
  </div>
</template>
