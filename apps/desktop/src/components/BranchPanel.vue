<script setup lang="ts">
// 브랜치 패널 — 로컬/원격 트리 + switch / create / delete + Hide / Solo (Sprint A1).
// HEAD 표시, ahead/behind 카운터 포함.
import { computed, ref, useTemplateRef } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { useBranches } from '@/composables/useBranches'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import {
  createBranch,
  deleteBranch,
  switchBranch,
} from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import {
  useHiddenRefs,
  useHiddenRefMutations,
  useSoloRef,
} from '@/composables/useHiddenRefs'
import { useAiCli, confirmAiSend, notifyAiDone } from '@/composables/useAiCli'
import {
  aiExplainBranch,
  cherryPickSha,
  mergeBranch,
  rebaseBranch,
} from '@/api/git'
import AiResultModal from './AiResultModal.vue'
import RemoteManageModal from './RemoteManageModal.vue'
import ContextMenu, { type ContextMenuExpose } from './ContextMenu.vue'
import { useBranchActions, localBranchName } from '@/composables/useBranchActions'
import type { BranchInfo, HiddenRefKind } from '@/api/git'

const toast = useToast()

const props = defineProps<{ repoId: number | null }>()
const { data: branches } = useBranches(() => props.repoId)
const invalidate = useInvalidateRepoQueries()

const newBranchName = ref('')
const filterKind = ref<'all' | 'local' | 'remote'>('local')
const remoteManageOpen = ref(false)

// Hide/Solo state
const { data: hiddenList } = useHiddenRefs(() => props.repoId)
const hiddenMut = useHiddenRefMutations(() => props.repoId)
const { current: soloRef, setSolo } = useSoloRef(() => props.repoId)

const hiddenSet = computed<Set<string>>(() => {
  const s = new Set<string>()
  for (const h of hiddenList.value ?? []) s.add(h.refName)
  return s
})

const filtered = computed(() => {
  if (!branches.value) return []
  if (filterKind.value === 'all') return branches.value
  return branches.value.filter((b) => b.kind === filterKind.value)
})

function refKindOf(b: BranchInfo): HiddenRefKind {
  return b.kind === 'remote' ? 'remote' : 'branch'
}

function isHidden(name: string): boolean {
  return hiddenSet.value.has(name)
}

function toggleHide(b: BranchInfo) {
  if (props.repoId == null) return
  if (isHidden(b.name)) {
    hiddenMut.unhide.mutate(b.name)
  } else {
    hiddenMut.hide.mutate({ refName: b.name, refKind: refKindOf(b) })
  }
}

function toggleSolo(b: BranchInfo) {
  setSolo(b.name)
}

function bulkHideKind(kind: HiddenRefKind) {
  if (!branches.value) return
  const targets = branches.value
    .filter((b) => refKindOf(b) === kind && !isHidden(b.name))
    .map((b) => ({ refName: b.name, refKind: kind }))
  if (targets.length === 0) {
    toast.success('이미 모두 hidden', '')
    return
  }
  hiddenMut.bulkHide.mutate(targets, {
    onSuccess: (n) => toast.success(`${n}개 hidden`, kind),
    onError: (e) => toast.error('일괄 hide 실패', describeError(e)),
  })
}

const switchMut = useMutation({
  mutationFn: ({ id, name }: { id: number; name: string }) =>
    switchBranch(id, name, false),
  onSuccess: () => invalidate(props.repoId),
  onError: (e) => toast.error('Switch 실패', describeError(e)),
})

const createMut = useMutation({
  mutationFn: ({ id, name }: { id: number; name: string }) =>
    createBranch(id, name),
  onSuccess: () => {
    newBranchName.value = ''
    invalidate(props.repoId)
  },
  onError: (e) => toast.error('Create 실패', describeError(e)),
})

const deleteMut = useMutation({
  mutationFn: ({ id, name, force }: { id: number; name: string; force: boolean }) =>
    deleteBranch(id, name, force),
  onSuccess: () => invalidate(props.repoId),
  onError: (e) => toast.error('Delete 실패', describeError(e)),
})

function onSwitch(b: BranchInfo) {
  if (props.repoId == null) return
  if (b.isHead) return
  switchMut.mutate({ id: props.repoId, name: localName(b.name) })
}

function onCreate() {
  if (props.repoId == null) return
  if (!newBranchName.value.trim()) return
  createMut.mutate({ id: props.repoId, name: newBranchName.value.trim() })
}

function onDelete(b: BranchInfo) {
  if (props.repoId == null) return
  const force = (b.ahead > 0)
  if (
    !confirm(
      `브랜치 '${b.name}' 를 삭제하시겠습니까?` +
        (force ? '\n⚠ 머지되지 않은 커밋이 있어 강제 삭제 -D 합니다.' : ''),
    )
  )
    return
  deleteMut.mutate({ id: props.repoId, name: localName(b.name), force })
}

// "origin/foo" → "foo" (remote 브랜치 작업 시)
function localName(name: string): string {
  const parts = name.split('/')
  if (parts.length > 1) return parts.slice(1).join('/')
  return name
}

// === Sprint 22-9 V-7 — hover preview tooltip ===
// title attribute 로 latest commit subject + ahead/behind 풀어쓰기.
// dblclick=switch / 우클릭=메뉴 안내까지 포함.
function branchHoverTitle(b: BranchInfo): string {
  const lines: string[] = [b.name]
  if (b.lastCommitSubject) {
    const sha = b.lastCommitSha?.slice(0, 7) ?? ''
    lines.push(`최신 commit${sha ? ` (${sha})` : ''}: ${b.lastCommitSubject}`)
  }
  if (b.upstream) lines.push(`upstream: ${b.upstream}`)
  if (b.ahead) lines.push(`↑ ${b.ahead} (push 가능)`)
  if (b.behind) lines.push(`↓ ${b.behind} (pull 필요)`)
  if (b.isHead) lines.push('(현재 HEAD)')
  lines.push('— dblclick=switch, 우클릭=메뉴')
  return lines.join('\n')
}

// === AI Explain branch (Sprint B7) ===
const ai = useAiCli()
const explainOpen = ref(false)
const explainTitle = ref('')
const explainContent = ref('')
const explainError = ref<string | null>(null)
const explainPending = ref(false)

// === Sprint B8 — drag-drop ===
const dragOverIdx = ref<number | null>(null)
const DT_BRANCH = 'application/x-git-fried-branch'
const DT_COMMIT = 'application/x-git-fried-commit'

function onDragStartBranch(b: BranchInfo, ev: DragEvent) {
  if (!ev.dataTransfer) return
  ev.dataTransfer.setData(DT_BRANCH, b.name)
  ev.dataTransfer.effectAllowed = 'move'
}

function onDragOverRow(idx: number, ev: DragEvent) {
  if (!ev.dataTransfer) return
  const types = ev.dataTransfer.types
  if (types.includes(DT_BRANCH) || types.includes(DT_COMMIT)) {
    ev.preventDefault()
    dragOverIdx.value = idx
  }
}

function onDragLeaveRow(idx: number) {
  if (dragOverIdx.value === idx) dragOverIdx.value = null
}

async function onDropOnBranch(target: BranchInfo, ev: DragEvent) {
  ev.preventDefault()
  dragOverIdx.value = null
  if (!ev.dataTransfer || props.repoId == null) return
  const branchName = ev.dataTransfer.getData(DT_BRANCH)
  const commitSha = ev.dataTransfer.getData(DT_COMMIT)

  if (commitSha) {
    // commit → branch (cherry-pick onto branch).
    if (
      !confirm(`commit ${commitSha.slice(0, 7)} 를 '${target.name}' 에 cherry-pick?`)
    ) {
      return
    }
    try {
      const r = await cherryPickSha(
        props.repoId,
        commitSha,
        localName(target.name),
      )
      if (r.success) {
        toast.success('Cherry-pick 완료', target.name)
        invalidate(props.repoId)
      } else if (r.conflicted) {
        toast.error('충돌 발생', '변경 패널에서 해결')
        invalidate(props.repoId)
      } else {
        toast.error('Cherry-pick 실패', r.stderr.slice(0, 200))
      }
    } catch (e) {
      toast.error('Cherry-pick 호출 실패', describeError(e))
    }
    return
  }

  if (branchName && branchName !== target.name) {
    // branch (source) → branch (target). HEAD 가 어느 쪽인지 확인 → 의미 결정.
    // GitKraken UX: "drop A onto B" = A 가 B 위로 (A 가 source, B 가 target/HEAD).
    // 즉 우리는 target 으로 switch 후 source 머지 또는 target 위로 source rebase.
    const action = window.prompt(
      `${branchName} → ${target.name} : 어떤 작업?\n  m = merge (target 으로 switch + source 머지)\n  r = rebase (source 를 target 위로 rebase)\n  cancel = 취소`,
      'm',
    )
    if (!action) return
    const a = action.trim().toLowerCase()
    try {
      if (a === 'm' || a === 'merge') {
        // 1. target 으로 switch.
        await switchMut.mutateAsync({
          id: props.repoId,
          name: localName(target.name),
        })
        // 2. source 를 머지.
        const r = await mergeBranch(
          props.repoId,
          localName(branchName),
          true,
          false,
        )
        if (r.success) {
          toast.success('Merge 완료', `${branchName} → ${target.name}`)
        } else if (r.conflicted) {
          toast.error('Merge 충돌', '변경 패널에서 해결')
        } else {
          toast.error('Merge 실패', r.stderr.slice(0, 200))
        }
        invalidate(props.repoId)
      } else if (a === 'r' || a === 'rebase') {
        // 1. source 로 switch.
        await switchMut.mutateAsync({
          id: props.repoId,
          name: localName(branchName),
        })
        // 2. target 위로 rebase.
        const r = await rebaseBranch(props.repoId, localName(target.name))
        if (r.success) {
          toast.success('Rebase 완료', `${branchName} onto ${target.name}`)
        } else if (r.conflicted) {
          toast.error('Rebase 충돌', '변경 패널에서 해결 후 --continue')
        } else {
          toast.error('Rebase 실패', r.stderr.slice(0, 200))
        }
        invalidate(props.repoId)
      }
    } catch (e) {
      toast.error('호출 실패', describeError(e))
    }
  }
}

// === Sprint 22-3 — CM-5 우클릭 ContextMenu (11 액션) ===
const ctxMenu = useTemplateRef<ContextMenuExpose>('ctxMenu')
const branchActions = useBranchActions(() => props.repoId)

function onBranchContextMenu(ev: MouseEvent, b: BranchInfo) {
  ev.preventDefault()
  ev.stopPropagation()
  const items = branchActions.buildItems(b, {
    isHidden: (name) => isHidden(name),
    isSolo: (name) => soloRef.value === name,
    onToggleHide: (br) => toggleHide(br),
    onToggleSolo: (br) => toggleSolo(br),
    onCompare: (br) => {
      // ref 비교: HEAD vs 이 브랜치 (App.vue::openCompare 트리거)
      window.gitFriedOpenCompare?.('HEAD', localBranchName(br.name))
    },
  })
  ctxMenu.value?.openAt(ev, items)
}

async function onExplainBranch(b: BranchInfo) {
  if (props.repoId == null || ai.available.value == null) {
    toast.error('AI 사용 불가', 'Claude/Codex CLI 미설치')
    return
  }
  // base 는 사용자 입력 — 디폴트 main / master 추정.
  const head = localName(b.name)
  const guessBase = b.kind === 'local' ? 'main' : 'main'
  const base = window.prompt(
    `브랜치 ${head} 을(를) 어떤 base 와 비교?`,
    guessBase,
  )
  if (!base?.trim()) return
  if (!confirmAiSend()) return
  explainOpen.value = true
  explainTitle.value = `Branch ${head} (vs ${base.trim()})`
  explainContent.value = ''
  explainError.value = null
  explainPending.value = true
  try {
    const out = await aiExplainBranch(
      props.repoId,
      ai.available.value,
      head,
      base.trim(),
      true,
    )
    if (out.success) {
      explainContent.value = out.text
      notifyAiDone('AI 브랜치 설명', `${head} vs ${base.trim()}`)
    } else {
      explainError.value = out.stderr || out.text || '응답 실패'
    }
  } catch (e) {
    explainError.value = describeError(e)
  } finally {
    explainPending.value = false
  }
}
</script>

<template>
  <section class="flex h-full flex-col border-l border-border bg-card">
    <header class="flex items-center justify-between border-b border-border px-3 py-2">
      <h3 class="text-sm font-semibold">
        브랜치
        <span v-if="soloRef" class="ml-1 text-[10px] font-normal text-orange-500">
          [Solo: {{ soloRef }}]
        </span>
      </h3>
      <div class="flex gap-1 text-[10px]">
        <button
          v-for="k in ['local', 'remote', 'all'] as const"
          :key="k"
          type="button"
          class="rounded px-1.5 py-0.5"
          :class="filterKind === k ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'"
          @click="filterKind = k"
        >
          {{ k }}
        </button>
        <button
          type="button"
          class="rounded border border-border px-1.5 py-0.5 text-muted-foreground hover:bg-accent/40"
          title="Remote 관리 (add / remove / rename / URL 변경)"
          @click="remoteManageOpen = true"
        >
          🔗
        </button>
      </div>
    </header>

    <RemoteManageModal
      :open="remoteManageOpen"
      :repo-id="props.repoId"
      @close="remoteManageOpen = false"
    />

    <!-- Hide/Solo 컨트롤 (필터 별 일괄) -->
    <div
      class="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-1 text-[10px] text-muted-foreground"
    >
      <span>Hide:</span>
      <button
        type="button"
        class="rounded border border-border px-1.5 hover:bg-accent/40"
        title="모든 remote 일괄 hide"
        @click="bulkHideKind('remote')"
      >
        all remotes
      </button>
      <button
        type="button"
        class="rounded border border-border px-1.5 hover:bg-accent/40"
        title="모든 local branch 일괄 hide"
        @click="bulkHideKind('branch')"
      >
        all local
      </button>
      <span class="ml-auto" />
      <button
        v-if="hiddenSet.size > 0"
        type="button"
        class="rounded border border-border px-1.5 hover:bg-accent/40"
        title="복원"
        @click="hiddenMut.unhideAll.mutate()"
      >
        복원 ({{ hiddenSet.size }})
      </button>
      <button
        v-if="soloRef"
        type="button"
        class="rounded border border-orange-500 px-1.5 text-orange-500 hover:bg-orange-500/10"
        title="Solo 해제"
        @click="setSolo(null)"
      >
        Solo ✕
      </button>
    </div>

    <!-- 새 브랜치 입력 -->
    <div class="flex gap-1 border-b border-border px-3 py-2">
      <input
        v-model="newBranchName"
        placeholder="새 브랜치 (예: feat/foo)"
        class="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
        @keyup.enter="onCreate"
      />
      <button
        type="button"
        class="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
        :disabled="!newBranchName.trim() || createMut.isPending.value"
        @click="onCreate"
      >
        +
      </button>
    </div>

    <AiResultModal
      :open="explainOpen"
      :title="explainTitle"
      :content="explainContent"
      :loading="explainPending"
      :error="explainError"
      @close="explainOpen = false"
    />

    <div class="flex-1 overflow-auto px-1 py-2">
      <ul>
        <li
          v-for="(b, idx) in filtered"
          :key="`${b.kind}-${b.name}`"
          class="group flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent/40"
          :class="[
            b.isHead ? 'bg-accent/60 font-semibold' : '',
            isHidden(b.name) ? 'opacity-40 line-through' : '',
            soloRef === b.name ? 'bg-orange-500/10 ring-1 ring-orange-500/40' : '',
            dragOverIdx === idx ? 'ring-2 ring-primary/60 bg-primary/10' : '',
          ]"
          draggable="true"
          :title="branchHoverTitle(b)"
          @dblclick="onSwitch(b)"
          @contextmenu="onBranchContextMenu($event, b)"
          @dragstart="onDragStartBranch(b, $event)"
          @dragover="onDragOverRow(idx, $event)"
          @dragleave="onDragLeaveRow(idx)"
          @drop="onDropOnBranch(b, $event)"
        >
          <span class="w-3 text-[10px]">{{ b.isHead ? '●' : '' }}</span>
          <span class="flex-1 truncate font-mono text-xs">{{ b.name }}</span>
          <span v-if="b.ahead || b.behind" class="text-[10px]">
            <span v-if="b.ahead" class="text-emerald-500">↑{{ b.ahead }}</span>
            <span v-if="b.behind" class="ml-0.5 text-rose-500">↓{{ b.behind }}</span>
          </span>
          <!-- Hide 토글 (eye icon) — 항상 보이되 hidden 일 때 닫힌 눈 -->
          <button
            type="button"
            class="text-[11px] opacity-30 group-hover:opacity-100"
            :class="isHidden(b.name) ? 'opacity-100 text-muted-foreground' : ''"
            :title="isHidden(b.name) ? '숨김 해제' : '그래프에서 숨김'"
            :aria-label="isHidden(b.name) ? `'${b.name}' 숨김 해제` : `'${b.name}' 그래프에서 숨김`"
            @click.stop="toggleHide(b)"
          >
            {{ isHidden(b.name) ? '🙈' : '👁' }}
          </button>
          <!-- Solo 토글 -->
          <button
            type="button"
            class="text-[10px] opacity-0 group-hover:opacity-100"
            :class="soloRef === b.name ? 'opacity-100 text-orange-500' : 'text-muted-foreground'"
            :title="soloRef === b.name ? 'Solo 해제' : '이 브랜치만 표시'"
            :aria-label="soloRef === b.name ? `'${b.name}' Solo 해제` : `'${b.name}' 만 그래프에 표시`"
            @click.stop="toggleSolo(b)"
          >
            ◉
          </button>
          <!-- AI Explain (Sprint B7) -->
          <button
            v-if="ai.available.value"
            type="button"
            class="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
            :title="`✨ ${ai.available.value} 로 브랜치 설명`"
            :aria-label="`'${b.name}' AI 설명 (${ai.available.value})`"
            @click.stop="onExplainBranch(b)"
          >
            ✨
          </button>
          <button
            v-if="!b.isHead && b.kind === 'local'"
            type="button"
            class="opacity-0 group-hover:opacity-100 text-[10px] text-muted-foreground hover:text-destructive"
            title="삭제"
            :aria-label="`로컬 브랜치 '${b.name}' 삭제`"
            @click.stop="onDelete(b)"
          >
            ×
          </button>
        </li>
      </ul>
    </div>

    <ContextMenu ref="ctxMenu" />
  </section>
</template>
