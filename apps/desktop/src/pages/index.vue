<script setup lang="ts">
// 메인 페이지 — GitKrakenToolbar + 좌측(로그/그래프) + 우측 탭 패널 + 하단(commit input + 통합 터미널).
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useReposStore } from '@/stores/repos'
import { useStatus } from '@/composables/useStatus'
import { useGraph } from '@/composables/useGraph'
import CommitGraph from '@/components/CommitGraph.vue'
// Sprint c30 / GitKraken UX (Phase 8a) — WIP pseudo-row 는 CommitGraph 에 직접 통합 (별도 mount 제거).
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
// Sprint c30 / GitKraken UX (Phase 3) — 파일 더블클릭 fullscreen.
import FullscreenDiffView from '@/components/FullscreenDiffView.vue'
import { useFullscreenDiff } from '@/composables/useFullscreenDiff'
// Phase 13-1 — WipBanner 제거 (GitKraken parity / vertical 공간 절약).
//   useWipNote 은 StashPanel 의 new stash message prefill 에서 계속 사용 (clearWipNote 도 stash push 후 자동).
//   WIP note 자체 입력은 stash 모드 진입 시 noteworthy.
import { useShortcut } from '@/composables/useShortcuts'
import { useUiState } from '@/composables/useUiState'
import { useTabPerProfile } from '@/composables/useTabPerProfile'

const store = useReposStore()
const { data: status } = useStatus(() => store.activeRepoId)

const branch = computed(() => status.value?.branch ?? null)
const upstream = computed(() => status.value?.upstream ?? null)
const ahead = computed(() => status.value?.ahead ?? 0)
const behind = computed(() => status.value?.behind ?? 0)

// Sprint c30 / GitKraken UX (Phase 5) — main 영역 view 분리.
//   기존 우측 8 tabs (status/branches/.../commit) → 가운데 7 mainViews + 우측 sidebar 단순화.
//   - mainView: 가운데 영역에서 보여줄 panel ('graph' default, branches/stash/pr/worktree/...)
//   - 우측 sidebar: selectedSha 분기 (WIP staging / commit detail / placeholder) — tab 제거
//   - 'status' / 'commit' 은 mainView 에서 제거 (우측 sidebar 가 자동 mapping)
type MainView = 'graph' | 'branches' | 'stash' | 'submodule' | 'lfs' | 'pr' | 'worktree'
const mainView = ref<MainView>('graph')

// Sprint B10 — per-profile 탭 영속화.
useTabPerProfile<MainView>(mainView, 'graph')

// 통합 터미널 가시성 (⌘` 토글) — `docs/plan/10 옵션 A`.
const terminalOpen = ref(false)

// Sprint c30 / GitKraken UX (Phase 5) — ⌘1~⌘7 mainView 단축키.
//   ⌘1 = graph (기존 status 의 working dir 보기는 우측 staging 으로 자동 노출)
//   ⌘2 = branches, ⌘3 = stash, ⌘4 = submodule, ⌘5 = lfs, ⌘6 = pr, ⌘7 = worktree
useShortcut('tab1', () => (mainView.value = 'graph'))
useShortcut('tab2', () => (mainView.value = 'branches'))
useShortcut('tab3', () => (mainView.value = 'stash'))
useShortcut('tab4', () => (mainView.value = 'submodule'))
useShortcut('tab5', () => (mainView.value = 'lfs'))
useShortcut('tab6', () => (mainView.value = 'pr'))
useShortcut('tab7', () => (mainView.value = 'worktree'))

// ⌘B → 브랜치 view
useShortcut('newBranch', () => (mainView.value = 'branches'))
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
// Sprint c30 / GitKraken UX (Phase 2a) — '__WIP__' sentinel = working tree pseudo-row.
//   selectedSha === WIP_SHA 이면 graph 의 WipRow 가 활성 + 우측 staging (status tab).
const WIP_SHA = '__WIP__'
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
// Sprint c30 / GitKraken UX (Phase 5) — commit row click.
//   selectedSha 만 변경 — 우측 sidebar 가 자동 commit detail 로 분기.
//   tab 자동 변경 안 함 — 사용자가 'pr' / 'branches' 보고 있을 때 graph 로 강제 전환 안 함.
function onSelectCommit(sha: string) {
  userChoseSha.value = true
  if (selectedSha.value === sha) {
    selectedSha.value = null
    return
  }
  selectedSha.value = sha
}

// Sprint c30 / GitKraken UX (Phase 5) — WipRow click 핸들러.
//   selectedSha=WIP_SHA → 우측 sidebar = staging UI (StatusPanel + CommitMessageInput).
//   mainView 변경 안 함 (graph 보고 있으면 graph 유지, 다른 panel 이면 그것 유지).
function onSelectWip() {
  userChoseSha.value = true
  if (selectedSha.value === WIP_SHA) {
    selectedSha.value = null
    return
  }
  selectedSha.value = WIP_SHA
}

// Sprint c30 / GitKraken UX (Phase 8a) — WIP pseudo-row 는 CommitGraph 에 통합.
//   wipChangeCount / showWipRow state 도 CommitGraph 내부에서 useStatus 로 계산.

// Sprint c30 / GitKraken UX (Phase 3) — fullscreen diff 활성 시 좌측 graph 숨김.
const fsDiff = useFullscreenDiff()
const fullscreenActive = computed(() => fsDiff.current.value != null)

// Sprint c30 / GitKraken UX (Phase 5) — main view 7개 (status/commit 제거).
const MAIN_VIEWS: MainView[] = ['graph', 'branches', 'stash', 'submodule', 'lfs', 'pr', 'worktree']
function mainViewLabel(v: MainView): string {
  switch (v) {
    case 'graph':
      return '그래프'
    case 'branches':
      return '브랜치'
    case 'stash':
      return 'Stash'
    case 'submodule':
      return 'Sub'
    case 'lfs':
      return 'LFS'
    case 'pr':
      return 'PR'
    case 'worktree':
      return 'WT'
  }
}

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

// Sprint c30 / GitKraken UX (Phase 1 + 2a) — auto-default selectedSha.
//   GitKraken UX 우선순위:
//     working dir dirty 면 WIP_SHA → 우측 staging UI 즉시
//     clean 이면 graph latest commit → 우측 commit detail 즉시
//   user 가 명시 선택 (row click / ESC) 했으면 auto 재적용 안 함.
//   status / graph 둘 다 도착 후 결정 — race condition 회피.
const { data: graphData } = useGraph(() => store.activeRepoId, 500)
watch(
  [status, graphData],
  ([s, g]) => {
    if (userChoseSha.value || selectedSha.value != null) return
    if (!s || !g) return
    if (!s.isClean) {
      selectedSha.value = WIP_SHA
    } else if (g.rows.length > 0) {
      selectedSha.value = g.rows[0].commit.sha
    }
  },
  { immediate: true },
)
function onShowDiff(sha: string) {
  if (sha === WIP_SHA) return // sentinel — commit diff modal 대상 아님
  selectedSha.value = sha
  diffModalOpen.value = true
}
useShortcut('showDiff', () => {
  // Sprint c30 — WIP_SHA 는 commit diff 대상 아님 (working dir 은 status panel 에서 보기).
  if (selectedSha.value && selectedSha.value !== WIP_SHA) diffModalOpen.value = true
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
// Sprint c30 — WIP_SHA 는 inline diff 대상 아님 (sentinel). status panel 에서 working dir 변경 보기.
const inlineDiffActive = computed(
  () => inlineDiffVisible.value && selectedSha.value != null && selectedSha.value !== WIP_SHA,
)

// Phase 14-1 — inline diff "maximize" (graph 완전 hide, diff fullscreen 가까움).
// localStorage 'git-fried.inline-diff.maximized' 영속.
const INLINE_DIFF_MAX_KEY = 'git-fried.inline-diff.maximized'
function loadInlineDiffMax(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(INLINE_DIFF_MAX_KEY) === '1'
}
const inlineDiffMaximized = ref(loadInlineDiffMax())
function toggleInlineDiffMaximize() {
  inlineDiffMaximized.value = !inlineDiffMaximized.value
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(INLINE_DIFF_MAX_KEY, inlineDiffMaximized.value ? '1' : '0')
  }
}

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
  <!-- Phase 13-1 (WipBanner 제거) — grid-rows: toolbar / main / terminal? -->
  <div
    class="grid h-full overflow-hidden"
    :class="
      terminalOpen ? 'grid-rows-[auto_minmax(0,1fr)_minmax(140px,30%)]' : 'grid-rows-[auto_1fr]'
    "
  >
    <GitKrakenToolbar
      :repo-id="store.activeRepoId"
      :branch="branch"
      :upstream="upstream"
      :ahead="ahead"
      :behind="behind"
    />

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
      <!-- Sprint c30 / GitKraken UX (Phase 5) — 가운데 영역: main view nav + active panel
           focusMode 시 우측 숨김 + 가운데 풀화면. -->
      <FullscreenDiffView v-if="!focusMode && fullscreenActive" :repo-id="store.activeRepoId" />
      <div v-else-if="!focusMode" class="grid min-h-0 grid-rows-[auto_1fr] overflow-hidden">
        <!-- main nav (가운데 영역 위, 'graph' default) -->
        <nav
          class="flex border-b border-border bg-card text-xs"
          title="더블클릭 = 우측 sidebar 숨김 / 복원"
          @dblclick="toggleFocusMode"
        >
          <button
            v-for="v in MAIN_VIEWS"
            :key="v"
            type="button"
            :data-testid="`main-nav-${v}`"
            class="flex-1 px-1.5 py-1.5 capitalize"
            :class="
              mainView === v
                ? 'bg-accent text-accent-foreground font-semibold'
                : 'text-muted-foreground hover:bg-accent/40'
            "
            @click="mainView = v"
          >
            {{ mainViewLabel(v) }}
          </button>
        </nav>

        <!-- mainView 별 panel -->
        <div class="overflow-hidden">
          <!-- Sprint c30 / GitKraken UX (Phase 8a) — graph view: CommitGraph 가 WIP row 직접 통합.
               (별도 WipRow mount 제거 — CommitGraph 의 virtualizer idx=0 + dirty 시 WIP row.) -->
          <!-- Phase 14-1 (GitKraken parity 강화) — 커밋 선택 시 diff 가 dominant content.
               inactive: graph 100% / active: graph 100px (thin context) + diff fills rest /
               maximized: graph 0 (완전 hidden) + diff full-area (GitKraken Diff View 동등). -->
          <div
            v-if="mainView === 'graph'"
            class="grid h-full min-h-0 overflow-hidden"
            :class="
              inlineDiffActive
                ? inlineDiffMaximized
                  ? 'grid-rows-[0px_minmax(0,1fr)]'
                  : 'grid-rows-[100px_minmax(0,1fr)]'
                : 'grid-rows-[1fr_0]'
            "
          >
            <CommitGraph
              :repo-id="store.activeRepoId"
              :selected-wip="selectedSha === WIP_SHA"
              @select-commit="onSelectCommit"
              @select-wip="onSelectWip"
              @show-diff="onShowDiff"
            />
            <CommitDiffPanel
              v-if="inlineDiffActive"
              :repo-id="store.activeRepoId"
              :sha="selectedSha"
              :maximized="inlineDiffMaximized"
              @close="setInlineDiff(false)"
              @toggle-maximize="toggleInlineDiffMaximize"
            />
          </div>
          <BranchPanel
            v-else-if="mainView === 'branches'"
            :repo-id="store.activeRepoId"
            class="h-full"
          />
          <StashPanel
            v-else-if="mainView === 'stash'"
            :repo-id="store.activeRepoId"
            class="h-full"
          />
          <SubmodulePanel
            v-else-if="mainView === 'submodule'"
            :repo-id="store.activeRepoId"
            class="h-full"
          />
          <LfsPanel v-else-if="mainView === 'lfs'" :repo-id="store.activeRepoId" class="h-full" />
          <ForgePanel v-else-if="mainView === 'pr'" :repo-id="store.activeRepoId" class="h-full" />
          <WorktreePanel
            v-else-if="mainView === 'worktree'"
            :repo-id="store.activeRepoId"
            class="h-full"
          />
        </div>
      </div>
      <div v-else />

      <!-- Sprint c30 / GitKraken UX (Phase 5) — 우측 sidebar = commit metadata only.
           selectedSha 분기: WIP staging / commit detail / placeholder.
           main view 와 무관 — 어떤 panel 이든 우측은 commit context 유지. -->
      <div
        v-if="ui.detailVisible.value || focusMode"
        class="grid grid-rows-[auto_1fr_auto] overflow-hidden border-l border-border"
      >
        <ChangeCountBadge
          :repo-id="store.activeRepoId"
          :branch="branch"
          @navigate-status="onSelectWip"
        />

        <div class="overflow-hidden">
          <!-- WIP staging — Working dir dirty + WIP_SHA 선택 -->
          <StatusPanel
            v-if="selectedSha === WIP_SHA"
            :repo-id="store.activeRepoId"
            class="h-full border-l-0"
          />
          <!-- commit detail — 실제 sha 선택 -->
          <CommitDetailSidebar
            v-else-if="selectedSha && selectedSha !== WIP_SHA"
            :repo-id="store.activeRepoId"
            :sha="selectedSha"
          />
          <!-- placeholder — selectedSha=null (clean repo + auto-default 미적용 시) -->
          <div
            v-else
            class="flex h-full items-center justify-center p-6 text-center text-xs text-muted-foreground"
          >
            <div>
              <div class="mb-1 text-2xl">⊙</div>
              <div>그래프에서 commit 또는 WIP 행을 선택하세요.</div>
            </div>
          </div>
        </div>

        <!-- Sprint c30 / GitKraken UX (Phase 2c + 5) — commit form 은 WIP staging 시에만. -->
        <CommitMessageInput
          v-if="selectedSha === WIP_SHA"
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
    <!-- ARCH-009 fix — v-if mount 게이팅 (Panel 과 일치). useShortcut 메모리 잔존 방지 + 첫 렌더 비용 회피. -->
    <CommitDiffModal
      v-if="diffModalOpen && selectedSha && selectedSha !== WIP_SHA"
      :repo-id="store.activeRepoId"
      :sha="selectedSha"
      :open="diffModalOpen"
      @close="diffModalOpen = false"
    />
  </div>
</template>
