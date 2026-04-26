<script setup lang="ts">
// 메인 페이지 — SyncBar + 좌측(로그/그래프) + 우측 탭 패널 + 하단(commit input + 통합 터미널).
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useReposStore } from '@/stores/repos'
import { useStatus } from '@/composables/useStatus'
import CommitGraph from '@/components/CommitGraph.vue'
import StatusPanel from '@/components/StatusPanel.vue'
import SyncBar from '@/components/SyncBar.vue'
import CommitMessageInput from '@/components/CommitMessageInput.vue'
import BranchPanel from '@/components/BranchPanel.vue'
import StashPanel from '@/components/StashPanel.vue'
import SubmodulePanel from '@/components/SubmodulePanel.vue'
import LfsPanel from '@/components/LfsPanel.vue'
import ForgePanel from '@/components/ForgePanel.vue'
import WorktreePanel from '@/components/WorktreePanel.vue'
import InteractiveRebaseModal from '@/components/InteractiveRebaseModal.vue'
import TerminalPanel from '@/components/TerminalPanel.vue'
import CommitDiffModal from '@/components/CommitDiffModal.vue'
import { useShortcut } from '@/composables/useShortcuts'
import { useUiState } from '@/composables/useUiState'

const store = useReposStore()
const { data: status } = useStatus(() => store.activeRepoId)

const branch = computed(() => status.value?.branch ?? null)
const upstream = computed(() => status.value?.upstream ?? null)
const ahead = computed(() => status.value?.ahead ?? 0)
const behind = computed(() => status.value?.behind ?? 0)

type Tab =
  | 'status'
  | 'branches'
  | 'stash'
  | 'submodule'
  | 'lfs'
  | 'pr'
  | 'worktree'
const tab = ref<Tab>('status')

// 통합 터미널 가시성 (⌘` 토글) — `docs/plan/10 옵션 A`.
const terminalOpen = ref(false)

// ⌘1~⌘7 탭 전환 단축키
useShortcut('tab1', () => (tab.value = 'status'))
useShortcut('tab2', () => (tab.value = 'branches'))
useShortcut('tab3', () => (tab.value = 'stash'))
useShortcut('tab4', () => (tab.value = 'submodule'))
useShortcut('tab5', () => (tab.value = 'lfs'))
useShortcut('tab6', () => (tab.value = 'pr'))
useShortcut('tab7', () => (tab.value = 'worktree'))

// ⌘B → 브랜치 탭 (BranchPanel 의 새 브랜치 input 으로 자동 focus 가능)
useShortcut('newBranch', () => (tab.value = 'branches'))
useShortcut('terminal', () => (terminalOpen.value = !terminalOpen.value))

// Sprint B5 — ⌘K = 우측 detail 패널 토글
const ui = useUiState()
useShortcut('toggleDetail', ui.toggleDetail)

// Sprint B5 — ⌘D = 선택 commit 의 diff modal.
const selectedSha = ref<string | null>(null)
const diffModalOpen = ref(false)
function onSelectCommit(sha: string) {
  selectedSha.value = sha
}
useShortcut('showDiff', () => {
  if (selectedSha.value) diffModalOpen.value = true
})

// CommandPalette 에서 호출되는 외부 트리거.
function externalToggleTerminal() {
  terminalOpen.value = !terminalOpen.value
}
onMounted(() => {
  ;(window as unknown as {
    gitFriedToggleTerminal?: () => void
  }).gitFriedToggleTerminal = externalToggleTerminal
})
onUnmounted(() => {
  delete (window as unknown as { gitFriedToggleTerminal?: () => void })
    .gitFriedToggleTerminal
})
</script>

<template>
  <div
    class="grid h-full overflow-hidden"
    :class="terminalOpen ? 'grid-rows-[auto_minmax(0,1fr)_minmax(140px,30%)]' : 'grid-rows-[auto_1fr]'"
  >
    <SyncBar
      :repo-id="store.activeRepoId"
      :branch="branch"
      :upstream="upstream"
      :ahead="ahead"
      :behind="behind"
    />

    <div
      class="grid min-h-0 overflow-hidden"
      :class="ui.detailVisible.value ? 'grid-cols-[1fr_360px]' : 'grid-cols-[1fr_0]'"
    >
      <!-- 좌측: 커밋 그래프 + 로그 -->
      <CommitGraph :repo-id="store.activeRepoId" @select-commit="onSelectCommit" />

      <!-- 우측: 탭 (Status / Branches / Stash) + 하단 commit input -->
      <div
        v-if="ui.detailVisible.value"
        class="grid grid-rows-[auto_1fr_auto] overflow-hidden border-l border-border"
      >
        <nav class="flex border-b border-border bg-card text-xs">
          <button
            v-for="t in [
              'status',
              'branches',
              'stash',
              'submodule',
              'lfs',
              'pr',
              'worktree',
            ] as Tab[]"
            :key="t"
            type="button"
            class="flex-1 px-1.5 py-1.5 capitalize"
            :class="
              tab === t
                ? 'bg-accent text-accent-foreground font-semibold'
                : 'text-muted-foreground hover:bg-accent/40'
            "
            @click="tab = t"
          >
            {{
              t === 'status'
                ? '변경'
                : t === 'branches'
                ? '브랜치'
                : t === 'stash'
                ? 'Stash'
                : t === 'submodule'
                ? 'Sub'
                : t === 'lfs'
                ? 'LFS'
                : t === 'pr'
                ? 'PR'
                : 'WT'
            }}
          </button>
        </nav>

        <div class="overflow-hidden">
          <StatusPanel v-if="tab === 'status'" :repo-id="store.activeRepoId" class="h-full border-l-0" />
          <BranchPanel v-else-if="tab === 'branches'" :repo-id="store.activeRepoId" class="h-full border-l-0" />
          <StashPanel v-else-if="tab === 'stash'" :repo-id="store.activeRepoId" class="h-full border-l-0" />
          <SubmodulePanel v-else-if="tab === 'submodule'" :repo-id="store.activeRepoId" class="h-full border-l-0" />
          <LfsPanel v-else-if="tab === 'lfs'" :repo-id="store.activeRepoId" class="h-full border-l-0" />
          <ForgePanel v-else-if="tab === 'pr'" :repo-id="store.activeRepoId" class="h-full" />
          <WorktreePanel v-else :repo-id="store.activeRepoId" class="h-full border-l-0" />
        </div>

        <CommitMessageInput
          :repo-id="store.activeRepoId"
          :ahead="ahead"
          :behind="behind"
        />
      </div>
    </div>

    <TerminalPanel
      v-if="terminalOpen"
      :visible="terminalOpen"
      class="row-start-3"
      @close="terminalOpen = false"
    />

    <InteractiveRebaseModal />
    <CommitDiffModal
      :repo-id="store.activeRepoId"
      :sha="selectedSha"
      :open="diffModalOpen"
      @close="diffModalOpen = false"
    />
  </div>
</template>
