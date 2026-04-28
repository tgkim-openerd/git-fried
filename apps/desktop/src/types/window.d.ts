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
    /** App.vue → CompareModal trigger (Sprint C3). */
    gitFriedOpenCompare?: (ref1?: string | null, ref2?: string | null) => void
    /** InteractiveRebaseModal self-register trigger. */
    gitFriedOpenRebase?: () => void
    /** pages/index.vue → TerminalPanel toggle. */
    gitFriedToggleTerminal?: () => void
    /** Sidebar repo filter input focus (⌘⌥F). */
    gitFriedFocusRepoFilter?: () => void
    /** pages/index.vue → CommitDiffModal trigger (Sprint 22-3 V-1 / 22-4 V-6). */
    gitFriedShowDiff?: (sha: string) => void
  }
}
