/**
 * Sprint c75-B — App.vue 의 window.gitFried* 등록 8건 묶음. type 안전성은
 * `src/types/window.d.ts` 의 augmentation 으로 보장. lifecycle 은 onMounted/onUnmounted
 * 자동 register/dispose.
 *
 * 등록 대상:
 *   gitFriedOpenSyncTemplate / gitFriedOpenBisect / gitFriedOpenReflog /
 *   gitFriedOpenCompare / gitFriedToggleTheme
 *
 * 외부 등록 (CommandPalette 자체 register, Sidebar / InteractiveRebaseModal 자체) 은 여기서
 * 관리 안 함 — 각자 컴포넌트가 register/dispose.
 */
import { onMounted, onUnmounted } from 'vue'

export function useAppWindowHooks(opts: {
  openSyncTemplate: (sha?: string) => void
  openBisect: () => void
  openReflog: () => void
  openCompare: (ref1?: string | null, ref2?: string | null, mode?: 'diff' | 'range') => void
  toggleTheme: () => void
}) {
  onMounted(() => {
    window.gitFriedOpenSyncTemplate = opts.openSyncTemplate
    window.gitFriedOpenBisect = opts.openBisect
    window.gitFriedOpenReflog = opts.openReflog
    window.gitFriedOpenCompare = opts.openCompare
    window.gitFriedToggleTheme = opts.toggleTheme
  })
  onUnmounted(() => {
    delete window.gitFriedOpenSyncTemplate
    delete window.gitFriedOpenBisect
    delete window.gitFriedOpenReflog
    delete window.gitFriedOpenCompare
    delete window.gitFriedToggleTheme
  })
}
