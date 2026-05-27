<script setup lang="ts">
// Worktree 패널 — list / add / remove / prune.
// 사용자 8개 동시 사용 패턴 (`docs/plan/02 §3 W2`).
// AI 에이전트 자동 worktree (`worktree-agent-*`) 식별 가능.
import { ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorktrees } from '@/composables/useWorktrees'
import { openPathInExplorer } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useReposStore } from '@/stores/repos'
import ContextMenu, { type ContextMenuExpose, type ContextMenuItem } from './ContextMenu.vue'
import SkeletonBlock from './SkeletonBlock.vue'
import EmptyState from './EmptyState.vue'
// Sprint c80-2 — 5 mutation + 3 handler 통합 composable 위임.
import { useWorktreePanelActions } from '@/composables/useWorktreePanelActions'

const reposStore = useReposStore()
const { t } = useI18n()
const toast = useToast()

const props = defineProps<{ repoId: number | null }>()
const { data: trees, isFetching: treesFetching } = useWorktrees(() => props.repoId)

const newPath = ref('')
const newBranch = ref('')

// Sprint 22-9 V-10 — row click 시 시각 focus.
// (현재 worktree 별 repo_id 가 별도가 아니므로 active worktree 추적 무의미 — 시각 highlight 만 유지)
const selectedPath = ref<string | null>(null)

const {
  addMut,
  pruneMut,
  lockMut,
  unlockMut,
  confirmRemove,
  onLock,
  onUnlock,
  onWorktreeDblClick,
} = useWorktreePanelActions({ repoId: () => props.repoId, newPath, newBranch })

function fmtSize(bytes: number | null): string {
  if (bytes == null) return '?'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`
}

function isAiAgent(branch: string | null): boolean {
  return !!branch && /worktree-agent-/i.test(branch)
}

// === Sprint 22-4 CM-11: worktree row 우클릭 (5 액션) ===
const ctxMenu = useTemplateRef<ContextMenuExpose>('ctxMenu')
type WorktreeItem = NonNullable<typeof trees.value>[number]

function onWorktreeContextMenu(ev: MouseEvent, t: WorktreeItem) {
  ev.preventDefault()
  ev.stopPropagation()
  const items: ContextMenuItem[] = [
    {
      // Sprint c38 / plan/29 E5 — worktree 경로 직접 열기 (open_path_in_explorer).
      label: t.path
        ? `Open in Explorer (${t.isMain ? 'main repo' : 'worktree'})`
        : 'Open in Explorer',
      icon: '📂',
      action: () => {
        void openPathInExplorer(t.path).catch((e) => toast.error('Open 실패', describeError(e)))
      },
    },
    {
      label: t.isMain ? 'Switch (이미 main repo)' : 'Switch — main repo 활성화',
      icon: '⊙',
      disabled: t.isMain,
      action: () => {
        // worktree 별 repo_id 가 별도가 아니므로 단순히 active 로 set (한 worktree = 한 repoId 가정).
        if (props.repoId != null) reposStore.setActiveRepo(props.repoId)
        toast.success('활성화', t.path)
      },
    },
    { divider: true },
    {
      label: t.isLocked ? 'Unlock' : 'Lock',
      icon: t.isLocked ? '🔓' : '🔒',
      action: () => (t.isLocked ? onUnlock(t.path) : onLock(t.path)),
    },
    { divider: true },
    {
      label: t.isMain ? 'Remove (main 불가)' : 'Remove',
      icon: '🗑',
      destructive: true,
      disabled: t.isMain || t.isLocked,
      action: () => confirmRemove(t),
    },
  ]
  ctxMenu.value?.openAt(ev, items)
}
</script>

<template>
  <section class="flex h-full flex-col border-l border-border bg-card">
    <header class="flex items-center justify-between border-b border-border px-3 py-2">
      <h3 class="text-sm font-semibold">{{ t('worktree.title') }}</h3>
      <button
        type="button"
        class="rounded-md border border-input px-2.5 py-1 min-h-[28px] text-xs hover:bg-accent disabled:opacity-50"
        :disabled="!repoId || pruneMut.isPending.value"
        :aria-label="t('worktree.pruneAria')"
        @click="pruneMut.mutate()"
      >
        prune
      </button>
    </header>

    <!-- 새 worktree -->
    <div class="flex flex-col gap-1 border-b border-border px-3 py-2 text-xs">
      <input
        v-model="newPath"
        :placeholder="t('worktree.pathPlaceholder')"
        class="rounded-md border border-input bg-background px-2 py-1"
      />
      <div class="flex gap-1">
        <input
          v-model="newBranch"
          :placeholder="t('worktree.branchPlaceholder')"
          class="flex-1 rounded-md border border-input bg-background px-2 py-1"
        />
        <button
          type="button"
          class="rounded-md bg-primary px-2 py-1 text-primary-foreground disabled:opacity-50"
          :disabled="!repoId || !newPath || addMut.isPending.value"
          @click="addMut.mutate()"
        >
          add
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-auto px-2 py-2 text-sm">
      <!-- c59-3 — 첫 로딩 skeleton + 빈 trees EmptyState -->
      <SkeletonBlock
        v-if="treesFetching && (!trees || trees.length === 0)"
        :count="3"
        height="sm"
        class="px-2"
      />
      <EmptyState
        v-else-if="!trees || trees.length === 0"
        icon="🌲"
        :title="t('worktree.empty')"
        :description="t('worktree.emptyHint')"
        size="sm"
      />
      <ul v-else>
        <li
          v-for="wt in trees"
          :key="wt.path"
          class="cursor-pointer rounded px-2 py-1.5 hover:bg-accent/40"
          :class="selectedPath === wt.path ? 'bg-accent/60 ring-1 ring-primary/40' : ''"
          :title="t('worktree.rowTitle', { path: wt.path })"
          @click="selectedPath = wt.path"
          @dblclick="onWorktreeDblClick(wt)"
          @contextmenu="onWorktreeContextMenu($event, wt)"
        >
          <div class="flex items-center justify-between">
            <span class="truncate text-xs">
              <span
                v-if="wt.isMain"
                class="text-emerald-700 dark:text-emerald-500"
                :title="$t('worktree.mainTitle')"
                >●</span
              >
              <span
                v-if="isAiAgent(wt.branch)"
                class="text-ai-violet"
                :title="$t('worktree.aiAgentTitle')"
                >🤖</span
              >
              <span
                v-if="wt.isLocked"
                class="text-warning-amber"
                :title="$t('worktree.lockedTitle')"
                >🔒</span
              >
              <span
                v-if="wt.isPrunable"
                class="text-danger-rose"
                :title="$t('worktree.prunableTitle')"
                >⚠</span
              >
              <!-- Sprint c38 / plan/29 E5 — dirty 점. null = 측정 실패 (?) -->
              <span
                v-if="wt.isDirty === true"
                class="text-warning-amber"
                :title="$t('worktree.dirtyTitle')"
                >●</span
              >
              <span
                v-else-if="wt.isDirty === null"
                class="text-muted-foreground"
                :title="$t('worktree.dirtyUnknownTitle')"
                >?</span
              >
              <span class="ml-1 font-mono">{{ wt.branch || $t('worktree.detached') }}</span>
            </span>
            <span class="text-[10px] text-muted-foreground">{{ fmtSize(wt.sizeBytes) }}</span>
          </div>
          <div class="truncate font-mono text-[10px] text-muted-foreground">{{ wt.path }}</div>
          <div v-if="!wt.isMain" class="mt-1 flex justify-end gap-2">
            <button
              v-if="!wt.isLocked"
              type="button"
              class="rounded px-2 py-1 min-h-[24px] text-xs text-warning-amber hover:bg-accent/40"
              :disabled="lockMut.isPending.value"
              :aria-label="t('worktree.lockAria', { path: wt.path })"
              @click="onLock(wt.path)"
            >
              lock
            </button>
            <button
              v-else
              type="button"
              class="rounded px-2 py-1 min-h-[24px] text-xs text-warning-amber hover:bg-accent/40"
              :disabled="unlockMut.isPending.value"
              :aria-label="t('worktree.unlockAria', { path: wt.path })"
              @click="onUnlock(wt.path)"
            >
              unlock
            </button>
            <button
              type="button"
              class="rounded px-2 py-1 min-h-[24px] text-xs text-destructive hover:bg-destructive/10"
              :disabled="wt.isLocked"
              :title="wt.isLocked ? t('worktree.removeBlockedTitle') : ''"
              :aria-label="t('worktree.removeAria', { path: wt.path })"
              @click="confirmRemove(wt)"
            >
              remove
            </button>
          </div>
        </li>
      </ul>
    </div>
    <ContextMenu ref="ctxMenu" />
  </section>
</template>
