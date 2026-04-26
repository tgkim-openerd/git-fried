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
  }
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
export function formatDateLocalized(
  unix: number,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = new Date(unix * 1000)
  const loc = ui.value.dateLocale
  const localeArg = loc === 'auto' ? undefined : loc
  return d.toLocaleString(
    localeArg,
    options ?? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' },
  )
}
