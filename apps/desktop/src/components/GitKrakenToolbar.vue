<script setup lang="ts">
// GitKraken 스타일 상단 Action Toolbar (8-button) — `docs/plan/25 §2`.
//
// 좌→우 그룹: [Undo·Redo] [Pull·Push] [Branch·Stash·Pop] [Terminal] / 우측: branch indicator.
// SyncBar (Fetch/Pull/Push 3-button) 의 superset. 단계적 마이그레이션을 위해 SyncBar 는 보존.
//
// - Undo: ReflogModal 진입 (HEAD restore 버튼 활용)
// - Redo: c25-1.5 에서 reflog forward 추적으로 구현 — 현재는 toast.info '준비중'
// - Branch: BranchPanel 탭 활성 (dispatchShortcut('newBranch'))
// - Stash: 즉시 push (메시지 없이) — working tree 변경 0개면 disabled
// - Pop: stash@{0} pop — stash 0개면 disabled
// - Terminal: terminal 토글 (dispatchShortcut('terminal'))

import { computed, onMounted, onUnmounted } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { listRepos } from '@/api/git'
// Sprint c36 god 17/N — undo/redo mutation 영역 분리.
import { useUndoRedo } from '@/composables/useUndoRedo'
// Sprint c37 god 21/N — stash/pop mutation + handler 분리.
import { useStashPopMutation } from '@/composables/useStashPopMutation'
// Sprint c40 — fetch/pull/push 3 mutation + pull strategy 분리.
import { useToolbarSyncMutations } from '@/composables/useToolbarSyncMutations'
import type { PullStrategy } from '@/composables/usePullStrategy'
import { useStash } from '@/composables/useStash'
import { useStatusCounts } from '@/composables/useStatusCounts'
import { useToast } from '@/composables/useToast'
import { useShortcut, dispatchShortcut } from '@/composables/useShortcuts'
import { useReposStore } from '@/stores/repos'
import { useRepoAliases } from '@/composables/useRepoAliases'
import { onMenuAction } from '@/composables/useMenuListener'
// Sprint c31 — BaseTooltip primitive (kbd hint + viewport edge 회피 + a11y).
import BaseTooltip from './BaseTooltip.vue'
import { useI18n } from 'vue-i18n'
import { confirmDialog } from '@/composables/useConfirm'

const { t } = useI18n()

const props = defineProps<{
  repoId: number | null
  branch: string | null
  ahead: number
  behind: number
  upstream: string | null
}>()

const toast = useToast()

const repoIdRef = computed(() => props.repoId)
const { data: stashList } = useStash(repoIdRef)
// ARCH-006 fix — useStatusCounts 단일 진실원천.
const { hasChanges } = useStatusCounts(repoIdRef)

// Phase 10-5 — 활성 레포 breadcrumb (alias 우선 → forge owner / 레포명).
// store 가 repos 캐시를 보유하지 않으므로 listRepos query 를 직접 사용 (Sidebar 와 동일 캐시 공유).
const store = useReposStore()
const aliases = useRepoAliases()
const { data: reposData } = useQuery({
  queryKey: computed(() => ['repos', store.activeWorkspaceId]),
  queryFn: () => listRepos(store.activeWorkspaceId),
})
const activeRepo = computed(() => {
  if (props.repoId == null) return null
  return reposData.value?.find((r) => r.id === props.repoId) ?? null
})
const repoBreadcrumb = computed(() => {
  const r = activeRepo.value
  if (!r) return null
  const resolved = aliases.resolveLocal(r.id, r.name)
  return {
    owner: r.forgeOwner,
    name: resolved.display,
    original: r.name,
    aliased: resolved.aliased,
  }
})

const stashCount = computed(() => stashList.value?.length ?? 0)

// === Sprint c40 — fetch/pull/push 3 mutation + pullStrategy/dropdown composable 위임 ===
const {
  fetchMut,
  pullMut,
  pushMut,
  pullStrategy,
  setPullStrategy,
  pullStrategyLabel,
  pullDropdownOpen,
} = useToolbarSyncMutations({
  repoId: () => props.repoId,
  upstream: () => props.upstream,
})

// === Sprint c36 god 17/N — undo/redo composable 위임 ===
// commit/amend 만 자동 reset --soft, 나머지 거부 → ReflogModal 자동 오픈.
const { undoMut, redoMut } = useUndoRedo(() => props.repoId)

// === Sprint c37 god 21/N — stash/pop mutation + onStash/onPop handler 위임 ===
const { stashMut, popMut, onStash, onPop } = useStashPopMutation({
  repoId: () => props.repoId,
  hasChanges,
  stashCount,
})

// === Handlers ===
async function onUndo() {
  if (props.repoId == null) {
    toast.warning(t('toolbar.noRepoTitle'), t('toolbar.noRepoMessage'))
    return
  }
  // Sprint c25-1.5 — confirm 후 reset --soft HEAD@{1}.
  // commit/amend 만 자동 처리, 다른 액션은 backend 가 거부 + ReflogModal 자동 오픈.
  const ok = await confirmDialog({
    title: t('confirm.undoTitle'),
    message: t('confirm.undoMessage'),
    danger: true,
  })
  if (!ok) return
  undoMut.mutate(props.repoId)
}
async function onRedo() {
  if (props.repoId == null) {
    toast.warning(t('toolbar.noRepoTitle'), t('toolbar.noRepoMessage'))
    return
  }
  const ok = await confirmDialog({
    title: t('confirm.redoTitle'),
    message: t('confirm.redoMessage'),
    danger: true,
  })
  if (!ok) return
  redoMut.mutate(props.repoId)
}
function onFetch() {
  if (props.repoId != null) fetchMut.mutate(props.repoId)
}
function onPull() {
  if (props.repoId != null) pullMut.mutate({ id: props.repoId, strategy: pullStrategy.value })
}
function onPullWithStrategy(s: PullStrategy) {
  setPullStrategy(s)
  pullDropdownOpen.value = false
  if (props.repoId != null) pullMut.mutate({ id: props.repoId, strategy: s })
}
function onPush() {
  if (props.repoId != null) pushMut.mutate(props.repoId)
}
function onBranch() {
  if (props.repoId == null) {
    toast.warning(t('toolbar.noRepoTitle'), t('toolbar.noRepoMessage'))
    return
  }
  dispatchShortcut('newBranch')
}
// onStash / onPop 는 useStashPopMutation 위임 (위에서 destructure).
function onTerminal() {
  dispatchShortcut('terminal')
}

// 기존 단축키 유지 (SyncBar 동작 회귀 방지).
useShortcut('fetch', onFetch)
useShortcut('pull', onPull)
useShortcut('push', onPush)

// Phase 10-6 — 네이티브 메뉴 'Edit > Undo/Redo Last Git Action' bridge.
let unbindMenu: Array<() => void> = []
onMounted(() => {
  unbindMenu.push(onMenuAction('undo-action', onUndo))
  unbindMenu.push(onMenuAction('redo-action', onRedo))
})
onUnmounted(() => {
  for (const u of unbindMenu) u()
  unbindMenu = []
})
</script>

<template>
  <header
    class="flex items-center justify-between border-b border-border bg-card px-3 py-1.5 text-xs"
  >
    <!-- Action group — 좌측 8 button -->
    <div class="flex items-center gap-0.5">
      <!-- [history] Undo / Redo -->
      <div class="flex items-center gap-0.5">
        <BaseTooltip
          :text="undoMut.isPending.value ? t('toolbar.undoPending') : t('toolbar.undoTitle')"
          kbd="⌘Z"
          placement="bottom"
        >
          <button
            type="button"
            class="flex flex-col items-center gap-0 rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:hover:bg-transparent"
            :disabled="!repoId || undoMut.isPending.value"
            @click="onUndo"
          >
            <span class="text-base leading-none">↶</span>
            <span class="text-[10px] leading-tight">{{
              undoMut.isPending.value ? '...' : 'Undo'
            }}</span>
          </button>
        </BaseTooltip>
        <BaseTooltip
          :text="redoMut.isPending.value ? t('toolbar.redoPending') : t('toolbar.redoTitle')"
          kbd="⌘⇧Z"
          placement="bottom"
        >
          <button
            type="button"
            class="flex flex-col items-center gap-0 rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:hover:bg-transparent"
            :disabled="!repoId || redoMut.isPending.value"
            @click="onRedo"
          >
            <span class="text-base leading-none">↷</span>
            <span class="text-[10px] leading-tight">{{
              redoMut.isPending.value ? '...' : 'Redo'
            }}</span>
          </button>
        </BaseTooltip>
      </div>

      <span class="mx-1 h-7 w-px bg-border" aria-hidden="true" />

      <!-- [sync] Pull (with strategy ▾) / Push -->
      <div class="flex items-center gap-0.5">
        <!-- Phase 12-3 — Pull dropdown (split button: 본체 = 마지막 strategy 즉시 실행, ▾ = 옵션 메뉴). -->
        <div class="relative flex items-center">
          <BaseTooltip
            :text="
              pullMut.isPending.value
                ? t('toolbar.pullPending')
                : t('toolbar.pullTitle', { strategy: pullStrategyLabel(pullStrategy) })
            "
            kbd="⌘⇧L"
            placement="bottom"
          >
            <button
              type="button"
              class="flex flex-col items-center gap-0 rounded-l-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:hover:bg-transparent"
              :disabled="!repoId || pullMut.isPending.value"
              @click="onPull"
            >
              <span class="text-base leading-none">⇩</span>
              <span class="text-[10px] leading-tight">{{
                pullMut.isPending.value ? '...' : 'Pull'
              }}</span>
            </button>
          </BaseTooltip>
          <BaseTooltip :text="t('toolbar.pullStrategyTitle')" placement="bottom">
            <button
              type="button"
              class="flex h-full items-center rounded-r-md border-l border-border/40 px-1 py-0 text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:hover:bg-transparent"
              :disabled="!repoId || pullMut.isPending.value"
              :aria-expanded="pullDropdownOpen"
              aria-haspopup="menu"
              @click="pullDropdownOpen = !pullDropdownOpen"
            >
              ▾
            </button>
          </BaseTooltip>
          <!-- Dropdown popover -->
          <div
            v-if="pullDropdownOpen"
            class="absolute left-0 top-full z-50 mt-0.5 w-44 overflow-hidden rounded-md border border-border bg-popover text-xs shadow-modal"
            role="menu"
            @click.stop
          >
            <button
              v-for="s in ['default', 'rebase', 'ff-only', 'no-rebase'] as const"
              :key="s"
              type="button"
              class="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-accent hover:text-accent-foreground"
              :class="
                pullStrategy === s ? 'font-semibold text-foreground' : 'text-muted-foreground'
              "
              role="menuitem"
              @click="onPullWithStrategy(s)"
            >
              <span>
                Pull
                <span class="ml-1 font-mono text-[10px] text-muted-foreground">
                  ({{ pullStrategyLabel(s) }})
                </span>
              </span>
              <span v-if="pullStrategy === s" class="text-[9px]">●</span>
            </button>
          </div>
          <!-- click-outside backdrop -->
          <div
            v-if="pullDropdownOpen"
            class="fixed inset-0 z-40"
            @click="pullDropdownOpen = false"
          />
        </div>
        <BaseTooltip
          :text="pushMut.isPending.value ? t('toolbar.pushPending') : 'Push'"
          kbd="⌘⇧K"
          placement="bottom"
        >
          <button
            type="button"
            class="flex flex-col items-center gap-0 rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:hover:bg-transparent"
            :disabled="!repoId || pushMut.isPending.value"
            @click="onPush"
          >
            <span class="text-base leading-none">⇧</span>
            <span class="text-[10px] leading-tight">{{
              pushMut.isPending.value ? '...' : 'Push'
            }}</span>
          </button>
        </BaseTooltip>
      </div>

      <span class="mx-1 h-7 w-px bg-border" aria-hidden="true" />

      <!-- [branch] Branch / Stash / Pop -->
      <div class="flex items-center gap-0.5">
        <BaseTooltip :text="t('toolbar.branchTitle')" kbd="⌘B" placement="bottom">
          <button
            type="button"
            class="flex flex-col items-center gap-0 rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:hover:bg-transparent"
            :disabled="!repoId"
            @click="onBranch"
          >
            <span class="text-base leading-none">⎇</span>
            <span class="text-[10px] leading-tight">Branch</span>
          </button>
        </BaseTooltip>
        <BaseTooltip
          :text="
            !hasChanges
              ? t('toolbar.stashEmpty')
              : stashMut.isPending.value
                ? t('toolbar.stashPending')
                : t('toolbar.stashTitle')
          "
          placement="bottom"
        >
          <button
            type="button"
            class="flex flex-col items-center gap-0 rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:hover:bg-transparent"
            :disabled="!repoId || !hasChanges || stashMut.isPending.value"
            @click="onStash"
          >
            <span class="text-base leading-none">⤓</span>
            <span class="text-[10px] leading-tight">{{
              stashMut.isPending.value ? '...' : 'Stash'
            }}</span>
          </button>
        </BaseTooltip>
        <BaseTooltip
          :text="
            stashCount === 0
              ? t('toolbar.popEmpty')
              : popMut.isPending.value
                ? t('toolbar.popPending')
                : t('toolbar.popTitle', { n: stashCount })
          "
          placement="bottom"
        >
          <button
            type="button"
            class="flex flex-col items-center gap-0 rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:hover:bg-transparent"
            :disabled="!repoId || stashCount === 0 || popMut.isPending.value"
            @click="onPop"
          >
            <span class="text-base leading-none">⤒</span>
            <span class="text-[10px] leading-tight">
              {{ popMut.isPending.value ? '...' : 'Pop' }}
              <span v-if="stashCount > 0" class="ml-0.5 text-diff-add">{{ stashCount }}</span>
            </span>
          </button>
        </BaseTooltip>
      </div>

      <span class="mx-1 h-7 w-px bg-border" aria-hidden="true" />

      <!-- [shell] Terminal -->
      <BaseTooltip :text="t('toolbar.terminalToggle')" kbd="⌘`" placement="bottom">
        <button
          type="button"
          class="flex flex-col items-center gap-0 rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          @click="onTerminal"
        >
          <span class="text-base leading-none">▸_</span>
          <span class="text-[10px] leading-tight">Terminal</span>
        </button>
      </BaseTooltip>

      <span class="mx-1 h-7 w-px bg-border" aria-hidden="true" />

      <!-- Fetch — secondary, label only (Pull 옆 ▾ 대체 — 단순화) -->
      <BaseTooltip
        :text="fetchMut.isPending.value ? t('toolbar.fetchPending') : t('toolbar.fetchTitle')"
        kbd="⌘L"
        placement="bottom"
      >
        <button
          type="button"
          class="rounded-md px-2 py-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:hover:bg-transparent"
          :disabled="!repoId || fetchMut.isPending.value"
          @click="onFetch"
        >
          {{ fetchMut.isPending.value ? '...' : 'Fetch' }}
        </button>
      </BaseTooltip>
    </div>

    <!-- Phase 10-5 — Repository breadcrumb + Branch indicator (우측). -->
    <div class="flex items-center gap-2 font-mono">
      <!-- Repository breadcrumb: owner/name → branch -->
      <span
        v-if="repoBreadcrumb"
        class="flex items-center gap-1"
        :title="
          repoBreadcrumb.aliased
            ? t('toolbar.aliasTitle', { name: repoBreadcrumb.original })
            : repoBreadcrumb.original
        "
      >
        <span v-if="repoBreadcrumb.owner" class="text-muted-foreground">
          {{ repoBreadcrumb.owner }}
        </span>
        <span v-if="repoBreadcrumb.owner" class="text-muted-foreground/60">/</span>
        <span class="font-semibold text-foreground" :class="repoBreadcrumb.aliased ? 'italic' : ''">
          {{ repoBreadcrumb.name }}
        </span>
        <span class="mx-1 text-muted-foreground/60">·</span>
      </span>
      <span class="text-muted-foreground">on</span>
      <span class="font-semibold text-foreground">{{ branch || '(no branch)' }}</span>
      <span v-if="upstream" class="text-muted-foreground">→ {{ upstream }}</span>
      <span v-if="ahead || behind" class="text-xs">
        <span v-if="ahead" class="text-diff-add">↑{{ ahead }}</span>
        <span v-if="behind" class="ml-1 text-danger-rose">↓{{ behind }}</span>
      </span>
    </div>
  </header>
</template>
