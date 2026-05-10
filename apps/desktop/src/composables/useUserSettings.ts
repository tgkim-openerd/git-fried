// 사용자 환경 설정 — General / UI Customization (Sprint D1).
//
// settings.vue 가 작성/편집, 다른 컴포넌트가 읽기. localStorage 영속 + 글로벌 reactive ref.
//
// 키:
//   - git-fried.general.v1: { autoFetchIntervalMin, autoPruneOnFetch, defaultBranch, rememberTabs, autoUpdateSubmodules, conflictDetection }
//   - git-fried.ui.v1: { dateLocale, hideLaunchpad, avatarStyle }

import { ref, watch } from 'vue'

export interface GeneralSettings {
  /** 0 = 비활성. 분 단위. */
  autoFetchIntervalMin: number
  autoPruneOnFetch: boolean
  defaultBranch: string
  rememberTabs: boolean
  /** Sprint D5: pull 후 submodule 자동 update. */
  autoUpdateSubmodules: boolean
  /** Sprint D4: 백그라운드 Conflict prediction (StatusBar) 활성. */
  conflictDetection: boolean
}

export interface UiSettings {
  dateLocale: 'auto' | 'ko-KR' | 'en-US'
  hideLaunchpad: boolean
  avatarStyle: 'initial' | 'gravatar'
  /** plan/30 P3-3 — commit time format: absolute / relative / both. */
  commitTimeFormat: 'absolute' | 'relative' | 'both'
  /** plan/30 P1-5 — Mini sidebar 섹션 visibility (사용자가 빈도 낮은 섹션 숨김). */
  miniSidebarSections: {
    branch: boolean
    remote: boolean
    worktree: boolean
    stash: boolean
    submodule: boolean
    pr: boolean
    tag: boolean
  }
}

const GENERAL_KEY = 'git-fried.general.v1'
const UI_KEY = 'git-fried.ui.v1'

function defaultGeneral(): GeneralSettings {
  return {
    autoFetchIntervalMin: 0,
    autoPruneOnFetch: false,
    defaultBranch: 'main',
    rememberTabs: true,
    autoUpdateSubmodules: false,
    conflictDetection: true,
  }
}

function defaultUi(): UiSettings {
  return {
    dateLocale: 'auto',
    hideLaunchpad: false,
    avatarStyle: 'initial',
    commitTimeFormat: 'absolute',
    miniSidebarSections: {
      branch: true,
      remote: true,
      worktree: true,
      stash: true,
      submodule: true,
      pr: true,
      tag: true,
    },
  }
}

/**
 * plan/30 P3-3 — relative time formatter.
 * 60s / 60m / 24h / 7d / 30d / year boundaries.
 * c58 보정 — i18n 적용 (ko/en). i18n 키 fallback 으로 ko default.
 */
export function formatRelativeTime(
  unix: number,
  t?: (key: string, params?: object) => string,
): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - unix
  // i18n 미주입 시 ko fallback (utility 호출 컨텍스트에서 useI18n 호출 어려움 대응).
  const tr =
    t ??
    ((key: string, params?: { n: number }) => {
      const n = params?.n ?? 0
      if (key === 'time.justNow') return '방금'
      if (key === 'time.minAgo') return `${n}분 전`
      if (key === 'time.hourAgo') return `${n}시간 전`
      if (key === 'time.dayAgo') return `${n}일 전`
      if (key === 'time.weekAgo') return `${n}주 전`
      if (key === 'time.monthAgo') return `${n}개월 전`
      if (key === 'time.yearAgo') return `${n}년 전`
      return ''
    })
  if (diff < 60) return tr('time.justNow')
  if (diff < 3600) return tr('time.minAgo', { n: Math.floor(diff / 60) })
  if (diff < 86400) return tr('time.hourAgo', { n: Math.floor(diff / 3600) })
  if (diff < 604800) return tr('time.dayAgo', { n: Math.floor(diff / 86400) })
  if (diff < 2592000) return tr('time.weekAgo', { n: Math.floor(diff / 604800) })
  if (diff < 31536000) return tr('time.monthAgo', { n: Math.floor(diff / 2592000) })
  return tr('time.yearAgo', { n: Math.floor(diff / 31536000) })
}

function loadGeneral(): GeneralSettings {
  if (typeof localStorage === 'undefined') return defaultGeneral()
  try {
    const raw = localStorage.getItem(GENERAL_KEY)
    if (!raw) return defaultGeneral()
    const obj = JSON.parse(raw) as Partial<GeneralSettings>
    return { ...defaultGeneral(), ...obj }
  } catch {
    return defaultGeneral()
  }
}

function loadUi(): UiSettings {
  if (typeof localStorage === 'undefined') return defaultUi()
  try {
    const raw = localStorage.getItem(UI_KEY)
    if (!raw) return defaultUi()
    const obj = JSON.parse(raw) as Partial<UiSettings>
    return { ...defaultUi(), ...obj }
  } catch {
    return defaultUi()
  }
}

const general = ref<GeneralSettings>(loadGeneral())
const ui = ref<UiSettings>(loadUi())

watch(
  general,
  (v) => {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(GENERAL_KEY, JSON.stringify(v))
    } catch {
      /* ignore */
    }
  },
  { deep: true },
)

watch(
  ui,
  (v) => {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(UI_KEY, JSON.stringify(v))
    } catch {
      /* ignore */
    }
  },
  { deep: true },
)

export function useGeneralSettings() {
  return general
}

export function useUiSettingsStore() {
  return ui
}

/**
 * Date locale 헬퍼 — settings 의 dateLocale 따른 toLocaleString.
 * `auto` 는 OS 기본 (`undefined` locale).
 */
export function formatDateLocalized(unix: number, options?: Intl.DateTimeFormatOptions): string {
  const d = new Date(unix * 1000)
  const loc = ui.value.dateLocale
  const localeArg = loc === 'auto' ? undefined : loc
  return d.toLocaleString(
    localeArg,
    options ?? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' },
  )
}
