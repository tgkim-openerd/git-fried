// Sprint c31 / god comp 분리 2/N — CommandPalette.vue 의 명령 catalog + 헬퍼를 분리.
//
// 본 composable 은 60개 명령 정의 (`Cmd[]`) + 카테고리별 toggle/cycle 헬퍼 +
// Category 타입 / CATEGORY_LABELS / CATEGORY_ORDER 를 통합 export.
//
// 컴포넌트는 catalog 호출만 하고 fuzzy filter / keyboard nav / UI rendering 만 담당.
//
// 다른 컴포넌트 (Sidebar / StatusBar 등) 가 명령 일부를 재사용하고 싶으면 본 composable
// 호출 후 `allCommands.value.filter(c => c.id.startsWith('repo.'))` 등으로 사용.
//
// Sprint 22-19 E-8 — design §8-3 Plugin/Integration slot. v0.4 placeholder 명령
// (toast.info 만 표시) 도 본 catalog 에 포함.
//
// Sprint c47 Wave A-1 — 60개 명령 label/hint 전부 i18n cmd.* 키로 마이그.
// 동적 toggle label (auto-fetch/auto-prune/conflict-detection/submodule/date-locale/
// avatar-style/hide-launchpad) 은 `_disabled`/`_enabled`/`_show`/`_hide`/`_minutes`/
// `_osDefault`/`_initial`/`_gravatar` 공유 키 + `{state}`/`{current}` interpolation.
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

// Category 라벨 — 영문 카테고리는 i18n 불필요 (Repo/Branch/...). integration 만 한국어 포함.
// Sprint c47 Wave A-1: integration 라벨도 i18n 으로 이동 (locale 동적 갱신 위해 getter).
export const CATEGORY_LABELS: Record<Category, string> = new Proxy(
  {
    repo: 'Repo',
    branch: 'Branch',
    file: 'File / Stage',
    view: 'View / Layout',
    stash: 'Stash',
    history: 'History',
    ai: 'AI',
    settings: 'Settings',
    integration: '', // proxy 가 동적 resolve
  } as Record<Category, string>,
  {
    get(target, prop: string) {
      if (prop === 'integration') return t('cmd._categoryIntegration')
      return target[prop as Category]
    },
  },
)

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

// helper — `cmd.<key>` namespace 의 label/hint 추출. dynamic label 은 params 전달.
function lbl(key: string, params?: Record<string, string | number>): string {
  return params ? t(`cmd.${key}.label`, params) : t(`cmd.${key}.label`)
}
function hnt(key: string): string | undefined {
  const path = `cmd.${key}.hint`
  // i18n.global.te 는 missing 시 false — hint 없는 명령 위해 분기.
  // legacy=false 모드는 i18n.global 이 Composer 라 te() 직접 호출 가능.
  return i18n.global.te(path) ? t(path) : undefined
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

  // 동적 toggle label 용 helper — `_disabled`/`_enabled`/`_show`/`_hide` 공유 키 lookup.
  const onOff = (b: boolean) => (b ? t('cmd._enabled') : t('cmd._disabled'))
  const showHide = (b: boolean) => (b ? t('cmd._show') : t('cmd._hide'))

  const allCommands = computed<Cmd[]>(() => [
    // ===== Repo (19) =====
    {
      id: 'repo.switch',
      category: 'repo',
      label: lbl('repoSwitch'),
      hint: hnt('repoSwitch'),
      action: trigger('newTab'),
    },
    {
      id: 'repo.refresh',
      category: 'repo',
      label: lbl('repoRefresh'),
      hint: hnt('repoRefresh'),
      action: () => qc.invalidateQueries(),
    },
    {
      id: 'repo.fetch',
      category: 'repo',
      label: lbl('repoFetch'),
      hint: hnt('repoFetch'),
      action: trigger('fetch'),
    },
    {
      id: 'repo.pull',
      category: 'repo',
      label: lbl('repoPull'),
      hint: hnt('repoPull'),
      action: trigger('pull'),
    },
    {
      id: 'repo.push',
      category: 'repo',
      label: lbl('repoPush'),
      hint: hnt('repoPush'),
      action: trigger('push'),
    },
    {
      id: 'repo.workspace.all',
      category: 'repo',
      label: lbl('repoWorkspaceAll'),
      action: () => store.setActiveWorkspace(null),
    },
    {
      id: 'repo.unselect',
      category: 'repo',
      label: lbl('repoUnselect'),
      action: () => store.setActiveRepo(null),
    },
    {
      id: 'repo.tab.close',
      category: 'repo',
      label: lbl('repoTabClose'),
      hint: hnt('repoTabClose'),
      action: () => {
        if (store.activeRepoId != null) store.closeTab(store.activeRepoId)
      },
    },
    {
      id: 'repo.tab.close-others',
      category: 'repo',
      label: lbl('repoTabCloseOthers'),
      action: () => {
        if (store.activeRepoId != null) store.closeOthers(store.activeRepoId)
      },
    },
    {
      id: 'repo.tab.close-all',
      category: 'repo',
      label: lbl('repoTabCloseAll'),
      action: () => store.closeAll(),
    },
    {
      id: 'repo.tab.next',
      category: 'repo',
      label: lbl('repoTabNext'),
      hint: hnt('repoTabNext'),
      action: store.nextTab,
    },
    {
      id: 'repo.tab.prev',
      category: 'repo',
      label: lbl('repoTabPrev'),
      hint: hnt('repoTabPrev'),
      action: store.prevTab,
    },
    {
      id: 'repo.filter',
      category: 'repo',
      label: lbl('repoFilter'),
      hint: hnt('repoFilter'),
      action: trigger('filterRepos'),
    },
    {
      id: 'repo.go.home',
      category: 'repo',
      label: lbl('repoGoHome'),
      hint: hnt('repoGoHome'),
      action: () => router.push('/'),
    },
    {
      id: 'repo.go.launchpad',
      category: 'repo',
      label: lbl('repoGoLaunchpad'),
      hint: hnt('repoGoLaunchpad'),
      action: () => router.push('/launchpad'),
    },
    {
      id: 'repo.go.settings',
      category: 'repo',
      label: lbl('repoGoSettings'),
      hint: hnt('repoGoSettings'),
      action: () => router.push('/settings'),
    },
    {
      id: 'repo.open-in-explorer',
      category: 'repo',
      label: lbl('repoOpenInExplorer'),
      hint: hnt('repoOpenInExplorer'),
      action: trigger('openInExplorer'),
    },
    {
      id: 'repo.auto-fetch',
      category: 'repo',
      label: lbl('repoAutoFetch', {
        current:
          general.value.autoFetchIntervalMin === 0
            ? t('cmd._disabled')
            : t('cmd._minutes', { n: general.value.autoFetchIntervalMin }),
      }),
      hint: hnt('repoAutoFetch'),
      action: cycleAutoFetch,
    },
    {
      id: 'repo.auto-prune',
      category: 'repo',
      label: lbl('repoAutoPrune', { state: onOff(!general.value.autoPruneOnFetch) }),
      hint: hnt('repoAutoPrune'),
      action: toggleAutoPruneOnFetch,
    },

    // ===== Branch (8) =====
    {
      id: 'branch.tab',
      category: 'branch',
      label: lbl('branchTab'),
      hint: hnt('branchTab'),
      action: trigger('newBranch'),
    },
    {
      id: 'branch.new-pr',
      category: 'branch',
      label: lbl('branchNewPr'),
      hint: hnt('branchNewPr'),
      action: trigger('newPr'),
    },
    {
      id: 'branch.rebase',
      category: 'branch',
      label: lbl('branchRebase'),
      hint: hnt('branchRebase'),
      action: callWindow('gitFriedOpenRebase'),
    },
    {
      id: 'branch.sync.template',
      category: 'branch',
      label: lbl('branchSyncTemplate'),
      hint: hnt('branchSyncTemplate'),
      action: callWindow('gitFriedOpenSyncTemplate'),
    },
    {
      id: 'branch.bisect',
      category: 'branch',
      label: lbl('branchBisect'),
      hint: hnt('branchBisect'),
      action: callWindow('gitFriedOpenBisect'),
    },
    {
      id: 'branch.compare',
      category: 'branch',
      label: lbl('branchCompare'),
      hint: hnt('branchCompare'),
      action: callWindow('gitFriedOpenCompare'),
    },
    {
      id: 'branch.conflict-detection',
      category: 'branch',
      label: lbl('branchConflictDetection', { state: onOff(!general.value.conflictDetection) }),
      hint: hnt('branchConflictDetection'),
      action: toggleConflictDetection,
    },
    {
      id: 'branch.submodule-auto-update',
      category: 'branch',
      label: lbl('branchSubmoduleAutoUpdate', {
        state: onOff(!general.value.autoUpdateSubmodules),
      }),
      hint: hnt('branchSubmoduleAutoUpdate'),
      action: toggleAutoUpdateSubmodules,
    },

    // ===== File / Stage (5) =====
    {
      id: 'file.stage-all',
      category: 'file',
      label: lbl('fileStageAll'),
      hint: hnt('fileStageAll'),
      action: trigger('stageAllExplicit'),
    },
    {
      id: 'file.unstage-all',
      category: 'file',
      label: lbl('fileUnstageAll'),
      hint: hnt('fileUnstageAll'),
      action: trigger('unstageAll'),
    },
    {
      id: 'file.stage-and-commit',
      category: 'file',
      label: lbl('fileStageAndCommit'),
      hint: hnt('fileStageAndCommit'),
      action: trigger('stageAndCommit'),
    },
    {
      id: 'file.commit',
      category: 'file',
      label: lbl('fileCommit'),
      hint: hnt('fileCommit'),
      action: trigger('commit'),
    },
    {
      id: 'file.focus-message',
      category: 'file',
      label: lbl('fileFocusMessage'),
      hint: hnt('fileFocusMessage'),
      action: trigger('focusMessage'),
    },

    // ===== View / Layout (14) =====
    {
      id: 'view.toggle-sidebar',
      category: 'view',
      label: lbl('viewToggleSidebar'),
      hint: hnt('viewToggleSidebar'),
      action: ui.toggleSidebar,
    },
    {
      id: 'view.toggle-detail',
      category: 'view',
      label: lbl('viewToggleDetail'),
      hint: hnt('viewToggleDetail'),
      action: trigger('toggleDetail'),
    },
    {
      id: 'view.terminal',
      category: 'view',
      label: lbl('viewTerminal'),
      hint: hnt('viewTerminal'),
      action: callWindow('gitFriedToggleTerminal'),
    },
    {
      id: 'view.zoom-in',
      category: 'view',
      label: lbl('viewZoomIn'),
      hint: hnt('viewZoomIn'),
      action: ui.zoomIn,
    },
    {
      id: 'view.zoom-out',
      category: 'view',
      label: lbl('viewZoomOut'),
      hint: hnt('viewZoomOut'),
      action: ui.zoomOut,
    },
    {
      id: 'view.zoom-reset',
      category: 'view',
      label: lbl('viewZoomReset'),
      hint: hnt('viewZoomReset'),
      action: ui.zoomReset,
    },
    {
      id: 'view.theme.toggle',
      category: 'view',
      label: lbl('viewThemeToggle'),
      action: () => {
        const root = document.documentElement
        root.classList.toggle('dark')
        localStorage.setItem('git-fried.theme', root.classList.contains('dark') ? 'dark' : 'light')
      },
    },
    {
      id: 'view.show-diff',
      category: 'view',
      label: lbl('viewShowDiff'),
      hint: hnt('viewShowDiff'),
      action: trigger('showDiff'),
    },
    {
      id: 'view.date-locale',
      category: 'view',
      label: lbl('viewDateLocale', {
        current:
          uiSettings.value.dateLocale === 'auto'
            ? t('cmd._osDefault')
            : uiSettings.value.dateLocale,
      }),
      hint: hnt('viewDateLocale'),
      action: cycleDateLocale,
    },
    {
      id: 'view.avatar-style',
      category: 'view',
      label: lbl('viewAvatarStyle', {
        current:
          uiSettings.value.avatarStyle === 'initial' ? t('cmd._initial') : t('cmd._gravatar'),
      }),
      hint: hnt('viewAvatarStyle'),
      action: toggleAvatarStyle,
    },
    {
      id: 'view.hide-launchpad',
      category: 'view',
      label: lbl('viewHideLaunchpad', { state: showHide(uiSettings.value.hideLaunchpad) }),
      hint: hnt('viewHideLaunchpad'),
      action: toggleHideLaunchpad,
    },
    {
      id: 'view.theme.copy-json',
      category: 'view',
      label: lbl('viewThemeCopyJson'),
      hint: hnt('viewThemeCopyJson'),
      action: copyCustomThemeJson,
    },
    {
      id: 'view.theme.reset',
      category: 'view',
      label: lbl('viewThemeReset'),
      hint: hnt('viewThemeReset'),
      action: resetCustomTheme,
    },
    {
      id: 'view.fullscreen',
      category: 'view',
      label: lbl('viewFullscreen'),
      hint: hnt('viewFullscreen'),
      action: trigger('toggleFullscreen'),
    },

    // ===== Stash (1) =====
    {
      id: 'stash.tab',
      category: 'stash',
      label: lbl('stashTab'),
      hint: hnt('stashTab'),
      action: trigger('tab3'),
    },

    // ===== History (5) — Sprint c25-4.5 / c26-3, ARCH-008 fix =====
    {
      id: 'history.file',
      category: 'history',
      label: lbl('historyFile'),
      hint: hnt('historyFile'),
      action: trigger('fileHistorySearch'),
    },
    {
      id: 'history.reflog',
      category: 'history',
      label: lbl('historyReflog'),
      hint: hnt('historyReflog'),
      action: callWindow('gitFriedOpenReflog'),
    },
    {
      id: 'diff.toggle-inline',
      category: 'history',
      label: lbl('diffToggleInline'),
      hint: hnt('diffToggleInline'),
      action: trigger('toggleInlineDiff'),
    },
    {
      id: 'diff.prev-hunk',
      category: 'history',
      label: lbl('diffPrevHunk'),
      hint: hnt('diffPrevHunk'),
      action: trigger('prevHunk'),
    },
    {
      id: 'diff.next-hunk',
      category: 'history',
      label: lbl('diffNextHunk'),
      hint: hnt('diffNextHunk'),
      action: trigger('nextHunk'),
    },

    // ===== AI (1) =====
    {
      id: 'ai.explain-current',
      category: 'ai',
      label: lbl('aiExplainCurrent'),
      hint: hnt('aiExplainCurrent'),
      action: trigger('showDiff'),
    },

    // ===== Settings (4) =====
    {
      id: 'settings.shortcuts',
      category: 'settings',
      label: lbl('settingsShortcuts'),
      hint: hnt('settingsShortcuts'),
      action: trigger('help'),
    },
    {
      id: 'settings.close-modal',
      category: 'settings',
      label: lbl('settingsCloseModal'),
      hint: hnt('settingsCloseModal'),
      action: trigger('closeModal'),
    },
    {
      id: 'settings.profiles',
      category: 'settings',
      label: lbl('settingsProfiles'),
      hint: hnt('settingsProfiles'),
      action: () => router.push('/settings'),
    },
    {
      id: 'settings.forge',
      category: 'settings',
      label: lbl('settingsForge'),
      hint: hnt('settingsForge'),
      action: () => router.push('/settings'),
    },

    // Sprint 22-19 E-8 — Integration placeholder (design §8-3).
    // disabled state: action 은 toast.info ("v0.4 예정") 만. 실 plugin 도입 시 본 항목 채워짐.
    {
      id: 'integration.github-actions',
      category: 'integration',
      label: lbl('integrationGithubActions'),
      hint: hnt('integrationGithubActions'),
      action: () => {
        toast.info(t('cmdToast.ghActionsTitle'), t('cmdToast.ghActionsBody'))
      },
    },
    {
      id: 'integration.linear-jira',
      category: 'integration',
      label: lbl('integrationLinearJira'),
      hint: hnt('integrationLinearJira'),
      action: () => {
        toast.info(t('cmdToast.linearJiraTitle'), t('cmdToast.linearJiraBody'))
      },
    },
    {
      id: 'integration.discord-slack',
      category: 'integration',
      label: lbl('integrationDiscordSlack'),
      hint: hnt('integrationDiscordSlack'),
      action: () => {
        toast.info(t('cmdToast.webhookTitle'), t('cmdToast.webhookBody'))
      },
    },
  ])

  return { allCommands }
}
