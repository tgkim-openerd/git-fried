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

import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { fetchAll, popStash, pull, pushStash, push, updateSubmodules } from '@/api/git'
// Sprint c36 god 17/N — undo/redo mutation 영역 분리.
import { useUndoRedo } from '@/composables/useUndoRedo'
import { useQuery } from '@tanstack/vue-query'
import { listRepos } from '@/api/git'
import { useStash } from '@/composables/useStash'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { useStatusCounts } from '@/composables/useStatusCounts'
import { useGeneralSettings } from '@/composables/useUserSettings'
import { describeError, humanizeGitError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useShortcut, dispatchShortcut } from '@/composables/useShortcuts'
import { useReposStore } from '@/stores/repos'
import { useRepoAliases } from '@/composables/useRepoAliases'
import { onMenuAction } from '@/composables/useMenuListener'
// Sprint c31 — Pull strategy ref + helper 외부 분리.
import { usePullStrategy, type PullStrategy } from '@/composables/usePullStrategy'
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
const invalidate = useInvalidateRepoQueries()
const queryClient = useQueryClient()
const general = useGeneralSettings()

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

// === Mutations (SyncBar 동작 동등) ===
const fetchMut = useMutation({
  mutationFn: (id: number) => fetchAll(id),
  onSuccess: (res) => {
    invalidate(props.repoId)
    if (res.success) {
      toast.success('Fetch 완료')
    } else {
      toast.error(`Fetch 실패 (exit ${res.exitCode})`, humanizeGitError(res.stderr))
    }
  },
  onError: (e) => toast.error('Fetch 호출 실패', describeError(e)),
})
// Phase 12-3 — Pull 옵션 매개 (dropdown 액션 수신). Sprint c31 — 타입은 usePullStrategy import.
const pullMut = useMutation({
  mutationFn: ({ id, strategy }: { id: number; strategy: PullStrategy }) =>
    pull({
      repoId: id,
      rebase: strategy === 'rebase',
      ffOnly: strategy === 'ff-only',
      noRebase: strategy === 'no-rebase',
    }),
  onSuccess: async (res) => {
    invalidate(props.repoId)
    if (res.success) {
      toast.success('Pull 완료')
      if (general.value.autoUpdateSubmodules && props.repoId != null) {
        try {
          await updateSubmodules(props.repoId, false)
          toast.success('Submodule update 완료', '')
        } catch (e) {
          toast.error('Submodule update 실패', describeError(e))
        }
      }
    } else {
      toast.error(`Pull 실패 (exit ${res.exitCode})`, humanizeGitError(res.stderr))
    }
  },
  onError: (e) => toast.error('Pull 호출 실패', describeError(e)),
})

// Pull dropdown 가시성 + 마지막 사용 strategy 기억 (localStorage).
// Sprint c31 — usePullStrategy composable 로 추출 (localStorage 영속 + label 헬퍼).
const { pullStrategy, setPullStrategy, pullStrategyLabel } = usePullStrategy()
const pullDropdownOpen = ref(false)
const pushMut = useMutation({
  mutationFn: (id: number) =>
    push({
      repoId: id,
      setUpstream: !props.upstream,
    }),
  onSuccess: (res) => {
    invalidate(props.repoId)
    if (res.success) {
      toast.success('Push 완료')
    } else {
      toast.error(`Push 실패 (exit ${res.exitCode})`, humanizeGitError(res.stderr))
    }
  },
  onError: (e) => toast.error('Push 호출 실패', describeError(e)),
})

// === Sprint c36 god 17/N — undo/redo composable 위임 ===
// commit/amend 만 자동 reset --soft, 나머지 거부 → ReflogModal 자동 오픈.
const { undoMut, redoMut } = useUndoRedo(() => props.repoId)

// === Stash / Pop (toolbar 자체 mutation) ===
const stashMut = useMutation({
  mutationFn: (id: number) => pushStash(id, null, false),
  onSuccess: () => {
    invalidate(props.repoId)
    queryClient.invalidateQueries({ queryKey: ['stash', props.repoId] })
    toast.success('Stash 완료', '메시지 없이 즉시 stash 됨')
  },
  onError: (e) => toast.error('Stash 실패', describeError(e)),
})
const popMut = useMutation({
  mutationFn: (id: number) => popStash(id, 0),
  onSuccess: () => {
    invalidate(props.repoId)
    queryClient.invalidateQueries({ queryKey: ['stash', props.repoId] })
    toast.success('Pop 완료', '가장 최근 stash@{0} 적용')
  },
  onError: (e) => toast.error('Pop 실패', describeError(e)),
})

// === Handlers ===
async function onUndo() {
  if (props.repoId == null) {
    toast.warning('레포 미선택', '먼저 레포를 선택하세요.')
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
    toast.warning('레포 미선택', '먼저 레포를 선택하세요.')
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
    toast.warning('레포 미선택', '먼저 레포를 선택하세요.')
    return
  }
  dispatchShortcut('newBranch')
}
async function onStash() {
  if (props.repoId == null) {
    toast.warning('레포 미선택', '먼저 레포를 선택하세요.')
    return
  }
  if (!hasChanges.value) {
    toast.info('Stash 할 변경사항 없음')
    return
  }
  // SEC-001 fix — destructive 액션 confirm (메시지 없이 즉시 stash).
  const ok = await confirmDialog({
    title: t('confirm.stashAllTitle'),
    message: t('confirm.stashAllMessage'),
    danger: true,
  })
  if (!ok) return
  stashMut.mutate(props.repoId)
}
async function onPop() {
  if (props.repoId == null) {
    toast.warning('레포 미선택', '먼저 레포를 선택하세요.')
    return
  }
  if (stashCount.value === 0) {
    toast.info('Stash 없음', 'pop 할 stash 가 없습니다.')
    return
  }
  // SEC-001 fix — pop 은 apply + drop 자동, conflict 시 working tree 더러워짐.
  const ok = await confirmDialog({
    title: t('confirm.popStashTitle'),
    message: t('confirm.popLatestStashMessage', { remaining: stashCount.value }),
    danger: true,
  })
  if (!ok) return
  popMut.mutate(props.repoId)
}
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
          :text="
            undoMut.isPending.value
              ? 'Undo 진행 중...'
              : '마지막 commit/amend 되돌리기 (--soft, working tree 보존)'
          "
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
          :text="
            redoMut.isPending.value
              ? 'Redo 진행 중...'
              : '직전 undo 되돌리기 (reset/checkout 만, working tree 보존)'
          "
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
                ? 'Pull 진행 중...'
                : `Pull — fetch + ${pullStrategyLabel(pullStrategy)}`
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
          <BaseTooltip
            text="Pull 전략 선택 (merge / rebase / ff-only / no-rebase)"
            placement="bottom"
          >
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
          :text="pushMut.isPending.value ? 'Push 진행 중...' : 'Push'"
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
        <BaseTooltip text="브랜치 패널 전환 + 새 브랜치 입력" kbd="⌘B" placement="bottom">
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
              ? 'Stash 할 working tree 변경 없음'
              : stashMut.isPending.value
                ? 'Stash 진행 중...'
                : '현재 변경사항 즉시 stash (메시지 없이)'
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
              ? 'pop 할 stash 없음'
              : popMut.isPending.value
                ? 'Pop 진행 중...'
                : `가장 최근 stash@{0} apply + drop (총 ${stashCount}개)`
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
              <span v-if="stashCount > 0" class="ml-0.5 text-emerald-500">{{ stashCount }}</span>
            </span>
          </button>
        </BaseTooltip>
      </div>

      <span class="mx-1 h-7 w-px bg-border" aria-hidden="true" />

      <!-- [shell] Terminal -->
      <BaseTooltip text="통합 터미널 토글" kbd="⌘`" placement="bottom">
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
        :text="fetchMut.isPending.value ? 'Fetch 진행 중...' : 'origin 만 가져오기 (merge 없음)'"
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
            ? `별칭 (원본: ${repoBreadcrumb.original})`
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
        <span v-if="ahead" class="text-emerald-500">↑{{ ahead }}</span>
        <span v-if="behind" class="ml-1 text-rose-500">↓{{ behind }}</span>
      </span>
    </div>
  </header>
</template>
