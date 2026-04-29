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
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import {
  fetchAll,
  popStash,
  pull,
  pushStash,
  push,
  redoLastAction,
  undoLastAction,
  updateSubmodules,
} from '@/api/git'
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
const pullMut = useMutation({
  mutationFn: (id: number) => pull({ repoId: id }),
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

// === Sprint c25-1.5 — Undo last action ===
// commit / amend 만 자동 reset --soft, 나머지는 ReflogModal 진입 권유.
const undoMut = useMutation({
  mutationFn: (id: number) => undoLastAction(id),
  onSuccess: (res) => {
    if (res.executed) {
      invalidate(props.repoId)
      // SEC-005 fix — reflog 출력의 control char (ANSI escape 등) 위생화.
      // Vue 자동 escape 가 XSS 자체는 차단하지만 toast 표시 깨짐 방지.
      const preview = res.message
        .split(/\r?\n/)[0]
        .slice(0, 50)
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1f]/g, '')
      toast.success(
        `Undid: ${res.action}`,
        preview ? `'${preview}' 되돌림 (--soft, working tree 보존)` : '되돌림 완료',
      )
    } else {
      toast.warning(
        `${res.action} 은 자동 undo 미지원`,
        (res.rejectionReason ?? '') + ' — Reflog 모달에서 직접 처리하세요.',
      )
      // 거부된 경우 ReflogModal 자동 오픈 — 사용자 후속 액션 가이드.
      window.gitFriedOpenReflog?.()
    }
  },
  onError: (e) => toast.error('Undo 실패', describeError(e)),
})

// Phase 1 (plan-reflog-undo) — Redo last action.
const redoMut = useMutation({
  mutationFn: (id: number) => redoLastAction(id),
  onSuccess: (res) => {
    if (res.executed) {
      invalidate(props.repoId)
      const preview = res.message
        .split(/\r?\n/)[0]
        .slice(0, 50)
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1f]/g, '')
      toast.success(`Redo: ${res.action}`, preview ? `'${preview}' 다시 적용` : '다시 적용 완료')
    } else {
      toast.warning(
        `Redo 거부 (${res.action})`,
        (res.rejectionReason ?? '') + ' — Reflog 모달에서 직접 처리하세요.',
      )
      window.gitFriedOpenReflog?.()
    }
  },
  onError: (e) => toast.error('Redo 실패', describeError(e)),
})

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
function onUndo() {
  if (props.repoId == null) {
    toast.warning('레포 미선택', '먼저 레포를 선택하세요.')
    return
  }
  // Sprint c25-1.5 — confirm 후 reset --soft HEAD@{1}.
  // commit/amend 만 자동 처리, 다른 액션은 backend 가 거부 + ReflogModal 자동 오픈.
  if (
    !confirm(
      '마지막 작업을 되돌립니다.\n\n' +
        '• commit / amend 만 자동 처리 (`reset --soft HEAD@{1}` — working tree 보존)\n' +
        '• merge / rebase / branch switch 등은 ReflogModal 로 안내\n\n' +
        '진행하시겠습니까?',
    )
  ) {
    return
  }
  undoMut.mutate(props.repoId)
}
function onRedo() {
  if (props.repoId == null) {
    toast.warning('레포 미선택', '먼저 레포를 선택하세요.')
    return
  }
  if (
    !confirm(
      '마지막 undo 를 되돌립니다.\n\n' +
        '• 직전 reflog action 이 reset/checkout 일 때만 자동 처리\n' +
        '• 그 외는 ReflogModal 안내\n' +
        '• checkout redo 는 working tree clean 필수\n\n' +
        '진행하시겠습니까?',
    )
  ) {
    return
  }
  redoMut.mutate(props.repoId)
}
function onFetch() {
  if (props.repoId != null) fetchMut.mutate(props.repoId)
}
function onPull() {
  if (props.repoId != null) pullMut.mutate(props.repoId)
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
function onStash() {
  if (props.repoId == null) {
    toast.warning('레포 미선택', '먼저 레포를 선택하세요.')
    return
  }
  if (!hasChanges.value) {
    toast.info('Stash 할 변경사항 없음')
    return
  }
  // SEC-001 fix — destructive 액션 confirm (메시지 없이 즉시 stash).
  if (
    !confirm(
      '현재 working tree 변경사항을 stash 합니다.\n\n' +
        '• 메시지 없이 즉시 stash\n' +
        '• stash list 에 stash@{0} 으로 push\n\n' +
        '진행하시겠습니까?',
    )
  ) {
    return
  }
  stashMut.mutate(props.repoId)
}
function onPop() {
  if (props.repoId == null) {
    toast.warning('레포 미선택', '먼저 레포를 선택하세요.')
    return
  }
  if (stashCount.value === 0) {
    toast.info('Stash 없음', 'pop 할 stash 가 없습니다.')
    return
  }
  // SEC-001 fix — pop 은 apply + drop 자동, conflict 시 working tree 더러워짐.
  if (
    !confirm(
      `stash@{0} 을 pop 합니다.\n\n` +
        `• working tree 에 적용 + stash 제거\n` +
        `• conflict 발생 시 stash 만 남고 working tree 가 더러워질 수 있음\n\n` +
        `진행하시겠습니까? (남은 stash: ${stashCount.value})`,
    )
  ) {
    return
  }
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
        <button
          type="button"
          class="flex flex-col items-center gap-0 rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:hover:bg-transparent"
          :disabled="!repoId || undoMut.isPending.value"
          :title="
            undoMut.isPending.value
              ? 'Undo 진행 중...'
              : 'Undo — 마지막 commit/amend 되돌리기 (--soft, working tree 보존)'
          "
          @click="onUndo"
        >
          <span class="text-base leading-none">↶</span>
          <span class="text-[10px] leading-tight">{{
            undoMut.isPending.value ? '...' : 'Undo'
          }}</span>
        </button>
        <button
          type="button"
          class="flex flex-col items-center gap-0 rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:hover:bg-transparent"
          :disabled="!repoId || redoMut.isPending.value"
          :title="
            redoMut.isPending.value
              ? 'Redo 진행 중...'
              : 'Redo — 직전 undo 되돌리기 (reset/checkout 만, working tree 보존)'
          "
          @click="onRedo"
        >
          <span class="text-base leading-none">↷</span>
          <span class="text-[10px] leading-tight">{{
            redoMut.isPending.value ? '...' : 'Redo'
          }}</span>
        </button>
      </div>

      <span class="mx-1 h-7 w-px bg-border" aria-hidden="true" />

      <!-- [sync] Pull / Push -->
      <div class="flex items-center gap-0.5">
        <button
          type="button"
          class="flex flex-col items-center gap-0 rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:hover:bg-transparent"
          :disabled="!repoId || pullMut.isPending.value"
          :title="pullMut.isPending.value ? 'Pull 진행 중...' : 'Pull (⌘⇧L) — fetch + merge/rebase'"
          @click="onPull"
        >
          <span class="text-base leading-none">⇩</span>
          <span class="text-[10px] leading-tight">{{
            pullMut.isPending.value ? '...' : 'Pull'
          }}</span>
        </button>
        <button
          type="button"
          class="flex flex-col items-center gap-0 rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:hover:bg-transparent"
          :disabled="!repoId || pushMut.isPending.value"
          :title="pushMut.isPending.value ? 'Push 진행 중...' : 'Push (⌘⇧K)'"
          @click="onPush"
        >
          <span class="text-base leading-none">⇧</span>
          <span class="text-[10px] leading-tight">{{
            pushMut.isPending.value ? '...' : 'Push'
          }}</span>
        </button>
      </div>

      <span class="mx-1 h-7 w-px bg-border" aria-hidden="true" />

      <!-- [branch] Branch / Stash / Pop -->
      <div class="flex items-center gap-0.5">
        <button
          type="button"
          class="flex flex-col items-center gap-0 rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:hover:bg-transparent"
          :disabled="!repoId"
          title="Branch (⌘B) — 브랜치 패널 전환 + 새 브랜치 입력"
          @click="onBranch"
        >
          <span class="text-base leading-none">⎇</span>
          <span class="text-[10px] leading-tight">Branch</span>
        </button>
        <button
          type="button"
          class="flex flex-col items-center gap-0 rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:hover:bg-transparent"
          :disabled="!repoId || !hasChanges || stashMut.isPending.value"
          :title="
            !hasChanges
              ? 'Stash 할 working tree 변경 없음'
              : stashMut.isPending.value
                ? 'Stash 진행 중...'
                : 'Stash — 현재 변경사항 즉시 stash (메시지 없이)'
          "
          @click="onStash"
        >
          <span class="text-base leading-none">⤓</span>
          <span class="text-[10px] leading-tight">{{
            stashMut.isPending.value ? '...' : 'Stash'
          }}</span>
        </button>
        <button
          type="button"
          class="flex flex-col items-center gap-0 rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:hover:bg-transparent"
          :disabled="!repoId || stashCount === 0 || popMut.isPending.value"
          :title="
            stashCount === 0
              ? 'pop 할 stash 없음'
              : popMut.isPending.value
                ? 'Pop 진행 중...'
                : `Pop — 가장 최근 stash@{0} apply + drop (총 ${stashCount}개)`
          "
          @click="onPop"
        >
          <span class="text-base leading-none">⤒</span>
          <span class="text-[10px] leading-tight">
            {{ popMut.isPending.value ? '...' : 'Pop' }}
            <span v-if="stashCount > 0" class="ml-0.5 text-emerald-500">{{ stashCount }}</span>
          </span>
        </button>
      </div>

      <span class="mx-1 h-7 w-px bg-border" aria-hidden="true" />

      <!-- [shell] Terminal -->
      <button
        type="button"
        class="flex flex-col items-center gap-0 rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        title="Terminal (⌘`) — 통합 터미널 토글"
        @click="onTerminal"
      >
        <span class="text-base leading-none">▸_</span>
        <span class="text-[10px] leading-tight">Terminal</span>
      </button>

      <span class="mx-1 h-7 w-px bg-border" aria-hidden="true" />

      <!-- Fetch — secondary, label only (Pull 옆 ▾ 대체 — 단순화) -->
      <button
        type="button"
        class="rounded-md px-2 py-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:hover:bg-transparent"
        :disabled="!repoId || fetchMut.isPending.value"
        :title="
          fetchMut.isPending.value
            ? 'Fetch 진행 중...'
            : 'Fetch (⌘L) — origin 만 가져오기 (merge 없음)'
        "
        @click="onFetch"
      >
        {{ fetchMut.isPending.value ? '...' : 'Fetch' }}
      </button>
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
