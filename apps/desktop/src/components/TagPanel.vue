<script setup lang="ts">
// Plain Tag panel — `docs/plan/14 §8 G1` Sprint C14.
//
// 순수 git tag (Forge Release 와 별개). list / create / delete / push.
// ReleasesPanel 이 Forge API 의 release 만 보여주므로 이 패널이 lightweight tag
// + annotated tag 를 모두 표시. tag 이름 클릭 시 commit 으로 점프 (v1.x).
import { computed, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  createTag,
  deleteRemoteTag,
  deleteTag,
  listTags,
  pushTag,
  type TagInfo,
} from '@/api/git'
import { describeError } from '@/api/errors'
import { STALE_TIME } from '@/api/queryClient'
import { useToast } from '@/composables/useToast'
import { formatDateLocalized } from '@/composables/useUserSettings'

const props = defineProps<{ repoId: number | null }>()

const toast = useToast()
const qc = useQueryClient()

const tagsQuery = useQuery({
  queryKey: computed(() => ['tags', props.repoId]),
  queryFn: () => {
    if (props.repoId == null) return Promise.resolve<TagInfo[]>([])
    return listTags(props.repoId)
  },
  enabled: computed(() => props.repoId != null),
  staleTime: STALE_TIME.NORMAL,
})

function invalidate() {
  qc.invalidateQueries({ queryKey: ['tags', props.repoId] })
  qc.invalidateQueries({ queryKey: ['log', props.repoId] })
}

// === create ===
const newName = ref('')
const newMessage = ref('') // 빈 = lightweight, 채워지면 annotated
const createMut = useMutation({
  mutationFn: () => {
    if (props.repoId == null) throw new Error('레포 미선택')
    return createTag(
      props.repoId,
      newName.value.trim(),
      null,
      newMessage.value.trim() || null,
    )
  },
  onSuccess: () => {
    toast.success('Tag 생성', newName.value)
    newName.value = ''
    newMessage.value = ''
    invalidate()
  },
  onError: (e) => toast.error('Tag 생성 실패', describeError(e)),
})

// === delete (local) ===
const deleteMut = useMutation({
  mutationFn: (name: string) => {
    if (props.repoId == null) throw new Error('레포 미선택')
    return deleteTag(props.repoId, name)
  },
  onSuccess: (_v, name) => {
    toast.success('Tag 삭제', name)
    invalidate()
  },
  onError: (e) => toast.error('Tag 삭제 실패', describeError(e)),
})

function onDelete(name: string) {
  if (!window.confirm(`로컬 tag '${name}' 를 삭제할까요?\n(원격은 별도)`)) return
  deleteMut.mutate(name)
}

// === push (remote=origin 기본) ===
const pushMut = useMutation({
  mutationFn: (name: string) => {
    if (props.repoId == null) throw new Error('레포 미선택')
    return pushTag(props.repoId, 'origin', name)
  },
  onSuccess: (_v, name) => {
    toast.success('Tag push', `origin ${name}`)
  },
  onError: (e) => toast.error('Tag push 실패', describeError(e)),
})

const deleteRemoteMut = useMutation({
  mutationFn: (name: string) => {
    if (props.repoId == null) throw new Error('레포 미선택')
    return deleteRemoteTag(props.repoId, 'origin', name)
  },
  onSuccess: (_v, name) => toast.success('원격 tag 삭제', `origin ${name}`),
  onError: (e) => toast.error('원격 tag 삭제 실패', describeError(e)),
})

function onDeleteRemote(name: string) {
  if (!window.confirm(`원격 tag 'origin/${name}' 를 삭제할까요?`)) return
  deleteRemoteMut.mutate(name)
}

function fmt(unix: number | null): string {
  if (!unix) return ''
  return formatDateLocalized(unix, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="flex items-center justify-between border-b border-border px-3 py-2">
      <h2 class="text-xs font-semibold">Tags</h2>
      <span
        v-if="tagsQuery.isFetching.value"
        class="text-[10px] text-muted-foreground"
        >불러오는 중...</span
      >
    </header>

    <!-- create form -->
    <form
      class="flex flex-col gap-1 border-b border-border bg-muted/20 px-3 py-2"
      @submit.prevent="createMut.mutate()"
    >
      <input
        v-model="newName"
        placeholder="새 tag 이름 (예: v0.3.0)"
        class="rounded border border-input bg-background px-2 py-1 text-xs"
      />
      <input
        v-model="newMessage"
        placeholder="annotated 메시지 (비워두면 lightweight)"
        class="rounded border border-input bg-background px-2 py-1 text-[11px]"
      />
      <button
        type="submit"
        class="self-end rounded bg-primary px-2 py-0.5 text-[11px] text-primary-foreground hover:opacity-90 disabled:opacity-50"
        :disabled="!newName.trim() || createMut.isPending.value"
      >
        + Tag 생성
      </button>
    </form>

    <ul class="flex-1 overflow-auto">
      <li
        v-for="t in tagsQuery.data.value"
        :key="t.name"
        class="border-b border-border px-3 py-2 hover:bg-accent/30"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="font-mono text-xs font-semibold">
            {{ t.name }}
            <span
              v-if="t.annotated"
              class="ml-1 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground"
              title="annotated tag"
            >
              ann
            </span>
          </span>
          <span class="text-[10px] text-muted-foreground">
            {{ fmt(t.taggerAt) }}
          </span>
        </div>
        <div
          v-if="t.subject"
          class="truncate text-[11px] text-muted-foreground"
          :title="t.subject"
        >
          {{ t.subject }}
        </div>
        <div class="mt-1 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          <span class="font-mono">{{ t.commitSha?.slice(0, 8) ?? '?' }}</span>
          <span v-if="t.taggerName">{{ t.taggerName }}</span>
        </div>
        <div class="mt-1 flex gap-2 text-[11px]">
          <button
            class="hover:underline"
            title="origin 으로 push"
            @click="pushMut.mutate(t.name)"
          >
            push
          </button>
          <button
            class="hover:underline text-destructive"
            @click="onDelete(t.name)"
          >
            del local
          </button>
          <button
            class="hover:underline text-destructive"
            @click="onDeleteRemote(t.name)"
          >
            del remote
          </button>
        </div>
      </li>
      <li
        v-if="tagsQuery.data.value && tagsQuery.data.value.length === 0"
        class="px-3 py-6 text-center text-xs text-muted-foreground"
      >
        tag 없음
      </li>
    </ul>
  </div>
</template>
