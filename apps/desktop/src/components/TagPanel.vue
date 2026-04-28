<script setup lang="ts">
// Plain Tag panel — `docs/plan/14 §8 G1` Sprint C14.
//
// 순수 git tag (Forge Release 와 별개). list / create / delete / push.
// ReleasesPanel 이 Forge API 의 release 만 보여주므로 이 패널이 lightweight tag
// + annotated tag 를 모두 표시. tag 이름 클릭 시 commit 으로 점프 (v1.x).
import { computed, ref, useTemplateRef } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  createBranch,
  createTag,
  deleteRemoteTag,
  deleteTag,
  listTags,
  pushTag,
  switchBranch,
  type TagInfo,
} from '@/api/git'
import { describeError } from '@/api/errors'
import { STALE_TIME } from '@/api/queryClient'
import { useToast } from '@/composables/useToast'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { formatDateLocalized } from '@/composables/useUserSettings'
import ContextMenu, { type ContextMenuExpose, type ContextMenuItem } from './ContextMenu.vue'
import EmptyState from './EmptyState.vue'
import SkeletonBlock from './SkeletonBlock.vue'

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

// === Sprint 22-4 V-4: tag click → inline annotated viewer (full info expand) ===
const expandedTag = ref<string | null>(null)
function toggleTagExpand(name: string) {
  expandedTag.value = expandedTag.value === name ? null : name
}

// === Sprint 22-4 CM-8: tag row 우클릭 (5 액션) ===
const tagCtxMenu = useTemplateRef<ContextMenuExpose>('tagCtxMenu')
const invalidateAll = useInvalidateRepoQueries()

async function checkoutTag(t: TagInfo) {
  if (props.repoId == null) return
  if (!window.confirm(`Tag '${t.name}' checkout? (detached HEAD)`)) return
  try {
    await switchBranch(props.repoId, t.name, false)
    toast.success('Checkout', t.name)
    invalidateAll(props.repoId)
  } catch (e) {
    toast.error('Checkout 실패', describeError(e))
  }
}

async function createBranchFromTag(t: TagInfo) {
  if (props.repoId == null) return
  const name = window.prompt(`tag '${t.name}' 에서 브랜치 생성 — 새 브랜치 이름:`, t.name + '-branch')
  if (!name?.trim()) return
  try {
    await createBranch(props.repoId, name.trim(), t.name)
    toast.success('브랜치 생성', `${name.trim()} from ${t.name}`)
    invalidateAll(props.repoId)
  } catch (e) {
    toast.error('브랜치 생성 실패', describeError(e))
  }
}

async function copyTagSha(t: TagInfo) {
  const sha = t.commitSha
  if (!sha) return
  try {
    await navigator.clipboard.writeText(sha)
    toast.success('SHA 복사', sha.slice(0, 8))
  } catch (e) {
    toast.error('복사 실패', describeError(e))
  }
}

function onTagContextMenu(ev: MouseEvent, t: TagInfo) {
  ev.preventDefault()
  ev.stopPropagation()
  const items: ContextMenuItem[] = [
    {
      label: 'Push to origin',
      icon: '⬆',
      action: () => pushMut.mutate(t.name),
    },
    {
      label: 'Checkout (detached HEAD)',
      icon: '✓',
      action: () => void checkoutTag(t),
    },
    {
      label: 'Create branch from...',
      icon: '🌿',
      action: () => void createBranchFromTag(t),
    },
    { divider: true },
    {
      label: 'Copy commit SHA',
      icon: '📋',
      disabled: !t.commitSha,
      action: () => void copyTagSha(t),
    },
    { divider: true },
    {
      label: 'Delete local',
      icon: '🗑',
      destructive: true,
      action: () => onDelete(t.name),
    },
    {
      label: 'Delete remote (origin)',
      icon: '🗑',
      destructive: true,
      action: () => onDeleteRemote(t.name),
    },
  ]
  tagCtxMenu.value?.openAt(ev, items)
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
        class="cursor-pointer border-b border-border px-3 py-2 hover:bg-accent/30"
        :class="expandedTag === t.name ? 'bg-accent/20' : ''"
        @click="toggleTagExpand(t.name)"
        @contextmenu="onTagContextMenu($event, t)"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="font-mono text-xs font-semibold">
            <span class="mr-1 text-[10px] text-muted-foreground">
              {{ expandedTag === t.name ? '▼' : '▸' }}
            </span>
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
        <!-- Sprint 22-4 V-4: 펼침 영역 (annotated msg + 전체 SHA + 액션 힌트) -->
        <div
          v-if="expandedTag === t.name"
          class="mt-2 rounded border border-border bg-muted/30 p-2 text-[11px]"
          @click.stop
        >
          <div class="mb-1 flex items-center gap-2 text-muted-foreground">
            <span class="font-semibold">{{ t.annotated ? 'annotated' : 'lightweight' }}</span>
            <span v-if="t.commitSha" class="font-mono">{{ t.commitSha }}</span>
          </div>
          <pre
            v-if="t.subject"
            class="whitespace-pre-wrap font-mono text-[11px] text-foreground"
          >{{ t.subject }}</pre>
          <div v-else class="italic text-muted-foreground">(메시지 없음)</div>
          <p class="mt-2 text-[10px] text-muted-foreground">
            ⌥ 우클릭 메뉴: Push / Checkout / Create branch / Copy SHA / Delete
          </p>
        </div>
        <div class="mt-1 flex gap-2 text-[11px]">
          <button
            class="hover:underline"
            title="origin 으로 push"
            :aria-label="`tag '${t.name}' origin 에 push`"
            @click.stop="pushMut.mutate(t.name)"
          >
            push
          </button>
          <button
            class="hover:underline text-destructive"
            :aria-label="`로컬 tag '${t.name}' 삭제`"
            @click.stop="onDelete(t.name)"
          >
            del local
          </button>
          <button
            class="hover:underline text-destructive"
            :aria-label="`원격 tag 'origin/${t.name}' 삭제`"
            @click.stop="onDeleteRemote(t.name)"
          >
            del remote
          </button>
        </div>
      </li>
      <!-- Sprint 22-18 — 첫 로딩 skeleton + empty state visual -->
      <li v-if="tagsQuery.isFetching.value && !tagsQuery.data.value" class="px-1 pt-2">
        <SkeletonBlock :count="4" height="sm" />
      </li>
      <li v-else-if="tagsQuery.data.value && tagsQuery.data.value.length === 0">
        <EmptyState icon="🏷" title="tag 없음" size="sm" />
      </li>
    </ul>
    <ContextMenu ref="tagCtxMenu" />
  </div>
</template>
