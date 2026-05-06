// Sprint c31 / god comp 분리 2/N — CommandPalette.vue 의 명령 catalog + 헬퍼를 분리.
//
// 본 composable 은 30+ 명령 정의 (`Cmd[]`) + 카테고리별 toggle/cycle 헬퍼 +
// Category 타입 / CATEGORY_LABELS / CATEGORY_ORDER 를 통합 export.
//
// 컴포넌트는 catalog 호출만 하고 fuzzy filter / keyboard nav / UI rendering 만 담당.
//
// 다른 컴포넌트 (Sidebar / StatusBar 등) 가 명령 일부를 재사용하고 싶으면 본 composable
// 호출 후 `allCommands.value.filter(c => c.id.startsWith('repo.'))` 등으로 사용.
//
// Sprint 22-19 E-8 — design §8-3 Plugin/Integration slot. v0.4 placeholder 명령
// (toast.info 만 표시) 도 본 catalog 에 포함.
import { computed, type ComputedRef } from 'vue'
import { useRouter } from 'vue-router'
import { useReposStore } from '@/stores/repos'
import { useQueryClient } from '@tanstack/vue-query'
import { dispatchShortcut } from '@/composables/useShortcuts'
import { useUiState } from '@/composables/useUiState'
import { useGeneralSettings, useUiSettingsStore } from '@/composables/useUserSettings'
import { useCustomTheme } from '@/composables/useCustomTheme'
import { useToast } from '@/composables/useToast'
import { i18n } from '@/i18n'

const t = i18n.global.t

export type Category =
  | 'repo'
  | 'branch'
  | 'file'
  | 'view'
  | 'stash'
  | 'history'
  | 'ai'
  | 'settings'
  // Sprint 22-19 E-8 — design §8-3 Plugin/Integration slot.
  // 외부 도구 연결 (CI / 이슈 트래커 / 알림). 현재 placeholder 상태 (v0.4+).
  | 'integration'

export interface Cmd {
  id: string
  category: Category
  label: string
  hint?: string
  // Sprint 22-19 — Promise<unknown> 도 허용 (router.push 의 NavigationFailure return 등).
  // void / Promise<void> 가 dominant. 결과는 swallow.
  action: () => void | Promise<unknown>
}

export const CATEGORY_LABELS: Record<Category, string> = {
  repo: 'Repo',
  branch: 'Branch',
  file: 'File / Stage',
  view: 'View / Layout',
  stash: 'Stash',
  history: 'History',
  ai: 'AI',
  settings: 'Settings',
  // Sprint 22-19 E-8 — design §8-3
  integration: 'Integration (외부 도구)',
}

export const CATEGORY_ORDER: Category[] = [
  'repo',
  'branch',
  'file',
  'view',
  'stash',
  'history',
  'ai',
  'settings',
  'integration',
]

// Window 트리거 호출 키 — `src/types/window.d.ts` 의 augmentation 기준 (오타 방지).
type WindowTriggerKey = Extract<keyof Window, `gitFried${string}`>

export interface UseCommandCatalogReturn {
  allCommands: ComputedRef<Cmd[]>
}

export function useCommandCatalog(): UseCommandCatalogReturn {
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
    toast.info(
      t('cmdToast.autoFetchTitle'),
      next === 0 ? t('cmdToast.autoFetchOff') : t('cmdToast.autoFetchEvery', { n: next }),
    )
  }

  const DATE_LOCALE_CYCLE = ['auto', 'ko-KR', 'en-US'] as const
  function cycleDateLocale() {
    const cur = uiSettings.value.dateLocale
    const idx = DATE_LOCALE_CYCLE.findIndex((m) => m === cur)
    const next = DATE_LOCALE_CYCLE[(idx + 1) % DATE_LOCALE_CYCLE.length]
    uiSettings.value = { ...uiSettings.value, dateLocale: next }
    toast.info(
      t('cmdToast.dateFormatTitle'),
      next === 'auto' ? t('cmdToast.dateFormatOsDefault') : next,
    )
  }

  function toggleAvatarStyle() {
    const next = uiSettings.value.avatarStyle === 'initial' ? 'gravatar' : 'initial'
    uiSettings.value = { ...uiSettings.value, avatarStyle: next }
    toast.info(
      t('cmdToast.avatarStyleTitle'),
      next === 'gravatar' ? t('cmdToast.avatarGravatar') : t('cmdToast.avatarInitial'),
    )
  }

  function toggleHideLaunchpad() {
    const next = !uiSettings.value.hideLaunchpad
    uiSettings.value = { ...uiSettings.value, hideLaunchpad: next }
    toast.info(t('cmdToast.launchpadMenuTitle'), next ? t('cmdToast.hidden') : t('cmdToast.shown'))
  }

  function toggleConflictDetection() {
    const next = !general.value.conflictDetection
    general.value = { ...general.value, conflictDetection: next }
    toast.info(
      t('cmdToast.conflictPredictTitle'),
      next ? t('cmdToast.enabled') : t('cmdToast.disabled'),
    )
  }

  function toggleAutoUpdateSubmodules() {
    const next = !general.value.autoUpdateSubmodules
    general.value = { ...general.value, autoUpdateSubmodules: next }
    toast.info(
      t('cmdToast.submoduleAutoUpdateTitle'),
      next ? t('cmdToast.enabled') : t('cmdToast.disabled'),
    )
  }

  function toggleAutoPruneOnFetch() {
    const next = !general.value.autoPruneOnFetch
    general.value = { ...general.value, autoPruneOnFetch: next }
    toast.info(
      t('cmdToast.autoPruneTitle'),
      next ? t('cmdToast.autoPruneOnFetch') : t('cmdToast.disabled'),
    )
  }

  async function copyCustomThemeJson() {
    const json = customTheme.exportJson()
    try {
      await navigator.clipboard.writeText(json)
      toast.success(t('cmdToast.themeJsonTitle'), t('cmdToast.themeJsonCopied'))
    } catch {
      toast.error(t('errors.copyFailed'), t('cmdToast.themeJsonCopyFailedBody'))
    }
  }

  function resetCustomTheme() {
    customTheme.reset()
    toast.success(t('cmdToast.themeResetTitle'), t('cmdToast.themeResetBody'))
  }

  function trigger(action: Parameters<typeof dispatchShortcut>[0]) {
    return () => {
      dispatchShortcut(action)
    }
  }

  function callWindow(key: WindowTriggerKey) {
    return () => {
      const fn = window[key]
      if (typeof fn === 'function') (fn as () => void)()
    }
  }

  const allCommands = computed<Cmd[]>(() => [
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

    // ===== Branch (8) =====
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

    // ===== View / Layout (14) =====
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
        localStorage.setItem('git-fried.theme', root.classList.contains('dark') ? 'dark' : 'light')
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
        uiSettings.value.dateLocale === 'auto' ? 'OS 기본' : uiSettings.value.dateLocale
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

    // ===== History (5) — Sprint c25-4.5 / c26-3, ARCH-008 fix =====
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
    {
      id: 'diff.toggle-inline',
      category: 'history',
      label: 'Inline diff panel 토글',
      hint: '⌘⇧D',
      action: trigger('toggleInlineDiff'),
    },
    {
      id: 'diff.prev-hunk',
      category: 'history',
      label: 'Diff 이전 hunk',
      hint: 'Alt+↑',
      action: trigger('prevHunk'),
    },
    {
      id: 'diff.next-hunk',
      category: 'history',
      label: 'Diff 다음 hunk',
      hint: 'Alt+↓',
      action: trigger('nextHunk'),
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

    // Sprint 22-19 E-8 — Integration placeholder (design §8-3).
    // disabled state: action 은 toast.info ("v0.4 예정") 만. 실 plugin 도입 시 본 항목 채워짐.
    {
      id: 'integration.github-actions',
      category: 'integration',
      label: '🔜 GitHub Actions CI status (v0.4 예정)',
      hint: 'placeholder',
      action: () => {
        toast.info(t('cmdToast.ghActionsTitle'), t('cmdToast.ghActionsBody'))
      },
    },
    {
      id: 'integration.linear-jira',
      category: 'integration',
      label: '🔜 Linear / Jira 이슈 매핑 (v0.5 예정)',
      hint: 'placeholder',
      action: () => {
        toast.info(t('cmdToast.linearJiraTitle'), t('cmdToast.linearJiraBody'))
      },
    },
    {
      id: 'integration.discord-slack',
      category: 'integration',
      label: '🔜 Discord / Slack 알림 (v0.5 예정)',
      hint: 'placeholder',
      action: () => {
        toast.info(t('cmdToast.webhookTitle'), t('cmdToast.webhookBody'))
      },
    },
  ])

  return { allCommands }
}
