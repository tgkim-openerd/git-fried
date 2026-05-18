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
  /**
   * Plan #42 H-1 (Sprint c96+) — Conflict prediction 폴링 간격 (분 단위). default 5.
   * 0 = 즉시 폴 (debug only — battery/network 부담). 1~60 권장 범위.
   * Codex 1차 페어 (a360d071bdc15d908) — GitKraken Auto-Fetch 의 사용자값 1 보다
   * 보수적 default.
   */
  conflictDetectionIntervalMin: number
  /**
   * v1.0 #26 (UltraPlan plan/31) — Telemetry opt-in (privacy by default).
   * §9 Q8 권장: 미진행 (default false). 사용자 명시 opt-in 시만 Sentry 류 전송.
   * 본 flag false 시 모든 telemetry 비활성 (registerGlobalErrorHandler 도 IPC
   * tracing 만, 외부 전송 0).
   */
  telemetryOptIn: boolean
}

/** v0.4 #6 (UltraPlan plan/31) — 외부 editor URI scheme launcher 식별자. */
export type ExternalEditorKind =
  | 'none'
  | 'vscode'
  | 'vscode-insiders'
  | 'cursor'
  | 'sublime'
  | 'intellij'
  | 'webstorm'

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
  /**
   * v0.4 #6 (UltraPlan plan/31) — 외부 editor 통합 선택.
   * 'none' = 비활성 / 그 외 = URI scheme 으로 shell.open (OS handler 가 launch).
   */
  externalEditor: ExternalEditorKind
  /**
   * SB-012 (UltraPlan v0.4 sidebar microgap Phase 7-B, 2026-05-18) — Branch row click 동작.
   *
   * - 'checkout' (default, 회귀 차단) — git-fried 기존 1-click 빠른 전환.
   * - 'select' (GitKraken parity S3) — click 은 selection 만, dblclick 으로 checkout.
   *   큰 monorepo + 많은 branch 환경에서 실수 클릭 방지.
   *
   * Codex 권고 default: 'checkout' 유지 (사용자 muscle memory 차단 회피).
   * MiniBranchList / MiniRemoteBranchList 양쪽 적용 (SB-051 remote 대칭).
   */
  branchClickAction: 'checkout' | 'select'
  /**
   * SB-014 (UltraPlan v0.4 sidebar microgap Sprint c95, 2026-05-18) — Smart Branch
   * Visibility (GitKraken parity S3 gear icon). 큰 monorepo 환경에서 자동 필터.
   *
   * - enabled=false (default): no filtering, 모든 branch visible.
   * - enabled=true: HEAD + HEAD 의 upstream + mergeTarget + mergeTarget upstream 만 visible.
   *   사용자 명시 unhide 한 branch 는 보존 (additive layer, useHiddenRefs 와 layering).
   *
   * mergeTarget=null → auto-detect (main / master / develop / trunk 순).
   * Setting UI (Commit Graph header gear) 는 별도 sprint.
   */
  smartBranchVisibility: {
    enabled: boolean
    mergeTarget: string | null
  }
}

const GENERAL_KEY = 'git-fried.general.v1'
const UI_KEY = 'git-fried.ui.v1'

function defaultGeneral(): GeneralSettings {
  return {
    // SB-028 (UltraPlan v0.4 sidebar microgap Phase 9, 2026-05-18) — auto-fetch
    // default 0 → 5분. Codex 권고 (b) — battery/network 절충 (GitKraken 의 1분 보다
    // 보수적, 30 sec 미만 fetch storm 회피). 기존 사용자 저장값 (0 또는 사용자 명시)
    // 은 deep merge 로 보존 — 회귀 차단.
    autoFetchIntervalMin: 5,
    autoPruneOnFetch: false,
    // v1.0 #26 — default false (privacy by default, §9 Q8 권장).
    telemetryOptIn: false,
    defaultBranch: 'main',
    rememberTabs: true,
    autoUpdateSubmodules: false,
    conflictDetection: true,
    conflictDetectionIntervalMin: 5,
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
    externalEditor: 'none',
    // SB-012 — default 'checkout' (회귀 차단). 'select' 토글은 Settings UI 별도 sprint.
    branchClickAction: 'checkout',
    // SB-014 — default disabled (회귀 차단). Settings UI / Commit Graph gear 별도 sprint.
    smartBranchVisibility: {
      enabled: false,
      mergeTarget: null,
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

/**
 * SB-050 (UltraPlan v0.4 sidebar microgap Phase 7-A, 2026-05-18) — Codex audit
 * (`afa27e8d62219ed53`) 발견 micro-gap: 기존 `{ ...defaultX(), ...obj }` 얕은 병합은
 * nested 객체 (예: `miniSidebarSections: { branch, remote, ... }`) 의 일부 키만 저장된
 * 경우 default 의 나머지 키를 날린다.
 *
 * 예: localStorage 에 `{"miniSidebarSections":{"tag":false}}` 만 있으면 shallow merge
 * 결과는 `{ tag:false }` 만 남고 `branch/remote/worktree/stash/submodule/pr` 모두 undefined.
 *
 * Deep merge — 1 레벨 nested 객체만 cover (현재 GeneralSettings / UiSettings 의 nested
 * 깊이는 1 레벨 — `miniSidebarSections` 만). 2+ 레벨은 본 구현 scope 외.
 *
 * SB-012 의 `uiSettings.branchClickAction` 추가 전에 본 작업 선행 — Codex 권고 정합.
 */
function deepMergeSettings<T extends object>(defaults: T, stored: Partial<T>): T {
  const out = { ...defaults } as Record<string, unknown>
  const defRec = defaults as Record<string, unknown>
  for (const key of Object.keys(stored)) {
    const storedVal = (stored as Record<string, unknown>)[key]
    const defVal = defRec[key]
    if (
      defVal != null &&
      typeof defVal === 'object' &&
      !Array.isArray(defVal) &&
      storedVal != null &&
      typeof storedVal === 'object' &&
      !Array.isArray(storedVal)
    ) {
      // 1 레벨 nested merge — default 의 모든 키 보존 + stored 의 키로 override.
      out[key] = {
        ...(defVal as Record<string, unknown>),
        ...(storedVal as Record<string, unknown>),
      }
    } else if (storedVal !== undefined) {
      out[key] = storedVal
    }
  }
  return out as T
}

function loadGeneral(): GeneralSettings {
  if (typeof localStorage === 'undefined') return defaultGeneral()
  try {
    const raw = localStorage.getItem(GENERAL_KEY)
    if (!raw) return defaultGeneral()
    const obj = JSON.parse(raw) as Partial<GeneralSettings>
    // SB-050 — shallow → deep merge (nested 객체 default 키 보존).
    return deepMergeSettings<GeneralSettings>(defaultGeneral(), obj)
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
    // SB-050 — shallow → deep merge (miniSidebarSections 7 키 default 보존).
    return deepMergeSettings<UiSettings>(defaultUi(), obj)
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
