<script setup lang="ts">
// Command Palette ⌘P / Ctrl+P (Sprint B6 — `docs/plan/11 §17`).
//
// 카테고리 모델 + 30+ 명령. 모든 신규 액션은 본 palette 등록을 게이트로 한다.
// 검색은 fuzzy + label/category/id/hint 매칭. 그룹 헤더는 검색어 없을 때만 표시.
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useReposStore } from '@/stores/repos'
import { useQueryClient } from '@tanstack/vue-query'
import { dispatchShortcut } from '@/composables/useShortcuts'
import { useUiState } from '@/composables/useUiState'
import {
  useGeneralSettings,
  useUiSettingsStore,
} from '@/composables/useUserSettings'
import { useCustomTheme } from '@/composables/useCustomTheme'
import { useToast } from '@/composables/useToast'

type Category =
  | 'repo'
  | 'branch'
  | 'file'
  | 'view'
  | 'stash'
  | 'history'
  | 'ai'
  | 'settings'

interface Cmd {
  id: string
  category: Category
  label: string
  hint?: string
  action: () => void | Promise<void>
}

const router = useRouter()
const store = useReposStore()
const qc = useQueryClient()
const ui = useUiState()
const general = useGeneralSettings()
const uiSettings = useUiSettingsStore()
const customTheme = useCustomTheme()
const toast = useToast()

const AUTO_FETCH_CYCLE = [0, 1, 5, 15] as const
function cycleAutoFetch() {
  const cur = general.value.autoFetchIntervalMin
  const idx = AUTO_FETCH_CYCLE.findIndex((m) => m === cur)
  const next = AUTO_FETCH_CYCLE[(idx + 1) % AUTO_FETCH_CYCLE.length]
  general.value = { ...general.value, autoFetchIntervalMin: next }
  toast.info('Auto-Fetch', next === 0 ? '비활성화' : `${next}분 마다 fetch`)
}

const DATE_LOCALE_CYCLE = ['auto', 'ko-KR', 'en-US'] as const
function cycleDateLocale() {
  const cur = uiSettings.value.dateLocale
  const idx = DATE_LOCALE_CYCLE.findIndex((m) => m === cur)
  const next = DATE_LOCALE_CYCLE[(idx + 1) % DATE_LOCALE_CYCLE.length]
  uiSettings.value = { ...uiSettings.value, dateLocale: next }
  toast.info('날짜 형식', next === 'auto' ? 'OS 기본' : next)
}

function toggleAvatarStyle() {
  const next = uiSettings.value.avatarStyle === 'initial' ? 'gravatar' : 'initial'
  uiSettings.value = { ...uiSettings.value, avatarStyle: next }
  toast.info('아바타 스타일', next === 'gravatar' ? 'Gravatar (이메일 md5)' : '이니셜')
}

function toggleHideLaunchpad() {
  const next = !uiSettings.value.hideLaunchpad
  uiSettings.value = { ...uiSettings.value, hideLaunchpad: next }
  toast.info('Launchpad 메뉴', next ? '숨김' : '표시')
}

function toggleConflictDetection() {
  const next = !general.value.conflictDetection
  general.value = { ...general.value, conflictDetection: next }
  toast.info('Conflict 예측', next ? '활성' : '비활성')
}

function toggleAutoUpdateSubmodules() {
  const next = !general.value.autoUpdateSubmodules
  general.value = { ...general.value, autoUpdateSubmodules: next }
  toast.info('Submodule 자동 update', next ? '활성' : '비활성')
}

function toggleAutoPruneOnFetch() {
  const next = !general.value.autoPruneOnFetch
  general.value = { ...general.value, autoPruneOnFetch: next }
  toast.info('Auto-Prune', next ? 'Fetch 시 함께' : '비활성')
}

async function copyCustomThemeJson() {
  const json = customTheme.exportJson()
  try {
    await navigator.clipboard.writeText(json)
    toast.success('Custom theme JSON', '클립보드 복사')
  } catch {
    toast.error('복사 실패', '권한 또는 컨텍스트 문제')
  }
}

function resetCustomTheme() {
  customTheme.reset()
  toast.success('Custom theme', '기본 테마로 복원')
}

const open = ref(false)
const filter = ref('')
const selected = ref(0)

function trigger(action: Parameters<typeof dispatchShortcut>[0]) {
  return () => {
    dispatchShortcut(action)
  }
}

// Window 트리거 호출 — `src/types/window.d.ts` 의 augmentation 기준.
// gitFried* 진입점 키만 허용 (오타 방지).
type WindowTriggerKey = Extract<keyof Window, `gitFried${string}`>

function callWindow(key: WindowTriggerKey) {
  return () => {
    const fn = window[key]
    if (typeof fn === 'function') (fn as () => void)()
  }
}

const allCommands = computed<Cmd[]>(() => {
  const list: Cmd[] = [
    // ===== Repo (10) =====
    {
      id: 'repo.switch',
      category: 'repo',
      label: 'Repo: 빠른 전환',
      hint: '⌘⇧P / ⌘T',
      action: trigger('newTab'),
    },
    {
      id: 'repo.refresh',
      category: 'repo',
      label: 'Repo: 모든 쿼리 새로고침',
      hint: 'invalidate everything',
      action: () => qc.invalidateQueries(),
    },
    {
      id: 'repo.fetch',
      category: 'repo',
      label: 'Repo: Fetch (모든 remote)',
      hint: '⌘L',
      action: trigger('fetch'),
    },
    {
      id: 'repo.pull',
      category: 'repo',
      label: 'Repo: Pull',
      hint: '⌘⇧L',
      action: trigger('pull'),
    },
    {
      id: 'repo.push',
      category: 'repo',
      label: 'Repo: Push',
      hint: '⌘⇧K',
      action: trigger('push'),
    },
    {
      id: 'repo.workspace.all',
      category: 'repo',
      label: 'Workspace: 전체',
      action: () => store.setActiveWorkspace(null),
    },
    {
      id: 'repo.unselect',
      category: 'repo',
      label: 'Repo: 선택 해제',
      action: () => store.setActiveRepo(null),
    },
    {
      id: 'repo.tab.close',
      category: 'repo',
      label: '탭: 활성 탭 닫기',
      hint: '⌘⇧W',
      action: () => {
        if (store.activeRepoId != null) store.closeTab(store.activeRepoId)
      },
    },
    {
      id: 'repo.tab.close-others',
      category: 'repo',
      label: '탭: 다른 탭 모두 닫기',
      action: () => {
        if (store.activeRepoId != null) store.closeOthers(store.activeRepoId)
      },
    },
    {
      id: 'repo.tab.close-all',
      category: 'repo',
      label: '탭: 모두 닫기',
      action: () => store.closeAll(),
    },
    {
      id: 'repo.tab.next',
      category: 'repo',
      label: '탭: 다음',
      hint: '⌃Tab',
      action: store.nextTab,
    },
    {
      id: 'repo.tab.prev',
      category: 'repo',
      label: '탭: 이전',
      hint: '⌃⇧Tab',
      action: store.prevTab,
    },
    {
      id: 'repo.filter',
      category: 'repo',
      label: 'Sidebar 레포 필터 focus',
      hint: '⌘⌥F',
      action: trigger('filterRepos'),
    },
    {
      id: 'repo.go.home',
      category: 'repo',
      label: '홈으로',
      hint: 'navigate /',
      action: () => router.push('/'),
    },
    {
      id: 'repo.go.launchpad',
      category: 'repo',
      label: 'Launchpad',
      hint: 'navigate /launchpad',
      action: () => router.push('/launchpad'),
    },
    {
      id: 'repo.go.settings',
      category: 'repo',
      label: '설정',
      hint: 'navigate /settings',
      action: () => router.push('/settings'),
    },
    {
      id: 'repo.open-in-explorer',
      category: 'repo',
      label: '레포 폴더 열기 (OS 파일 매니저)',
      hint: '⌥O',
      action: trigger('openInExplorer'),
    },
    {
      id: 'repo.auto-fetch',
      category: 'repo',
      label: `Auto-Fetch 주기 순환 (현재: ${
        general.value.autoFetchIntervalMin === 0
          ? '비활성'
          : `${general.value.autoFetchIntervalMin}분`
      })`,
      hint: 'off → 1m → 5m → 15m',
      action: cycleAutoFetch,
    },
    {
      id: 'repo.auto-prune',
      category: 'repo',
      label: `Auto-Prune ${general.value.autoPruneOnFetch ? '비활성' : '활성'} (Fetch 시 prune)`,
      hint: 'toggle prune-on-fetch',
      action: toggleAutoPruneOnFetch,
    },

    // ===== Branch (5) =====
    {
      id: 'branch.tab',
      category: 'branch',
      label: 'Branch 탭으로 이동',
      hint: '⌘B',
      action: trigger('newBranch'),
    },
    {
      id: 'branch.new-pr',
      category: 'branch',
      label: 'PR 생성 모달',
      hint: '⌘N',
      action: trigger('newPr'),
    },
    {
      id: 'branch.rebase',
      category: 'branch',
      label: 'Interactive rebase',
      hint: 'drop / reword / squash / fixup',
      action: callWindow('gitFriedOpenRebase'),
    },
    {
      id: 'branch.sync.template',
      category: 'branch',
      label: 'Sync template — 다중 레포 cherry-pick',
      hint: 'bulk cherry-pick',
      action: callWindow('gitFriedOpenSyncTemplate'),
    },
    {
      id: 'branch.bisect',
      category: 'branch',
      label: 'Bisect — 잘못된 commit 찾기',
      hint: 'binary search',
      action: callWindow('gitFriedOpenBisect'),
    },
    {
      id: 'branch.compare',
      category: 'branch',
      label: 'Compare — 두 ref 비교',
      hint: 'ahead/behind + commits + diff',
      action: callWindow('gitFriedOpenCompare'),
    },
    {
      id: 'branch.conflict-detection',
      category: 'branch',
      label: `Conflict 예측 ${general.value.conflictDetection ? '비활성' : '활성'}`,
      hint: 'StatusBar ⚠ toggle',
      action: toggleConflictDetection,
    },
    {
      id: 'branch.submodule-auto-update',
      category: 'branch',
      label: `Submodule 자동 update ${general.value.autoUpdateSubmodules ? '비활성' : '활성'}`,
      hint: 'pull 후 자동 update',
      action: toggleAutoUpdateSubmodules,
    },

    // ===== File / Stage (5) =====
    {
      id: 'file.stage-all',
      category: 'file',
      label: '모두 stage',
      hint: '⌘⇧S',
      action: trigger('stageAllExplicit'),
    },
    {
      id: 'file.unstage-all',
      category: 'file',
      label: '모두 unstage',
      hint: '⌘⇧U',
      action: trigger('unstageAll'),
    },
    {
      id: 'file.stage-and-commit',
      category: 'file',
      label: 'Stage all + Commit',
      hint: '⌘⇧Enter',
      action: trigger('stageAndCommit'),
    },
    {
      id: 'file.commit',
      category: 'file',
      label: 'Commit (현재 메시지)',
      hint: '⌘Enter',
      action: trigger('commit'),
    },
    {
      id: 'file.focus-message',
      category: 'file',
      label: '메시지 입력창 focus',
      hint: '⌘⇧M',
      action: trigger('focusMessage'),
    },

    // ===== View / Layout (8) =====
    {
      id: 'view.toggle-sidebar',
      category: 'view',
      label: '좌측 사이드바 토글',
      hint: '⌘J',
      action: ui.toggleSidebar,
    },
    {
      id: 'view.toggle-detail',
      category: 'view',
      label: '우측 패널 토글',
      hint: '⌘K',
      action: trigger('toggleDetail'),
    },
    {
      id: 'view.terminal',
      category: 'view',
      label: 'Terminal — 통합 터미널 토글',
      hint: '⌘`',
      action: callWindow('gitFriedToggleTerminal'),
    },
    {
      id: 'view.zoom-in',
      category: 'view',
      label: 'Zoom in',
      hint: '⌘=',
      action: ui.zoomIn,
    },
    {
      id: 'view.zoom-out',
      category: 'view',
      label: 'Zoom out',
      hint: '⌘-',
      action: ui.zoomOut,
    },
    {
      id: 'view.zoom-reset',
      category: 'view',
      label: 'Zoom reset (14px)',
      hint: '⌘0',
      action: ui.zoomReset,
    },
    {
      id: 'view.theme.toggle',
      category: 'view',
      label: '다크 / 라이트 모드 토글',
      action: () => {
        const root = document.documentElement
        root.classList.toggle('dark')
        localStorage.setItem(
          'git-fried.theme',
          root.classList.contains('dark') ? 'dark' : 'light',
        )
      },
    },
    {
      id: 'view.show-diff',
      category: 'view',
      label: '선택 commit diff 모달',
      hint: '⌘D',
      action: trigger('showDiff'),
    },
    {
      id: 'view.date-locale',
      category: 'view',
      label: `날짜 형식 순환 (현재: ${
        uiSettings.value.dateLocale === 'auto'
          ? 'OS 기본'
          : uiSettings.value.dateLocale
      })`,
      hint: 'auto → ko-KR → en-US',
      action: cycleDateLocale,
    },
    {
      id: 'view.avatar-style',
      category: 'view',
      label: `아바타 스타일 토글 (현재: ${
        uiSettings.value.avatarStyle === 'initial' ? '이니셜' : 'Gravatar'
      })`,
      hint: 'initial ↔ gravatar',
      action: toggleAvatarStyle,
    },
    {
      id: 'view.hide-launchpad',
      category: 'view',
      label: `Launchpad 메뉴 ${uiSettings.value.hideLaunchpad ? '표시' : '숨김'}`,
      hint: 'hide-launchpad toggle',
      action: toggleHideLaunchpad,
    },
    {
      id: 'view.theme.copy-json',
      category: 'view',
      label: 'Custom theme JSON 복사 (현재 vars)',
      hint: 'clipboard.writeText',
      action: copyCustomThemeJson,
    },
    {
      id: 'view.theme.reset',
      category: 'view',
      label: 'Custom theme 초기화 (기본 테마 복원)',
      hint: 'reset',
      action: resetCustomTheme,
    },
    {
      id: 'view.fullscreen',
      category: 'view',
      label: '전체화면 토글',
      hint: 'F11 / ⌃⌘F',
      action: trigger('toggleFullscreen'),
    },

    // ===== Stash (1) =====
    {
      id: 'stash.tab',
      category: 'stash',
      label: 'Stash 탭으로 이동',
      hint: '⌘3',
      action: trigger('tab3'),
    },

    // ===== History (2) =====
    {
      id: 'history.file',
      category: 'history',
      label: 'File history (현재 파일)',
      hint: '⌘⇧H',
      action: trigger('fileHistorySearch'),
    },
    {
      id: 'history.reflog',
      category: 'history',
      label: 'Reflog (HEAD) — 잃은 commit 복구',
      hint: 'reflog viewer',
      action: callWindow('gitFriedOpenReflog'),
    },

    // ===== AI (1) =====
    {
      id: 'ai.explain-current',
      category: 'ai',
      label: '✨ 현재 commit 설명',
      hint: '⌘D 후 ✨',
      action: trigger('showDiff'),
    },

    // ===== Settings (4) =====
    {
      id: 'settings.shortcuts',
      category: 'settings',
      label: '키보드 단축키 도움말',
      hint: '?',
      action: trigger('help'),
    },
    {
      id: 'settings.close-modal',
      category: 'settings',
      label: '활성 모달 닫기',
      hint: '⌘W',
      action: trigger('closeModal'),
    },
    {
      id: 'settings.profiles',
      category: 'settings',
      label: '프로파일 관리',
      hint: '/settings 의 Profiles',
      action: () => router.push('/settings'),
    },
    {
      id: 'settings.forge',
      category: 'settings',
      label: 'Forge 계정 관리 (PAT)',
      hint: '/settings',
      action: () => router.push('/settings'),
    },
  ]
  return list
})

const CATEGORY_LABELS: Record<Category, string> = {
  repo: 'Repo',
  branch: 'Branch',
  file: 'File / Stage',
  view: 'View / Layout',
  stash: 'Stash',
  history: 'History',
  ai: 'AI',
  settings: 'Settings',
}
const CATEGORY_ORDER: Category[] = [
  'repo',
  'branch',
  'file',
  'view',
  'stash',
  'history',
  'ai',
  'settings',
]

function score(cmd: Cmd, q: string): number {
  if (!q) return 1
  const ql = q.toLowerCase()
  const label = cmd.label.toLowerCase()
  const cat = CATEGORY_LABELS[cmd.category].toLowerCase()
  if (label.startsWith(ql)) return 4
  if (label.includes(ql)) return 3
  if (cmd.id.includes(ql)) return 2
  if (cat.includes(ql)) return 1.5
  if (cmd.hint?.toLowerCase().includes(ql)) return 1
  return 0
}

const filtered = computed(() => {
  const q = filter.value.trim()
  if (!q) return allCommands.value
  return allCommands.value
    .map((c) => ({ c, s: score(c, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c)
})

interface DisplayGroup {
  category: Category
  label: string
  items: Cmd[]
}

const groupedDisplay = computed<DisplayGroup[]>(() => {
  // 검색어 있으면 그룹 헤더 안 보이게 (단일 ranked list).
  if (filter.value.trim()) {
    return [
      {
        category: 'repo',
        label: '',
        items: filtered.value,
      },
    ]
  }
  const map = new Map<Category, Cmd[]>()
  for (const c of filtered.value) {
    if (!map.has(c.category)) map.set(c.category, [])
    map.get(c.category)!.push(c)
  }
  const out: DisplayGroup[] = []
  for (const cat of CATEGORY_ORDER) {
    const items = map.get(cat)
    if (items && items.length) {
      out.push({ category: cat, label: CATEGORY_LABELS[cat], items })
    }
  }
  return out
})

// flat list (selected index keyboard nav 기준).
const flatList = computed<Cmd[]>(() => {
  const out: Cmd[] = []
  for (const g of groupedDisplay.value) out.push(...g.items)
  return out
})

watch(filter, () => (selected.value = 0))
watch(flatList, () => {
  if (selected.value >= flatList.value.length) selected.value = 0
})

function indexInFlat(cmd: Cmd): number {
  return flatList.value.findIndex((x) => x.id === cmd.id)
}

function onKey(e: KeyboardEvent) {
  // ⌘P / Ctrl+P
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p' && !e.shiftKey) {
    e.preventDefault()
    open.value = !open.value
    if (open.value) {
      filter.value = ''
      selected.value = 0
    }
    return
  }
  if (!open.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    open.value = false
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    selected.value = Math.min(flatList.value.length - 1, selected.value + 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selected.value = Math.max(0, selected.value - 1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const c = flatList.value[selected.value]
    if (c) {
      void c.action()
      open.value = false
    }
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-32"
      @click.self="open = false"
    >
      <div class="w-[600px] max-w-[90vw] rounded-lg border border-border bg-card shadow-xl">
        <input
          v-model="filter"
          autofocus
          placeholder="명령 검색... (이름 / 카테고리 / 단축키 — ⌘P 닫기)"
          class="w-full rounded-t-lg border-b border-border bg-transparent px-3 py-2 text-sm outline-none"
        />
        <div class="max-h-[60vh] overflow-auto py-1">
          <template v-for="g in groupedDisplay" :key="g.category">
            <div
              v-if="g.label"
              class="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground"
            >
              {{ g.label }}
            </div>
            <ul>
              <li
                v-for="c in g.items"
                :key="c.id"
                class="cursor-pointer px-3 py-1.5 text-sm"
                :class="indexInFlat(c) === selected ? 'bg-accent text-accent-foreground' : ''"
                @mouseenter="selected = indexInFlat(c)"
                @click="
                  () => {
                    void c.action()
                    open = false
                  }
                "
              >
                <div class="flex items-center justify-between">
                  <span>{{ c.label }}</span>
                  <span class="text-[10px] text-muted-foreground">{{ c.hint || c.id }}</span>
                </div>
              </li>
            </ul>
          </template>
          <p
            v-if="flatList.length === 0"
            class="px-3 py-3 text-center text-xs text-muted-foreground"
          >
            결과 없음
          </p>
        </div>
        <div class="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
          ↑↓ 탐색 · Enter 실행 · Esc 닫기 · 카테고리: Repo / Branch / File / View / Stash / History / AI / Settings
        </div>
      </div>
    </div>
  </Teleport>
</template>
