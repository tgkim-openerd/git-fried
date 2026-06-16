<script setup lang="ts">
// Plain Tag panel — `docs/plan/14 §8 G1` Sprint C14.
//
// 순수 git tag (Forge Release 와 별개). list / create / delete / push.
// ReleasesPanel 이 Forge API 의 release 만 보여주므로 이 패널이 lightweight tag
// + annotated tag 를 모두 표시. tag 이름 클릭 시 commit 으로 점프 (v1.x).
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createTag, deleteRemoteTag, deleteTag, listTags, pushTag, type TagInfo } from '@/api/git'
import { describeError } from '@/api/errors'
import { STALE_TIME } from '@/api/queryClient'
import { useToast } from '@/composables/useToast'
import { formatDateLocalized } from '@/composables/useUserSettings'
import ContextMenu, { type ContextMenuExpose } from './ContextMenu.vue'
import EmptyState from './EmptyState.vue'
import SkeletonBlock from './SkeletonBlock.vue'
// Sprint c52 — context menu + 모든 user-facing side effect (confirm/prompt/clipboard) 흡수.
// 4 mutations 객체는 vue-query queryClient access 자연스럽게 component scope 잔존.
// ARCH-001 (caller-decision uniformity): mutate fn 만 callback 으로 노출.
import { useTagInteraction } from '@/composables/useTagInteraction'

const props = defineProps<{ repoId: number | null }>()

const toast = useToast()
const { t } = useI18n()
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
  // plan #45 M2 (Codex Phase 3) — tag create/delete 도 CommitGraph 의 tag ring 에 반영되므로
  // graph 무효화 (이전엔 tags+log 만 → 생성/삭제된 tag ring 이 graph 에서 stale).
  qc.invalidateQueries({ queryKey: ['graph', props.repoId] })
}

// === create ===
const newName = ref('')
const newMessage = ref('') // 빈 = lightweight, 채워지면 annotated
const newTarget = ref('') // A-11 — 빈 = HEAD, 채워지면 해당 ref/SHA 에 tag
const createMut = useMutation({
  mutationFn: () => {
    if (props.repoId == null) throw new Error(t('tag.errNoRepo'))
    return createTag(
      props.repoId,
      newName.value.trim(),
      newTarget.value.trim() || null,
      newMessage.value.trim() || null,
    )
  },
  onSuccess: () => {
    toast.success(t('tag.toastCreated'), newName.value)
    newName.value = ''
    newMessage.value = ''
    newTarget.value = ''
    invalidate()
  },
  onError: (e) => toast.error(t('tag.toastCreateFailed'), describeError(e)),
})

// === delete (local) — confirm 은 useTagInteraction 안에서 처리 (c52 ARCH-001) ===
const deleteMut = useMutation({
  mutationFn: (name: string) => {
    if (props.repoId == null) throw new Error(t('tag.errNoRepo'))
    return deleteTag(props.repoId, name)
  },
  onSuccess: (_v, name) => {
    toast.success(t('tag.toastDeleted'), name)
    invalidate()
  },
  onError: (e) => toast.error(t('tag.toastDeleteFailed'), describeError(e)),
})

// === push (remote=origin 기본) ===
const pushMut = useMutation({
  mutationFn: (name: string) => {
    if (props.repoId == null) throw new Error(t('tag.errNoRepo'))
    return pushTag(props.repoId, 'origin', name)
  },
  onSuccess: (_v, name) => {
    toast.success(t('tag.toastPushed'), `origin ${name}`)
  },
  onError: (e) => toast.error(t('tag.toastPushFailed'), describeError(e)),
})

const deleteRemoteMut = useMutation({
  mutationFn: (name: string) => {
    if (props.repoId == null) throw new Error(t('tag.errNoRepo'))
    return deleteRemoteTag(props.repoId, 'origin', name)
  },
  onSuccess: (_v, name) => toast.success(t('tag.toastRemoteDeleted'), `origin ${name}`),
  onError: (e) => toast.error(t('tag.toastRemoteDeleteFailed'), describeError(e)),
})

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

// === Sprint 22-4 CM-8 + Sprint c52 ARCH-001 — Pattern 9 caller-decision uniformity ===
// composable: confirm/prompt/clipboard/API 모두 흡수
// caller (component): vue-query mutation 객체 보유 + mutate fn 만 콜백으로 노출
const tagCtxMenu = useTemplateRef<ContextMenuExpose>('tagCtxMenu')
const { onTagContextMenu, deleteTagLocal, deleteTagRemote } = useTagInteraction({
  repoId: () => props.repoId,
  ctxMenu: tagCtxMenu,
  onPush: (name) => pushMut.mutate(name),
  onDelete: (name) => deleteMut.mutate(name),
  onDeleteRemote: (name) => deleteRemoteMut.mutate(name),
})
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="flex items-center justify-between border-b border-border px-3 py-2">
      <h2 class="text-xs font-semibold">Tags</h2>
      <span v-if="tagsQuery.isFetching.value" class="text-3xs text-muted-foreground">{{
        t('tag.loading')
      }}</span>
    </header>

    <!-- create form -->
    <form
      class="flex flex-col gap-1 border-b border-border bg-muted/20 px-3 py-2"
      @submit.prevent="createMut.mutate()"
    >
      <input
        v-model="newName"
        :placeholder="t('tag.namePlaceholder')"
        class="rounded border border-input bg-background px-2 py-1 text-xs"
      />
      <input
        v-model="newMessage"
        :placeholder="t('tag.annotatedPlaceholder')"
        class="rounded border border-input bg-background px-2 py-1 text-2xs"
      />
      <!-- A-11 — tag 대상 commit/ref (빈 값 = HEAD) -->
      <input
        v-model="newTarget"
        :placeholder="t('tag.targetPlaceholder')"
        class="rounded border border-input bg-background px-2 py-1 text-2xs"
      />
      <button
        type="submit"
        class="self-end rounded bg-primary px-2.5 py-1 min-h-[28px] text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
        :disabled="!newName.trim() || createMut.isPending.value"
      >
        {{ t('tag.createButton') }}
      </button>
    </form>

    <ul class="flex-1 overflow-auto">
      <li
        v-for="tg in tagsQuery.data.value"
        :key="tg.name"
        class="cursor-pointer border-b border-border px-3 py-2 hover:bg-accent/30"
        :class="expandedTag === tg.name ? 'bg-accent/20' : ''"
        @click="toggleTagExpand(tg.name)"
        @contextmenu="onTagContextMenu($event, tg)"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="font-mono text-xs font-semibold">
            <span class="mr-1 text-3xs text-muted-foreground">
              {{ expandedTag === tg.name ? '▼' : '▸' }}
            </span>
            {{ tg.name }}
            <span
              v-if="tg.annotated"
              class="ml-1 rounded bg-muted px-1 py-0.5 text-3xs text-muted-foreground"
              :title="t('tag.annotatedTitle')"
            >
              {{ t('tag.annotatedBadge') }}
            </span>
          </span>
          <span class="text-3xs text-muted-foreground">
            {{ fmt(tg.taggerAt) }}
          </span>
        </div>
        <div v-if="tg.subject" class="truncate text-2xs text-muted-foreground" :title="tg.subject">
          {{ tg.subject }}
        </div>
        <div class="mt-1 flex flex-wrap gap-2 text-3xs text-muted-foreground">
          <span class="font-mono">{{ tg.commitSha?.slice(0, 8) ?? '?' }}</span>
          <span v-if="tg.taggerName">{{ tg.taggerName }}</span>
        </div>
        <!-- Sprint 22-4 V-4: 펼침 영역 (annotated msg + 전체 SHA + 액션 힌트) -->
        <div
          v-if="expandedTag === tg.name"
          class="mt-2 rounded border border-border bg-muted/30 p-2 text-2xs"
          @click.stop
        >
          <div class="mb-1 flex items-center gap-2 text-muted-foreground">
            <span class="font-semibold">{{ tg.annotated ? 'annotated' : 'lightweight' }}</span>
            <span v-if="tg.commitSha" class="font-mono">{{ tg.commitSha }}</span>
          </div>
          <pre v-if="tg.subject" class="whitespace-pre-wrap font-mono text-2xs text-foreground">{{
            tg.subject
          }}</pre>
          <div v-else class="italic text-muted-foreground">{{ t('tag.noMessage') }}</div>
          <p class="mt-2 text-3xs text-muted-foreground">
            {{ t('tag.ctxHint') }}
          </p>
        </div>
        <div class="mt-1 flex gap-2 text-xs">
          <button
            class="rounded px-2 py-1 min-h-[24px] hover:bg-accent/40"
            :title="t('tag.pushOriginTitle')"
            :aria-label="t('tag.pushAria', { name: tg.name })"
            @click.stop="pushMut.mutate(tg.name)"
          >
            push
          </button>
          <button
            class="rounded px-2 py-1 min-h-[24px] text-destructive hover:bg-destructive/10"
            :aria-label="t('tag.delLocalAria', { name: tg.name })"
            @click.stop="deleteTagLocal(tg.name)"
          >
            del local
          </button>
          <button
            class="rounded px-2 py-1 min-h-[24px] text-destructive hover:bg-destructive/10"
            :aria-label="t('tag.delRemoteAria', { name: tg.name })"
            @click.stop="deleteTagRemote(tg.name)"
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
        <EmptyState icon="🏷" :title="t('tag.empty')" size="sm" />
      </li>
    </ul>
    <ContextMenu ref="tagCtxMenu" />
  </div>
</template>
