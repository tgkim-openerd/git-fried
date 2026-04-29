<script setup lang="ts">
// 메인 페이지 — GitKrakenToolbar + 좌측(로그/그래프) + 우측 탭 패널 + 하단(commit input + 통합 터미널).
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useReposStore } from '@/stores/repos'
import { useStatus } from '@/composables/useStatus'
import { useGraph } from '@/composables/useGraph'
import CommitGraph from '@/components/CommitGraph.vue'
import StatusPanel from '@/components/StatusPanel.vue'
// Sprint c25-1 (`docs/plan/25 §2`) — SyncBar → GitKrakenToolbar 교체.
// SyncBar 는 단계적 마이그레이션을 위해 보존 (c25-3 이후 deprecation 검토).
import GitKrakenToolbar from '@/components/GitKrakenToolbar.vue'
// Sprint c25-2 (`docs/plan/25 §3`) — 우측 패널 영구 헤더 (탭 전환 무관).
import ChangeCountBadge from '@/components/ChangeCountBadge.vue'
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
// Sprint c25-4.5 — inline diff panel (CommitGraph 와 vertical split).
import CommitDiffPanel from '@/components/CommitDiffPanel.vue'
import CommitDetailSidebar from '@/components/CommitDetailSidebar.vue'
import WipBanner from '@/components/WipBanner.vue'
import { useShortcut } from '@/composables/useShortcuts'
import { useUiState } from '@/composables/useUiState'
import { useTabPerProfile } from '@/composables/useTabPerProfile'

const store = useReposStore()
const { data: status } = useStatus(() => store.activeRepoId)

const branch = computed(() => status.value?.branch ?? null)
const upstream = computed(() => status.value?.upstream ?? null)
const ahead = computed(() => status.value?.ahead ?? 0)
const behind = computed(() => status.value?.behind ?? 0)

// Phase 1 (plan-commit-graph-ux v2) — 8번째 'commit' tab 추가 (selectedSha 시 조건부 mount).
type Tab = 'status' | 'branches' | 'stash' | 'submodule' | 'lfs' | 'pr' | 'worktree' | 'commit'
const tab = ref<Tab>('status')

// Sprint B10 — per-profile 탭 영속화.
useTabPerProfile<Tab>(tab, 'status')

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

// Sprint C3 — Section header 더블클릭 maximize.
// 우측 탭 nav 더블클릭 시 좌측 그래프 일시 숨김 → 그 탭만 fullscreen.
// 영속화 안 함 (transient — 세션 메모리만).
const focusMode = ref(false)
function toggleFocusMode() {
  focusMode.value = !focusMode.value
}

// Sprint B5 — ⌘D = 선택 commit 의 diff modal.
// Sprint 22-3 V-1 — row dblclick 도 동일 액션 트리거.
const selectedSha = ref<string | null>(null)
const diffModalOpen = ref(false)
// Sprint c30 / GitKraken UX (Phase 1) — auto-default 와 명시 선택 구분.
//   user 가 한 번이라도 row click / ESC 했으면 true → 이후 auto-default 비활성.
//   repo 변경 시 false 로 reset (새 repo 의 latest 로 default 적용).
const userChoseSha = ref(false)
// Sprint c30 / GitKraken UX — commit row 단일 클릭 시 우측 패널 자동 전환:
//   1. 같은 sha 재선택: 선택 해제 (toggle, 우측 status 복귀)
//   2. 다른 sha: selectedSha set + tab='commit' 즉시 전환 (GitKraken 동작)
//      현재 어느 tab 이든 (Branches/PR/...) commit detail 로 즉시 전환됨.
function onSelectCommit(sha: string) {
  userChoseSha.value = true
  if (selectedSha.value === sha) {
    selectedSha.value = null
    return
  }
  selectedSha.value = sha
  tab.value = 'commit'
}

// Phase 1 (plan-commit-graph-ux v2) — main-nav 8번째 'commit' tab 조건부 mount.
const mainTabs = computed<Tab[]>(() => {
  const base: Tab[] = ['status', 'branches', 'stash', 'submodule', 'lfs', 'pr', 'worktree']
  return selectedSha.value ? [...base, 'commit'] : base
})

// Phase 1 — selectedSha=null 트랜지션 시 tab='commit' 이면 status fallback.
watch(selectedSha, (v) => {
  if (v == null && tab.value === 'commit') tab.value = 'status'
})

// Sprint c30 / GitKraken UX — ESC 키 = commit 선택 해제 (모달 없을 때만).
//   useShortcuts 가 ESC 를 cover 하지 않아 직접 window listener 등록.
//   modal/CommandPalette 가 자체 ESC 처리하면 그쪽이 stopPropagation 하므로 안전.
function onEscKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  // 모달 / palette 등이 열려있으면 (active element 가 input/dialog 안) skip
  const ae = document.activeElement
  if (
    ae &&
    (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.closest('[role="dialog"]'))
  ) {
    return
  }
  if (selectedSha.value != null) {
    userChoseSha.value = true // 명시적 deselect — auto-default 재적용 차단
    selectedSha.value = null
  }
}
onMounted(() => {
  window.addEventListener('keydown', onEscKey)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onEscKey)
})

// Phase 1 (Sprint c29-5) — activeRepoId 변경 시 selectedSha reset (graph 가 바뀌어 의미 잃음).
// Sprint c30 / GitKraken UX — userChoseSha 도 reset → 새 repo 의 latest 로 auto-default 재적용.
watch(
  () => store.activeRepoId,
  () => {
    selectedSha.value = null
    userChoseSha.value = false
  },
)

// Sprint c30 / GitKraken UX (Phase 1) — auto-default selectedSha to latest commit.
//   graph 로드 후 user 가 명시 선택/해제 안했으면 latest commit 으로 자동 set.
//   commit tab 클릭 시 즉시 detail 표시 (빈 "commit 선택하세요" placeholder 회피).
//   tab 자동 변경 안 함 — 사용자의 status tab 선택권 보존.
const { data: graphData } = useGraph(() => store.activeRepoId, 500)
watch(
  graphData,
  (g) => {
    if (!userChoseSha.value && selectedSha.value == null && g?.rows && g.rows.length > 0) {
      selectedSha.value = g.rows[0].commit.sha
    }
  },
  { immediate: true },
)
function onShowDiff(sha: string) {
  selectedSha.value = sha
  diffModalOpen.value = true
}
useShortcut('showDiff', () => {
  if (selectedSha.value) diffModalOpen.value = true
})

// Sprint c25-4.5 — ⌘⇧D = inline diff panel 토글.
// (⌘D 는 모달, ⌘⇧D 는 inline — 사용자 선택권)
useShortcut('toggleInlineDiff', () => setInlineDiff(!inlineDiffVisible.value))

// Sprint c25-4.5 — Inline diff panel (좌측 영역 vertical split).
// row 단일 클릭으로 selectedSha set → inline diff 자동 노출. ⌘D 모달은 그대로 유지.
// localStorage 'git-fried.inline-diff.visible' 영속 — 사용자가 ✕ 닫으면 다음 세션도 닫힘.
const INLINE_DIFF_KEY = 'git-fried.inline-diff.visible'
function loadInlineDiff(): boolean {
  if (typeof localStorage === 'undefined') return true
  return localStorage.getItem(INLINE_DIFF_KEY) !== '0'
}
const inlineDiffVisible = ref(loadInlineDiff())
function setInlineDiff(visible: boolean) {
  inlineDiffVisible.value = visible
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(INLINE_DIFF_KEY, visible ? '1' : '0')
  }
}
const inlineDiffActive = computed(() => inlineDiffVisible.value && selectedSha.value != null)

// CommandPalette 에서 호출되는 외부 트리거.
function externalToggleTerminal() {
  terminalOpen.value = !terminalOpen.value
}
onMounted(() => {
  window.gitFriedToggleTerminal = externalToggleTerminal
  // Sprint 22-4 V-6 보강: ReflogModal / 외부 트리거 → CommitDiffModal 진입.
  window.gitFriedShowDiff = onShowDiff
})
onUnmounted(() => {
  delete window.gitFriedToggleTerminal
  delete window.gitFriedShowDiff
})
</script>

<template>
  <div
    class="grid h-full overflow-hidden"
    :class="
      terminalOpen
        ? 'grid-rows-[auto_auto_minmax(0,1fr)_minmax(140px,30%)]'
        : 'grid-rows-[auto_auto_1fr]'
    "
  >
    <GitKrakenToolbar
      :repo-id="store.activeRepoId"
      :branch="branch"
      :upstream="upstream"
      :ahead="ahead"
      :behind="behind"
    />
    <WipBanner :repo-id="store.activeRepoId" />

    <div
      class="grid min-h-0 overflow-hidden"
      :class="
        focusMode
          ? 'grid-cols-[0_1fr]'
          : ui.detailVisible.value
            ? 'grid-cols-[1fr_360px]'
            : 'grid-cols-[1fr_0]'
      "
    >
      <!-- 좌측: 커밋 그래프 + Sprint c25-4.5 inline diff vertical split (focusMode 시 숨김) -->
      <div
        v-if="!focusMode"
        class="grid min-h-0 overflow-hidden"
        :class="inlineDiffActive ? 'grid-rows-[1fr_minmax(140px,40%)]' : 'grid-rows-[1fr_0]'"
      >
        <CommitGraph
          :repo-id="store.activeRepoId"
          @select-commit="onSelectCommit"
          @show-diff="onShowDiff"
        />
        <CommitDiffPanel
          v-if="inlineDiffActive"
          :repo-id="store.activeRepoId"
          :sha="selectedSha"
          @close="setInlineDiff(false)"
        />
      </div>
      <div v-else />

      <!-- 우측: 영구 ChangeCountBadge + 탭 (Status / Branches / Stash) + 하단 commit input -->
      <div
        v-if="ui.detailVisible.value || focusMode"
        class="grid grid-rows-[auto_auto_1fr_auto] overflow-hidden border-l border-border"
      >
        <!-- Sprint c25-2 §3 — 항상 표시되는 변경 카운트 (탭 무관) -->
        <ChangeCountBadge
          :repo-id="store.activeRepoId"
          :branch="branch"
          @navigate-status="tab = 'status'"
        />
        <nav
          class="flex border-b border-border bg-card text-xs"
          title="더블클릭 = 좌측 그래프 숨김 / 복원"
          @dblclick="toggleFocusMode"
        >
          <button
            v-for="t in mainTabs"
            :key="t"
            type="button"
            :data-testid="`main-nav-${t}`"
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
                          : t === 'worktree'
                            ? 'WT'
                            : '📄 ' + (selectedSha?.slice(0, 7) ?? '')
            }}
          </button>
          <button
            v-if="focusMode"
            type="button"
            class="px-2 py-1.5 text-amber-500"
            title="Focus mode 해제 (또는 nav 더블클릭)"
            @click="toggleFocusMode"
          >
            ⛶
          </button>
        </nav>

        <div class="overflow-hidden">
          <StatusPanel
            v-if="tab === 'status'"
            :repo-id="store.activeRepoId"
            class="h-full border-l-0"
          />
          <BranchPanel
            v-else-if="tab === 'branches'"
            :repo-id="store.activeRepoId"
            class="h-full border-l-0"
          />
          <StashPanel
            v-else-if="tab === 'stash'"
            :repo-id="store.activeRepoId"
            class="h-full border-l-0"
          />
          <SubmodulePanel
            v-else-if="tab === 'submodule'"
            :repo-id="store.activeRepoId"
            class="h-full border-l-0"
          />
          <LfsPanel
            v-else-if="tab === 'lfs'"
            :repo-id="store.activeRepoId"
            class="h-full border-l-0"
          />
          <ForgePanel v-else-if="tab === 'pr'" :repo-id="store.activeRepoId" class="h-full" />
          <WorktreePanel
            v-else-if="tab === 'worktree'"
            :repo-id="store.activeRepoId"
            class="h-full border-l-0"
          />
          <CommitDetailSidebar
            v-else-if="tab === 'commit' && selectedSha"
            :repo-id="store.activeRepoId"
            :sha="selectedSha"
          />
        </div>

        <CommitMessageInput :repo-id="store.activeRepoId" :ahead="ahead" :behind="behind" />
      </div>
    </div>

    <TerminalPanel
      v-if="terminalOpen"
      :visible="terminalOpen"
      class="row-start-3"
      @close="terminalOpen = false"
    />

    <InteractiveRebaseModal />
    <!-- ARCH-009 fix — v-if mount 게이팅 (Panel 과 일치). useShortcut 메모리 잔존 방지 + 첫 렌더 비용 회피. -->
    <CommitDiffModal
      v-if="diffModalOpen"
      :repo-id="store.activeRepoId"
      :sha="selectedSha"
      :open="diffModalOpen"
      @close="diffModalOpen = false"
    />
  </div>
</template>
