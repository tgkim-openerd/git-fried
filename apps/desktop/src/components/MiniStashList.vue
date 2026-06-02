<script setup lang="ts">
// Sprint c27-1 (ARCH-003 fix) — Sidebar 의 Stash mini list.
// Sprint c74 — GitKraken parity: title 복수형 / scrollable / timestamp / ⋯ ContextMenu + drop.

import { computed, useTemplateRef } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useStash } from '@/composables/useStash'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { useReposStore } from '@/stores/repos'
import { dispatchShortcut } from '@/composables/useShortcuts'
import { applyStash, popStash, dropStash } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { formatRelativeTime } from '@/composables/useUserSettings'
import { useStashInteraction } from '@/composables/useStashInteraction'
import ContextMenu, { type ContextMenuExpose } from './ContextMenu.vue'
import MiniSection from './MiniSection.vue'
// Sprint c54 — Issue 2 — sidebar skeleton placeholder.
import SkeletonBlock from './SkeletonBlock.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const store = useReposStore()
const toast = useToast()
const invalidate = useInvalidateRepoQueries()
const queryClient = useQueryClient()
const repoIdRef = computed(() => store.activeRepoId)

const { data: stashes, isFetching } = useStash(repoIdRef)
const stashCount = computed(() => stashes.value?.length ?? 0)

function invalidateStash() {
  queryClient.invalidateQueries({ queryKey: ['stash', store.activeRepoId] })
}

const applyStashMut = useMutation({
  mutationFn: ({ id, idx }: { id: number; idx: number }) => applyStash(id, idx),
  onSuccess: () => {
    invalidate(store.activeRepoId)
    invalidateStash()
    toast.success(t('stashActions.toastApplySuccess'), t('stashActions.toastApplyBody'))
  },
  onError: (e) => toast.error(t('stashActions.toastApplyFailed'), describeError(e)),
})
const popStashMut = useMutation({
  mutationFn: ({ id, idx }: { id: number; idx: number }) => popStash(id, idx),
  onSuccess: () => {
    invalidate(store.activeRepoId)
    invalidateStash()
    toast.success(t('stashActions.toastPopSuccess'), t('stashActions.toastPopBody'))
  },
  onError: (e) => toast.error(t('stashActions.toastPopFailed'), describeError(e)),
})
const dropStashMut = useMutation({
  mutationFn: ({ id, idx }: { id: number; idx: number }) => dropStash(id, idx),
  onSuccess: () => {
    invalidateStash()
    toast.success(t('stashActions.toastDropSuccess'), t('stashActions.toastDropBody'))
  },
  onError: (e) => toast.error(t('stashActions.toastDropFailed'), describeError(e)),
})

// S-9 (GitKraken parity) — stash 행 click → 중앙 CommitGraph 에서 해당 stash commit 으로 jump + select.
function onStashClick(sha: string | null) {
  if (!sha) return
  const ok = window.gitFriedSelectCommit?.(sha) ?? false
  if (!ok) {
    toast.info(t('stashList.notInGraphTitle'), t('stashList.notInGraphBody'))
  }
}

const ctxMenu = useTemplateRef<ContextMenuExpose>('ctxMenu')
const { onStashContextMenu } = useStashInteraction({
  repoId: () => store.activeRepoId,
  ctxMenu,
  onApply: (idx) => {
    if (store.activeRepoId == null) return
    applyStashMut.mutate({ id: store.activeRepoId, idx })
  },
  onPop: (idx) => {
    if (store.activeRepoId == null) return
    popStashMut.mutate({ id: store.activeRepoId, idx })
  },
  onDrop: (idx) => {
    if (store.activeRepoId == null) return
    dropStashMut.mutate({ id: store.activeRepoId, idx })
  },
})
</script>

<template>
  <MiniSection
    v-if="stashCount > 0 || isFetching"
    :title="t('stashList.title')"
    :count="stashCount"
    storage-key="active-repo-quick.stash"
    :full-tooltip="t('stashList.fullTooltip')"
    @full="dispatchShortcut('tab3')"
  >
    <SkeletonBlock
      v-if="stashCount === 0 && isFetching"
      :count="3"
      height="sm"
      data-testid="mini-stash-skeleton"
    />
    <!-- S-2: slice 제거 + max-h scrollable (전체 stash 즉시 접근). 32 LOC line-height 기준 ~10 행. -->
    <ul v-else class="mini-list-scroll max-h-[40vh] space-y-0.5 overflow-y-auto">
      <li
        v-for="s in stashes ?? []"
        :key="`ms-${s.index}`"
        class="group flex items-center gap-1 rounded px-1 py-1 text-2xs hover:bg-accent/30 cursor-pointer"
        :title="`stash@{${s.index}} on ${s.branch ?? 'unknown'} — ${s.message}`"
        @click="onStashClick(s.sha)"
        @contextmenu="onStashContextMenu($event, s)"
      >
        <span class="shrink-0 font-mono text-3xs text-muted-foreground">@{{ s.index }}</span>
        <span class="flex-1 truncate">{{ s.message || t('stashList.noMessage') }}</span>
        <!-- S-3: createdAt epoch sec → relative time (formatRelativeTime ko/en) -->
        <span
          v-if="s.createdAt"
          class="shrink-0 text-4xs text-muted-foreground/70"
          :title="new Date(s.createdAt * 1000).toLocaleString()"
        >
          {{ formatRelativeTime(s.createdAt) }}
        </span>
        <!-- S-4+S-5: ⋯ overflow → ContextMenu (apply/pop/copy SHA/drop). hover 시 노출. -->
        <button
          type="button"
          class="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 rounded px-1 text-2xs text-muted-foreground hover:bg-accent/40 hover:text-foreground"
          :title="t('stashList.menuTitle')"
          :aria-label="t('stashList.menuAriaLabel', { idx: s.index })"
          @click.stop="onStashContextMenu($event, s)"
        >
          ⋯
        </button>
      </li>
    </ul>
    <ContextMenu ref="ctxMenu" />
  </MiniSection>
</template>
