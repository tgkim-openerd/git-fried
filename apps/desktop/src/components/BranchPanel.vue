<script setup lang="ts">
// 브랜치 패널 — 로컬/원격 트리 + switch / create / delete + Hide / Solo (Sprint A1).
// HEAD 표시, ahead/behind 카운터 포함.
import { computed, ref, useTemplateRef } from 'vue'
import { useBranches } from '@/composables/useBranches'
import { useToast } from '@/composables/useToast'
// Sprint c44 W4 — Hide/Solo 통합 composable 위임 (50 LOC 축약).
import { useBranchVisibilityActions } from '@/composables/useBranchVisibilityActions'
// Sprint c79-B — switch/create/delete mutation + handler 통합 composable 위임.
import { useBranchPanelMutations, localName } from '@/composables/useBranchPanelMutations'
import { useAiCli, confirmAiSend } from '@/composables/useAiCli'
// Sprint c32 god comp 분리 9/N — Explain branch (modal state + IPC) composable.
import { useExplainBranch } from '@/composables/useExplainBranch'
// Sprint c40 god comp 분리 — drag-drop 영역 (107 LOC) 외부화.
import { useBranchDragDrop } from '@/composables/useBranchDragDrop'
import AiResultModal from './AiResultModal.vue'
import RemoteManageModal from './RemoteManageModal.vue'
import ContextMenu, { type ContextMenuExpose } from './ContextMenu.vue'
import { useI18n } from 'vue-i18n'
import { promptDialog } from '@/composables/useConfirm'
import { useBranchActions, localBranchName } from '@/composables/useBranchActions'
import SkeletonBlock from './SkeletonBlock.vue'
import EmptyState from './EmptyState.vue'
// GitKraken parity — prefix `/` 트리화 (MiniBranchList 와 동일 helper 재사용).
import { buildBranchTree, filterTree } from '@/composables/useBranchTree'
import BranchTreeView from './BranchTreeView.vue'
import type { BranchInfo, HiddenRefKind } from '@/api/git'

const toast = useToast()
const { t } = useI18n()

const props = defineProps<{ repoId: number | null }>()
const { data: branches, isFetching: branchesFetching } = useBranches(() => props.repoId)

const newBranchName = ref('')
const filterKind = ref<'all' | 'local' | 'remote'>('local')
const remoteManageOpen = ref(false)
// GitKraken Filter input — leaf 이름 substring 매칭 + 자동 expand all.
const filterQuery = ref('')

// Hide/Solo state — useBranchVisibilityActions composable 위임 (Sprint c44 W4).
const { hiddenSet, soloRef, isHidden, toggleHide, toggleSolo, setSolo, bulkHideKind, unhideAll } =
  useBranchVisibilityActions(() => props.repoId)
function bulkHide(kind: HiddenRefKind) {
  bulkHideKind(kind, branches.value)
}

const filtered = computed(() => {
  if (!branches.value) return []
  if (filterKind.value === 'all') return branches.value
  return branches.value.filter((b) => b.kind === filterKind.value)
})

// prefix `/` trie + Filter query 적용. autoExpand 는 filterQuery 비어있지 않을 때.
const tree = computed(() => {
  const built = buildBranchTree<BranchInfo>(filtered.value, { getName: (b) => b.name })
  return filterTree(built, filterQuery.value.trim(), (b) => b.name)
})
const isSearching = computed(() => filterQuery.value.trim().length > 0)

// c79-B — switch/create/delete mutation + handler 통합 composable 위임.
const newBranchBase = ref('')
const { onSwitch, onCreate, onDelete, switchAsync, createMut } = useBranchPanelMutations({
  repoId: () => props.repoId,
  newBranchName,
  newBranchBase,
})

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
  if (b.isHead) lines.push(t('branch.tooltipHead'))
  lines.push(t('branch.tooltipDblclick'))
  return lines.join('\n')
}

// === AI Explain branch (Sprint B7 → Sprint c32 useExplainBranch composable) ===
const ai = useAiCli()
const {
  explainOpen,
  explainTitle,
  explainContent,
  explainError,
  explainPending,
  explain: explainBranchAi,
  close: closeExplainBranch,
} = useExplainBranch()

// === Sprint B8 → c40 — drag-drop composable 위임. c79-B: switchAsync 는 mutations composable 에서 노출. ===
const { dragOverIdx, onDragStartBranch, onDragOverRow, onDragLeaveRow, onDropOnBranch } =
  useBranchDragDrop({ repoId: () => props.repoId, localName, switchAsync })

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
    toast.error(t('branch.toastAiUnavailable'), t('branch.toastAiUnavailableBody'))
    return
  }
  // base 는 사용자 입력 — 디폴트 main / master 추정.
  const head = localName(b.name)
  const guessBase = b.kind === 'local' ? 'main' : 'main'
  const base = await promptDialog({
    title: t('branch.explainBaseTitle'),
    message: t('branch.explainBaseMessage', { head }),
    defaultValue: guessBase,
  })
  if (!base?.trim()) return
  if (!(await confirmAiSend())) return
  // Sprint c32 — composable 위임 (modal open + IPC + 결과 ref 갱신).
  await explainBranchAi(props.repoId, ai.available.value, head, base.trim())
}
</script>

<template>
  <section class="flex h-full flex-col border-l border-border bg-card">
    <header class="flex items-center justify-between border-b border-border px-3 py-2">
      <h3 class="text-sm font-semibold">
        {{ t('branch.title') }}
        <span
          v-if="soloRef"
          class="ml-1 text-[10px] font-normal text-orange-700 dark:text-orange-500"
        >
          {{ t('branch.soloIndicator', { name: soloRef }) }}
        </span>
      </h3>
      <div class="flex gap-1 text-[10px]">
        <button
          v-for="k in ['local', 'remote', 'all'] as const"
          :key="k"
          type="button"
          class="rounded px-1.5 py-0.5"
          :class="filterKind === k ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'"
          :aria-label="t('branch.filterAriaLabel', { kind: k })"
          :aria-pressed="filterKind === k"
          @click="filterKind = k"
        >
          {{ t(`branch.filter${k.charAt(0).toUpperCase() + k.slice(1)}`) }}
        </button>
        <button
          type="button"
          class="rounded border border-border px-1.5 py-0.5 text-muted-foreground hover:bg-accent/40"
          :title="t('branch.remoteManage')"
          :aria-label="t('branch.remoteManage')"
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
      <span>{{ t('branch.hideLabel') }}</span>
      <button
        type="button"
        class="rounded border border-border px-1.5 hover:bg-accent/40"
        :title="t('branch.hideAllRemotesTitle')"
        @click="bulkHide('remote')"
      >
        {{ t('branch.hideAllRemotes') }}
      </button>
      <button
        type="button"
        class="rounded border border-border px-1.5 hover:bg-accent/40"
        :title="t('branch.hideAllLocalTitle')"
        @click="bulkHide('branch')"
      >
        {{ t('branch.hideAllLocal') }}
      </button>
      <span class="ml-auto" />
      <button
        v-if="hiddenSet.size > 0"
        type="button"
        class="rounded border border-border px-1.5 hover:bg-accent/40"
        :title="t('branch.restoreTitle')"
        @click="unhideAll()"
      >
        {{ t('branch.restore', { n: hiddenSet.size }) }}
      </button>
      <button
        v-if="soloRef"
        type="button"
        class="rounded border border-orange-500 px-1.5 text-orange-700 dark:text-orange-500 hover:bg-orange-500/10"
        :title="t('branch.soloOffTitle')"
        @click="setSolo(null)"
      >
        {{ t('branch.soloOff') }}
      </button>
    </div>

    <!-- 새 브랜치 입력 — B4-07: 이름 + 선택적 base ref -->
    <div class="flex flex-col gap-1 border-b border-border px-3 py-2">
      <div class="flex gap-1">
        <input
          v-model="newBranchName"
          :placeholder="t('branch.newPlaceholder')"
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
      <input
        v-model="newBranchBase"
        :placeholder="t('branch.newBasePlaceholder')"
        class="rounded-md border border-input bg-background px-2 py-1 text-[11px]"
        @keyup.enter="onCreate"
      />
    </div>

    <!-- GitKraken Filter input — leaf name substring 매칭. 비우면 트리 원본 + 사용자 expand 상태 복원. -->
    <div class="border-b border-border px-3 py-1.5">
      <input
        v-model="filterQuery"
        type="search"
        :placeholder="t('branch.filterTreePlaceholder')"
        class="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
        :aria-label="t('branch.filterTreePlaceholder')"
      />
    </div>

    <AiResultModal
      :open="explainOpen"
      :title="explainTitle"
      :content="explainContent"
      :loading="explainPending"
      :error="explainError"
      @close="closeExplainBranch"
    />

    <div class="flex-1 overflow-auto px-1 py-2">
      <!-- Sprint 22-17 E-1: 첫 로딩 시 skeleton (branches 데이터 부재 + fetching) -->
      <SkeletonBlock
        v-if="branchesFetching && (!branches || branches.length === 0)"
        :count="6"
        height="sm"
        class="px-2"
      />
      <!-- c59-3 — branches 로드 완료 후 결과 비었을 때 EmptyState. 필터 결과 vs 진짜 빈 저장소 구분 -->
      <EmptyState
        v-else-if="!filtered || filtered.length === 0"
        icon="🌳"
        :title="branches && branches.length > 0 ? t('branch.emptyFiltered') : t('branch.empty')"
        :description="
          branches && branches.length > 0 ? t('branch.emptyFilteredHint') : t('branch.emptyHint')
        "
        size="sm"
      />
      <BranchTreeView
        v-else
        :nodes="tree"
        storage-key="branch-panel.tree"
        :auto-expand="isSearching"
      >
        <template #default="{ data: b, index: idx }: { data: BranchInfo; index: number }">
          <div
            :key="`${b.kind}-${b.name}`"
            class="group flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent/40"
            :class="[
              b.isHead ? 'bg-accent/60 font-semibold' : '',
              isHidden(b.name) ? 'opacity-40 line-through' : '',
              soloRef === b.name ? 'bg-orange-500/10 ring-1 ring-orange-500/40' : '',
              dragOverIdx === idx ? 'ring-2 ring-primary/60 bg-primary/10' : '',
            ]"
            draggable="true"
            role="button"
            tabindex="0"
            :title="branchHoverTitle(b)"
            @dblclick="onSwitch(b)"
            @keydown.enter.self="onSwitch(b)"
            @keydown.space.self.prevent="onSwitch(b)"
            @contextmenu="onBranchContextMenu($event, b)"
            @dragstart="onDragStartBranch(b, $event)"
            @dragover="onDragOverRow(idx, $event)"
            @dragleave="onDragLeaveRow(idx)"
            @drop="onDropOnBranch(b, $event)"
          >
            <span class="w-3 text-[10px]">{{ b.isHead ? '●' : '' }}</span>
            <span class="flex-1 truncate font-mono text-xs">{{ b.name.split('/').pop() }}</span>
            <span v-if="b.ahead || b.behind" class="text-[10px]">
              <span v-if="b.ahead" class="text-diff-add">↑{{ b.ahead }}</span>
              <span v-if="b.behind" class="ml-0.5 text-danger-rose">↓{{ b.behind }}</span>
            </span>
            <!-- Hide 토글 (eye icon) — 항상 보이되 hidden 일 때 닫힌 눈 -->
            <button
              type="button"
              class="text-[11px] opacity-30 group-hover:opacity-100"
              :class="isHidden(b.name) ? 'opacity-100 text-muted-foreground' : ''"
              :title="isHidden(b.name) ? '숨김 해제' : '그래프에서 숨김'"
              :aria-label="
                isHidden(b.name) ? `'${b.name}' 숨김 해제` : `'${b.name}' 그래프에서 숨김`
              "
              @click.stop="toggleHide(b)"
            >
              {{ isHidden(b.name) ? '🙈' : '👁' }}
            </button>
            <!-- Solo 토글 -->
            <button
              type="button"
              class="text-[10px] opacity-0 group-hover:opacity-100"
              :class="
                soloRef === b.name
                  ? 'opacity-100 text-orange-700 dark:text-orange-500'
                  : 'text-muted-foreground'
              "
              :title="soloRef === b.name ? 'Solo 해제' : '이 브랜치만 표시'"
              :aria-label="
                soloRef === b.name ? `'${b.name}' Solo 해제` : `'${b.name}' 만 그래프에 표시`
              "
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
          </div>
        </template>
      </BranchTreeView>
    </div>

    <ContextMenu ref="ctxMenu" />
  </section>
</template>
