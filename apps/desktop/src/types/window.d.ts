// Window augmentation — Command Palette → 모달/단축키 진입점 bridge.
// 각 모달/패널 컴포넌트가 mount 시 자기 trigger 를 window 에 등록하고,
// CommandPalette / 단축키 핸들러가 window.gitFriedXxx?.() 로 호출.
//
// `as unknown as { gitFriedXxx?: ... }` 패턴 제거 (`docs/plan/15 §3-2`).

export {}

declare global {
  interface Window {
    /** App.vue → SyncTemplateModal trigger. */
    gitFriedOpenSyncTemplate?: (sha?: string) => void
    /** App.vue → BisectModal trigger. */
    gitFriedOpenBisect?: () => void
    /** App.vue → ReflogModal trigger. */
    gitFriedOpenReflog?: () => void
    /** App.vue → CompareModal trigger (Sprint C3 + c38 fix MED-3 mode). */
    gitFriedOpenCompare?: (
      ref1?: string | null,
      ref2?: string | null,
      mode?: 'diff' | 'range',
    ) => void
    /** InteractiveRebaseModal self-register trigger. */
    gitFriedOpenRebase?: () => void
    /** pages/index.vue → TerminalPanel toggle. */
    gitFriedToggleTerminal?: () => void
    /** Sidebar repo filter input focus (⌘⌥F). */
    gitFriedFocusRepoFilter?: () => void
    /** pages/index.vue → CommitDiffModal trigger (Sprint 22-3 V-1 / 22-4 V-6). */
    gitFriedShowDiff?: (sha: string) => void
    /** App.vue → 네이티브 메뉴 'View > Toggle Theme' (Phase 10-6). */
    gitFriedToggleTheme?: () => void
    /** CommandPalette → 네이티브 메뉴 'View > Command Palette' (Phase 10-6). */
    gitFriedOpenCommandPalette?: () => void
    /** Sidebar → 네이티브 메뉴 'File > Reload Repositories' (Phase 10-6). */
    gitFriedReloadRepos?: () => void
    /**
     * Sprint c74 — CommitGraph 에 sha 로 jump + select (사이드바 Mini*List 클릭 진입점).
     * 반환: true = rows 에서 발견 + select + scroll 완료, false = rows 에 없음 (caller 가 fallback 처리).
     */
    gitFriedSelectCommit?: (sha: string) => boolean
    /**
     * Sprint c87 (plan v0.9 Phase 3.1) — Performance API marks devtools API.
     * code-review ARCH-001 — `gitFried*` prefix 정합 (`__gitFriedPerf` outlier 정정).
     * code-review SEC-003 — DEV / VITE_PERF_DEBUG=1 에서만 install (production 미노출).
     */
    gitFriedPerf?: import('@/utils/perfMarks').GitFriedPerfAPI
  }
}
