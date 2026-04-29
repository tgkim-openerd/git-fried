// 네이티브 메뉴 클릭 → frontend 액션 라우팅 (Phase 10-6).
//
// Rust 측 `menu::handle_event` 가 `menu://<id>` 이벤트를 emit 하면
// 본 composable 이 받아 기존 단축키 / 라우팅 / 모달 트리거를 호출한다.
//
// 메뉴 ID ↔ frontend 액션 매핑 (단일 진실 원천):
//
//   File:
//     open-settings    → router.push('/settings')
//     reload-repos     → window.gitFriedReloadRepos? (없으면 토스트 안내)
//
//   Edit:
//     undo-action      → dispatchShortcut('fetch') 가 아님 — toolbar onUndo 가 confirm 포함이라 별도 hook
//     redo-action      → 동일 — frontend 가 자체 핸들러를 useEvent('menu://redo-action') 로 등록 가능하게 펌프
//     filter-repos     → dispatchShortcut('filterRepos')
//
//   View:
//     command-palette  → window.gitFriedOpenCommandPalette? (CommandPalette 제공)
//     toggle-sidebar   → dispatchShortcut('toggleSidebar')
//     toggle-detail    → dispatchShortcut('toggleDetail')
//     toggle-terminal  → dispatchShortcut('terminal')
//     toggle-theme     → window.gitFriedToggleTheme? (App.vue 가 노출)
//
//   Help:
//     show-shortcuts   → dispatchShortcut('help')
//     open-github      → openUrl('https://github.com/tgkim-openerd/git-fried')
//
// (toggle-fullscreen / reload-window / toggle-devtools 는 Rust 단계에서 처리됨.)

import { onMounted, onUnmounted } from 'vue'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { open as openShell } from '@tauri-apps/plugin-shell'
import { useRouter } from 'vue-router'
import { dispatchShortcut } from './useShortcuts'
import { useToast } from './useToast'

const GITHUB_URL = 'https://github.com/tgkim-openerd/git-fried'

interface MenuPump {
  /** Rust 메뉴 클릭 시 frontend 가 추가 핸들러를 등록할 수 있게 hook 제공 */
  onAction: (id: string, handler: () => void) => void
}

const handlers = new Map<string, Set<() => void>>()

/** Toolbar 등에서 menu 액션 (e.g. undo-action) 직접 처리 시 등록. */
export function onMenuAction(id: string, handler: () => void): () => void {
  let set = handlers.get(id)
  if (!set) {
    set = new Set()
    handlers.set(id, set)
  }
  set.add(handler)
  return () => {
    handlers.get(id)?.delete(handler)
  }
}

function fireRegistered(id: string): boolean {
  const set = handlers.get(id)
  if (!set || set.size === 0) return false
  for (const fn of set) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
  return true
}

/** App.vue 한 곳에서 마운트 — Rust → frontend 라우팅 단일 진입점. */
export function useMenuListener(): MenuPump {
  const router = useRouter()
  const toast = useToast()
  let unlistens: UnlistenFn[] = []

  // 모든 메뉴 ID 별 listener 등록.
  const ids = [
    'open-settings',
    'reload-repos',
    'undo-action',
    'redo-action',
    'filter-repos',
    'command-palette',
    'toggle-sidebar',
    'toggle-detail',
    'toggle-terminal',
    'toggle-theme',
    'show-shortcuts',
    'open-github',
    // Repository
    'repo-fetch',
    'repo-pull',
    'repo-push',
    'repo-branch',
    'repo-stash-view',
    // History (모달 — window 트리거 재사용)
    'open-reflog',
    'open-bisect',
    'open-compare',
    'commit-search',
  ] as const

  async function attach() {
    const promises = ids.map(async (id) => {
      const event = `menu://${id}`
      return listen(event, () => routeAction(id))
    })
    unlistens = await Promise.all(promises)
  }

  function routeAction(id: string): void {
    // toolbar 등이 등록한 핸들러 우선 (undo/redo 같은 confirm flow).
    if (fireRegistered(id)) return

    switch (id) {
      case 'open-settings':
        void router.push('/settings')
        return
      case 'reload-repos': {
        const fn = (window as unknown as { gitFriedReloadRepos?: () => void }).gitFriedReloadRepos
        if (fn) fn()
        else toast.info('레포 reload', '활성 워크스페이스에서 자동 갱신')
        return
      }
      case 'filter-repos':
        dispatchShortcut('filterRepos')
        return
      case 'command-palette': {
        const fn = (window as unknown as { gitFriedOpenCommandPalette?: () => void })
          .gitFriedOpenCommandPalette
        if (fn) fn()
        else toast.warning('Command Palette 미준비', '재시작 후 다시 시도')
        return
      }
      case 'toggle-sidebar':
        dispatchShortcut('toggleSidebar')
        return
      case 'toggle-detail':
        dispatchShortcut('toggleDetail')
        return
      case 'toggle-terminal':
        dispatchShortcut('terminal')
        return
      case 'toggle-theme': {
        const fn = (window as unknown as { gitFriedToggleTheme?: () => void }).gitFriedToggleTheme
        if (fn) fn()
        return
      }
      case 'show-shortcuts':
        dispatchShortcut('help')
        return
      case 'open-github':
        void openShell(GITHUB_URL).catch(() => {
          toast.error('브라우저 열기 실패', GITHUB_URL)
        })
        return
      // Repository (toolbar 의 mutation 과 동일 — useShortcut('fetch'/'pull'/'push'))
      case 'repo-fetch':
        dispatchShortcut('fetch')
        return
      case 'repo-pull':
        dispatchShortcut('pull')
        return
      case 'repo-push':
        dispatchShortcut('push')
        return
      case 'repo-branch':
        dispatchShortcut('newBranch')
        return
      case 'repo-stash-view':
        dispatchShortcut('tab3')
        return
      // History (모달 트리거 — window.gitFriedOpen* 재사용)
      case 'open-reflog': {
        const fn = (window as unknown as { gitFriedOpenReflog?: () => void }).gitFriedOpenReflog
        if (fn) fn()
        return
      }
      case 'open-bisect': {
        const fn = (window as unknown as { gitFriedOpenBisect?: () => void }).gitFriedOpenBisect
        if (fn) fn()
        return
      }
      case 'open-compare': {
        const fn = (
          window as unknown as {
            gitFriedOpenCompare?: (a?: string | null, b?: string | null) => void
          }
        ).gitFriedOpenCompare
        if (fn) fn()
        return
      }
      case 'commit-search': {
        // App.vue 의 ⌘⇧F 핸들러와 동등 — 별도 window 트리거 없으므로 키 이벤트로 dispatch.
        const ev = new KeyboardEvent('keydown', {
          key: 'f',
          code: 'KeyF',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
        })
        window.dispatchEvent(ev)
        return
      }
      default:
      // undo-action / redo-action 은 onMenuAction 으로 등록 — 등록 없으면 안내.
    }
  }

  onMounted(() => {
    void attach()
  })
  onUnmounted(() => {
    for (const u of unlistens) u()
    unlistens = []
  })

  return {
    onAction: (id, handler) => {
      onMenuAction(id, handler)
    },
  }
}
