<script setup lang="ts">
// Sprint c25-3 step 1 (`docs/plan/25 §4`) — 좌측 Sidebar 하단 mini section.
//
// GitKraken 의 "좌측 sidebar 가 풍부한 정보를 담는다" 방향성의 첫 step.
// 활성 레포의 핵심 상태 (branch, ahead/behind, changes count) + 7-tab 으로
// 1-click 진입할 수 있는 단축 버튼만 모음. 7-tab 자체는 우측 패널에 그대로 유지
// (대규모 layout swap 은 별도 sprint 로 이연).
//
// 의도: Sidebar 의 footer 위, repo list 아래에 collapsible details 로 배치.
// 영속화: localStorage `git-fried.active-repo-quick.collapsed`.
import { computed } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { useStatus, useInvalidateRepoQueries } from '@/composables/useStatus'
import { useBranches } from '@/composables/useBranches'
import { useStash } from '@/composables/useStash'
import { dispatchShortcut } from '@/composables/useShortcuts'
import { useReposStore } from '@/stores/repos'
import { useSectionCollapse } from '@/composables/useSectionCollapse'
import { useQueryClient } from '@tanstack/vue-query'
import { applyStash, popStash, switchBranch } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'

const store = useReposStore()
const toast = useToast()
const invalidate = useInvalidateRepoQueries()
const collapsed = useSectionCollapse('active-repo-quick')

const repoIdRef = computed(() => store.activeRepoId)
const { data: status } = useStatus(repoIdRef)
// c25-3 step 2 — 활성 레포의 로컬 브랜치 mini list (top 5, current HEAD ✓).
const { data: branches } = useBranches(repoIdRef)
const localBranches = computed(() => {
  const all = branches.value ?? []
  return all.filter((b) => b.kind === 'local')
})
// HEAD branch 우선, 그 다음 최근 정렬 순.
const miniBranches = computed(() => {
  const list = [...localBranches.value]
  list.sort((a, b) => {
    if (a.isHead && !b.isHead) return -1
    if (b.isHead && !a.isHead) return 1
    return 0
  })
  return list.slice(0, 5)
})
const moreBranchesCount = computed(() =>
  Math.max(0, localBranches.value.length - miniBranches.value.length),
)

const switchMut = useMutation({
  mutationFn: ({ id, name }: { id: number; name: string }) => switchBranch(id, name),
  onSuccess: (_res, vars) => {
    invalidate(store.activeRepoId)
    toast.success(`브랜치 전환`, vars.name)
  },
  onError: (e) => toast.error('브랜치 전환 실패', describeError(e)),
})
function onSwitchBranch(name: string, isHead: boolean) {
  if (isHead) return
  if (store.activeRepoId == null) return
  switchMut.mutate({ id: store.activeRepoId, name })
}

// === c25-3 step 3 — Stash mini list ===
const queryClient = useQueryClient()
const { data: stashes } = useStash(repoIdRef)
const miniStashes = computed(() => (stashes.value ?? []).slice(0, 3))
const moreStashesCount = computed(() =>
  Math.max(0, (stashes.value?.length ?? 0) - miniStashes.value.length),
)

function invalidateStash() {
  queryClient.invalidateQueries({ queryKey: ['stash', store.activeRepoId] })
}

const applyStashMut = useMutation({
  mutationFn: ({ id, idx }: { id: number; idx: number }) => applyStash(id, idx),
  onSuccess: () => {
    invalidate(store.activeRepoId)
    invalidateStash()
    toast.success('Stash apply 완료', 'working tree 에 적용됨 (stash 보존)')
  },
  onError: (e) => toast.error('Stash apply 실패', describeError(e)),
})
const popStashMut = useMutation({
  mutationFn: ({ id, idx }: { id: number; idx: number }) => popStash(id, idx),
  onSuccess: () => {
    invalidate(store.activeRepoId)
    invalidateStash()
    toast.success('Stash pop 완료', 'apply + 제거')
  },
  onError: (e) => toast.error('Stash pop 실패', describeError(e)),
})

function onApplyStash(idx: number) {
  if (store.activeRepoId == null) return
  applyStashMut.mutate({ id: store.activeRepoId, idx })
}
function onPopStash(idx: number) {
  if (store.activeRepoId == null) return
  popStashMut.mutate({ id: store.activeRepoId, idx })
}

const branch = computed(() => status.value?.branch ?? null)
const upstream = computed(() => status.value?.upstream ?? null)
const ahead = computed(() => status.value?.ahead ?? 0)
const behind = computed(() => status.value?.behind ?? 0)

const counts = computed(() => {
  const s = status.value
  if (!s) return { total: 0, staged: 0, unstaged: 0, untracked: 0, conflicted: 0 }
  const staged = s.staged?.length ?? 0
  const unstaged = s.unstaged?.length ?? 0
  const untracked = s.untracked?.length ?? 0
  const conflicted = s.conflicted?.length ?? 0
  return { total: staged + unstaged + untracked + conflicted, staged, unstaged, untracked, conflicted }
})

// 7-tab 단축 버튼 — pages/index.vue 의 useShortcut('tab1'~'tab7') 로 dispatch.
// (변경/브랜치/Stash/Sub/LFS/PR/WT 매핑)
const QUICK_TABS = [
  { key: 'tab1', icon: '◇', label: '변경', title: '변경 탭 (⌘1)' },
  { key: 'tab2', icon: '⎇', label: '브랜치', title: '브랜치 탭 (⌘2 / ⌘B)' },
  { key: 'tab3', icon: '⤓', label: 'Stash', title: 'Stash 탭 (⌘3)' },
  { key: 'tab6', icon: '⇄', label: 'PR', title: 'PR 탭 (⌘6)' },
  { key: 'tab7', icon: '🌳', label: 'Worktree', title: 'Worktree 탭 (⌘7)' },
] as const
</script>

<template>
  <details
    class="border-t border-border bg-muted/20"
    :open="!collapsed"
    @toggle="(e: ToggleEvent) => (collapsed = !(e.target as HTMLDetailsElement).open)"
  >
    <summary
      class="cursor-pointer select-none px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
    >
      활성 레포
      <span v-if="store.activeRepoId == null" class="ml-1 font-normal normal-case text-muted-foreground/70">(미선택)</span>
    </summary>

    <div v-if="store.activeRepoId != null" class="space-y-2 px-3 pb-2">
      <!-- branch + upstream -->
      <div class="flex flex-wrap items-baseline gap-1 font-mono text-xs">
        <span class="text-muted-foreground">on</span>
        <span class="font-semibold text-foreground">{{ branch || '(no branch)' }}</span>
        <span v-if="upstream" class="text-[10px] text-muted-foreground">→ {{ upstream }}</span>
        <span v-if="ahead || behind" class="text-[10px]">
          <span v-if="ahead" class="text-emerald-500">↑{{ ahead }}</span>
          <span v-if="behind" class="ml-0.5 text-rose-500">↓{{ behind }}</span>
        </span>
      </div>

      <!-- changes count badges -->
      <div v-if="counts.total > 0" class="flex flex-wrap gap-1 text-[10px]">
        <span v-if="counts.staged > 0" class="rounded bg-emerald-500/15 px-1 text-emerald-500">
          staged {{ counts.staged }}
        </span>
        <span v-if="counts.unstaged > 0" class="rounded bg-amber-500/15 px-1 text-amber-500">
          mod {{ counts.unstaged }}
        </span>
        <span v-if="counts.untracked > 0" class="rounded bg-sky-500/15 px-1 text-sky-500">
          new {{ counts.untracked }}
        </span>
        <span v-if="counts.conflicted > 0" class="rounded bg-rose-500/15 px-1 text-rose-500">
          ⚠ {{ counts.conflicted }}
        </span>
      </div>
      <div v-else class="text-[10px] text-muted-foreground">변경사항 없음 ✓</div>

      <!-- quick tab buttons -->
      <div class="grid grid-cols-5 gap-1">
        <button
          v-for="t in QUICK_TABS"
          :key="t.key"
          type="button"
          class="flex flex-col items-center gap-0 rounded-md border border-border bg-card px-1 py-1 text-[10px] hover:bg-accent hover:text-accent-foreground"
          :title="t.title"
          @click="dispatchShortcut(t.key)"
        >
          <span class="text-sm leading-none">{{ t.icon }}</span>
          <span class="leading-tight">{{ t.label }}</span>
        </button>
      </div>

      <!-- c25-3 step 2 — 로컬 브랜치 mini list (top 5, 클릭 시 switch). -->
      <div v-if="miniBranches.length > 0" class="mt-1 space-y-0.5">
        <div class="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>로컬 브랜치 ({{ localBranches.length }})</span>
          <button
            type="button"
            class="rounded px-1 hover:bg-accent/40 hover:text-foreground"
            title="전체 브랜치 패널 (⌘B)"
            @click="dispatchShortcut('newBranch')"
          >
            전체 →
          </button>
        </div>
        <ul class="space-y-0.5">
          <li
            v-for="b in miniBranches"
            :key="`mb-${b.name}`"
            class="group flex items-center gap-1 rounded px-1 py-0.5 text-[11px]"
            :class="
              b.isHead
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'text-foreground hover:bg-accent/40 cursor-pointer'
            "
            :title="
              b.isHead
                ? '현재 HEAD (체크아웃 됨)'
                : `${b.name} 으로 체크아웃 (clean working tree 권장)`
            "
            @click="onSwitchBranch(b.name, b.isHead)"
          >
            <span class="shrink-0 w-3 text-center">{{ b.isHead ? '●' : '' }}</span>
            <span class="flex-1 truncate font-mono">{{ b.name }}</span>
            <span v-if="b.ahead || b.behind" class="text-[9px]">
              <span v-if="b.ahead" class="text-emerald-500">↑{{ b.ahead }}</span>
              <span v-if="b.behind" class="ml-0.5 text-rose-500">↓{{ b.behind }}</span>
            </span>
          </li>
          <li
            v-if="moreBranchesCount > 0"
            class="px-1 py-0.5 text-[10px] text-muted-foreground"
          >
            ⋯ +{{ moreBranchesCount }}개 더 (전체 → 클릭)
          </li>
        </ul>
      </div>

      <!-- c25-3 step 3 — Stash mini list (recent 3, apply / pop). -->
      <div v-if="miniStashes.length > 0" class="mt-1 space-y-0.5">
        <div class="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Stash ({{ stashes?.length ?? 0 }})</span>
          <button
            type="button"
            class="rounded px-1 hover:bg-accent/40 hover:text-foreground"
            title="Stash 패널 (⌘3)"
            @click="dispatchShortcut('tab3')"
          >
            전체 →
          </button>
        </div>
        <ul class="space-y-0.5">
          <li
            v-for="s in miniStashes"
            :key="`ms-${s.index}`"
            class="group flex items-center gap-1 rounded px-1 py-0.5 text-[11px] hover:bg-accent/30"
            :title="`stash@{${s.index}} on ${s.branch ?? 'unknown'} — ${s.message}`"
          >
            <span class="shrink-0 font-mono text-[10px] text-muted-foreground">
              @{{ s.index }}
            </span>
            <span class="flex-1 truncate">{{ s.message || '(no message)' }}</span>
            <button
              type="button"
              class="opacity-0 group-hover:opacity-100 rounded border border-border px-1 py-0 text-[9px] text-muted-foreground hover:bg-accent/40"
              title="apply (working tree 에 적용, stash 보존)"
              :disabled="applyStashMut.isPending.value"
              @click="onApplyStash(s.index)"
            >
              apply
            </button>
            <button
              type="button"
              class="opacity-0 group-hover:opacity-100 rounded border border-border px-1 py-0 text-[9px] text-muted-foreground hover:bg-accent/40"
              title="pop (apply + 제거)"
              :disabled="popStashMut.isPending.value"
              @click="onPopStash(s.index)"
            >
              pop
            </button>
          </li>
          <li
            v-if="moreStashesCount > 0"
            class="px-1 py-0.5 text-[10px] text-muted-foreground"
          >
            ⋯ +{{ moreStashesCount }}개 더 (전체 → 클릭)
          </li>
        </ul>
      </div>
    </div>
  </details>
</template>
