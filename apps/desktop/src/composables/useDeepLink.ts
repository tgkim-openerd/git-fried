// Deep link 핸들러 — Sprint C7 (`docs/plan/11 §29`).
//
// 등록된 scheme: `git-fried://`. 외부 앱 / 브라우저에서 git-fried 띄우거나
// 라우팅 가능.
//
// 지원 형식 (v1):
//   - git-fried://launchpad        → /launchpad 으로 이동
//   - git-fried://settings         → /settings
//   - git-fried://repo/<id>        → 활성 레포 = id, /
//   - git-fried://command/<id>     → CommandPalette 명령 trigger (v1.x — placeholder)
//
// Tauri 앱 첫 실행 + 이미 떠있는 경우 모두 onOpenUrl 이벤트 발화.
import { onMounted, onUnmounted } from 'vue'
import type { Router } from 'vue-router'
import { onOpenUrl } from '@tauri-apps/plugin-deep-link'
import { useReposStore } from '@/stores/repos'
import { dispatchShortcut, type ShortcutAction } from '@/composables/useShortcuts'

/** `git-fried://command/<alias>` 의 alias → ShortcutAction 매핑. */
const COMMAND_ALIASES: Record<string, ShortcutAction> = {
  fetch: 'fetch',
  pull: 'pull',
  push: 'push',
  commit: 'commit',
  'new-pr': 'newPr',
  'new-branch': 'newBranch',
  terminal: 'terminal',
  help: 'help',
  'stage-all': 'stageAllExplicit',
  'unstage-all': 'unstageAll',
  'stage-and-commit': 'stageAndCommit',
  'show-diff': 'showDiff',
  'toggle-sidebar': 'toggleSidebar',
  'toggle-detail': 'toggleDetail',
  'zoom-in': 'zoomIn',
  'zoom-out': 'zoomOut',
  'zoom-reset': 'zoomReset',
  'file-history': 'fileHistorySearch',
  'close-modal': 'closeModal',
  'open-in-explorer': 'openInExplorer',
  fullscreen: 'toggleFullscreen',
  'next-tab': 'nextTab',
  'prev-tab': 'prevTab',
  'close-tab': 'closeTab',
}

interface UnlistenFn {
  (): void
}

export function useDeepLink(router: Router) {
  const store = useReposStore()
  let unlisten: UnlistenFn | null = null

  function dispatch(rawUrl: string) {
    try {
      // git-fried://launchpad 같은 형식. URL parser 가 host=launchpad 로.
      const url = new URL(rawUrl)
      const host = url.hostname || url.pathname.replace(/^\/+/, '').split('/')[0]
      const segs = url.pathname.replace(/^\/+/, '').split('/').filter(Boolean)
      // Tauri 가 `git-fried://launchpad` 를 hostname=launchpad 로 파싱.
      const cmd = host || segs[0]
      const arg = host ? segs[0] : segs[1]

      switch (cmd) {
        case 'launchpad':
          router.push('/launchpad')
          break
        case 'settings':
          router.push('/settings')
          break
        case 'home':
          router.push('/')
          break
        case 'repo': {
          if (arg) {
            const id = Number(arg)
            if (!Number.isNaN(id)) {
              store.setActiveRepo(id)
              router.push('/')
            }
          }
          break
        }
        case 'command': {
          // git-fried://command/<alias> — Sprint D6.
          if (arg) {
            const action = COMMAND_ALIASES[arg]
            if (action) {
              // 다음 tick 에 dispatch (router.push 가 mount 안 된 컴포넌트에 등록할 시간).
              setTimeout(() => dispatchShortcut(action), 50)
            }
          }
          break
        }
        default:
          // 알 수 없는 명령은 무시 (silent fail).
          break
      }
    } catch {
      /* malformed URL — ignore */
    }
  }

  onMounted(async () => {
    try {
      const handle = await onOpenUrl((urls: string[]) => {
        for (const u of urls) dispatch(u)
      })
      unlisten = handle as unknown as UnlistenFn
    } catch {
      // dev 모드에서 plugin 미초기화 등 — silent fail.
    }
  })

  onUnmounted(() => {
    if (unlisten) {
      try {
        unlisten()
      } catch {
        /* ignore */
      }
    }
  })
}
