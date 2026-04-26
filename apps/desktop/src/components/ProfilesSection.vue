<script setup lang="ts">
// 설정 페이지의 프로파일 관리 섹션 — list / create / update / delete.
import { reactive, ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import {
  activateProfile,
  createProfile,
  deleteProfile,
  updateProfile,
} from '@/api/git'
import { describeError } from '@/api/errors'
import { useProfiles } from '@/composables/useProfiles'
import type { Profile, ProfileInput } from '@/api/git'

const { data: profiles } = useProfiles()
const qc = useQueryClient()

function emptyForm(): ProfileInput {
  return {
    name: '',
    gitUserName: '',
    gitUserEmail: '',
    signingKey: '',
    sshKeyPath: '',
    defaultForgeAccountId: null,
  }
}

const form = reactive<ProfileInput>(emptyForm())
const editingId = ref<number | null>(null)

const createMut = useMutation({
  mutationFn: (input: ProfileInput) => createProfile(input),
  onSuccess: () => {
    Object.assign(form, emptyForm())
    qc.invalidateQueries({ queryKey: ['profiles'] })
  },
  onError: (e) => alert(`생성 실패:\n${describeError(e)}`),
})
const updateMut = useMutation({
  mutationFn: ({ id, input }: { id: number; input: ProfileInput }) =>
    updateProfile(id, input),
  onSuccess: () => {
    Object.assign(form, emptyForm())
    editingId.value = null
    qc.invalidateQueries({ queryKey: ['profiles'] })
  },
  onError: (e) => alert(`수정 실패:\n${describeError(e)}`),
})
const deleteMut = useMutation({
  mutationFn: (id: number) => deleteProfile(id),
  onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  onError: (e) => alert(`삭제 실패:\n${describeError(e)}`),
})
const activateMut = useMutation({
  mutationFn: (id: number) => activateProfile(id),
  onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  onError: (e) => alert(`활성화 실패:\n${describeError(e)}`),
})

function startEdit(p: Profile) {
  editingId.value = p.id
  form.name = p.name
  form.gitUserName = p.gitUserName || ''
  form.gitUserEmail = p.gitUserEmail || ''
  form.signingKey = p.signingKey || ''
  form.sshKeyPath = p.sshKeyPath || ''
  form.defaultForgeAccountId = p.defaultForgeAccountId
}

function cancelEdit() {
  editingId.value = null
  Object.assign(form, emptyForm())
}

function submit() {
  const input = { ...form, name: form.name.trim() }
  if (!input.name) return
  if (editingId.value != null) {
    updateMut.mutate({ id: editingId.value, input })
  } else {
    createMut.mutate(input)
  }
}

function onDelete(p: Profile) {
  if (!window.confirm(`프로파일 '${p.name}' 을 삭제하시겠습니까?`)) return
  deleteMut.mutate(p.id)
}

function onActivate(p: Profile) {
  if (p.isActive) return
  if (
    !window.confirm(
      `⚠ '${p.name}' 활성화 시 글로벌 git config 가 변경됩니다. 진행할까요?`,
    )
  )
    return
  activateMut.mutate(p.id)
}
</script>

<template>
  <section class="rounded-md border border-border p-3">
    <h3 class="mb-2 text-sm font-semibold">프로파일</h3>
    <p class="mb-2 text-[11px] text-muted-foreground">
      개인 ↔ 회사 1-click 토글. 활성화 시 글로벌 git config (user.name /
      user.email / user.signingkey) 가 적용됩니다.
    </p>

    <ul class="mb-3 space-y-1 text-sm">
      <li
        v-for="p in profiles"
        :key="p.id"
        class="flex items-center justify-between rounded px-2 py-1 hover:bg-accent/40"
      >
        <span class="flex items-center gap-2">
          <span :class="p.isActive ? 'text-emerald-500' : 'text-muted-foreground'">●</span>
          <span :class="p.isActive ? 'font-semibold' : ''">{{ p.name }}</span>
          <span class="text-[10px] text-muted-foreground">
            {{ p.gitUserName }} &lt;{{ p.gitUserEmail || '?' }}&gt;
          </span>
        </span>
        <span class="flex gap-2 text-xs">
          <button
            v-if="!p.isActive"
            class="text-muted-foreground hover:text-foreground"
            @click="onActivate(p)"
          >
            활성화
          </button>
          <button
            class="text-muted-foreground hover:text-foreground"
            @click="startEdit(p)"
          >
            수정
          </button>
          <button class="text-destructive hover:underline" @click="onDelete(p)">
            삭제
          </button>
        </span>
      </li>
      <li v-if="profiles && profiles.length === 0" class="text-xs text-muted-foreground">
        등록된 프로파일 없음. 아래에서 추가.
      </li>
    </ul>

    <!-- form -->
    <div class="rounded-md border border-border p-2">
      <h4 class="mb-2 text-xs font-semibold">
        {{ editingId != null ? '수정' : '새 프로파일' }}
      </h4>
      <div class="grid grid-cols-2 gap-2">
        <label class="text-xs text-muted-foreground">
          이름
          <input
            v-model="form.name"
            placeholder="개인 / 회사 (opnd)"
            class="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          />
        </label>
        <label class="text-xs text-muted-foreground">
          git user.name
          <input
            v-model="form.gitUserName"
            placeholder="tgkim"
            class="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          />
        </label>
        <label class="col-span-2 text-xs text-muted-foreground">
          git user.email
          <input
            v-model="form.gitUserEmail"
            placeholder="oharapass@gmail.com"
            class="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          />
        </label>
        <label class="col-span-2 text-xs text-muted-foreground">
          signing key (옵션)
          <input
            v-model="form.signingKey"
            placeholder="ssh-ed25519 AAAA... 또는 GPG fingerprint"
            class="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-sm font-mono"
          />
        </label>
        <label class="col-span-2 text-xs text-muted-foreground">
          SSH key path (메모용, ssh-agent 자동 추가는 v1.x)
          <input
            v-model="form.sshKeyPath"
            placeholder="~/.ssh/opnd_ed25519"
            class="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-sm font-mono"
          />
        </label>
      </div>
      <div class="mt-3 flex justify-end gap-2 text-xs">
        <button
          v-if="editingId != null"
          class="rounded-md border border-input px-3 py-1 hover:bg-accent"
          @click="cancelEdit"
        >
          취소
        </button>
        <button
          class="rounded-md bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50"
          :disabled="
            !form.name.trim() || createMut.isPending.value || updateMut.isPending.value
          "
          @click="submit"
        >
          {{ editingId != null ? '저장' : '추가' }}
        </button>
      </div>
    </div>
  </section>
</template>
