// 글로벌 키보드 단축키 핸들러 (GitKraken 표준).
//
// `docs/plan/07 §3` 의 단축키 매트릭스 일부 구현.
// 다른 단축키 (⌘P, ⌘F) 는 컴포넌트 자체에서 처리.
//
// 사용:
//   const sc = useGlobalShortcuts()
//   sc.on('fetch', () => ...)
//   onUnmounted(() => sc.off('fetch', ...))
import { onMounted, onUnmounted } from 'vue'

export type ShortcutAction =
  | 'fetch'
  | 'pull'
  | 'push'
  | 'newBranch'
  | 'newPr'
  | 'commit'
  | 'help'
  | 'terminal'
  | 'tab1'
  | 'tab2'
  | 'tab3'
  | 'tab4'
  | 'tab5'
  | 'tab6'
  | 'tab7'

type Handler = () => void

interface Bus {
  handlers: Map<ShortcutAction, Set<Handler>>
}

const bus: Bus = {
  handlers: new Map(),
}

function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    (el as HTMLElement).isContentEditable === true
  )
}

let installed = false
function installGlobal() {
  if (installed) return
  installed = true
  window.addEventListener('keydown', (e) => {
    // `?` 단독 키 — 도움말. input focus 안 됐을 때만.
    if (
      e.key === '?' &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      !isInputFocused()
    ) {
      const set = bus.handlers.get('help')
      if (set && set.size > 0) {
        e.preventDefault()
        for (const fn of set) {
          try {
            fn()
          } catch {
            /* ignore */
          }
        }
      }
      return
    }

    const meta = e.metaKey || e.ctrlKey
    if (!meta) return
    const k = e.key.toLowerCase()
    let action: ShortcutAction | null = null

    if (k === 'l' && !e.shiftKey) action = 'fetch'
    else if (k === 'l' && e.shiftKey) action = 'pull'
    else if (k === 'k' && e.shiftKey) action = 'push'
    else if (k === 'b' && !e.shiftKey) action = 'newBranch'
    else if (k === 'n' && !e.shiftKey) action = 'newPr'
    else if (k === 'enter') action = 'commit'
    else if (e.key === '`' || e.code === 'Backquote') action = 'terminal'
    else if (e.key === '1') action = 'tab1'
    else if (e.key === '2') action = 'tab2'
    else if (e.key === '3') action = 'tab3'
    else if (e.key === '4') action = 'tab4'
    else if (e.key === '5') action = 'tab5'
    else if (e.key === '6') action = 'tab6'
    else if (e.key === '7') action = 'tab7'

    if (!action) return
    const set = bus.handlers.get(action)
    if (!set || set.size === 0) return
    e.preventDefault()
    for (const fn of set) {
      try {
        fn()
      } catch {
        // ignore — 한 핸들러 실패가 다른 핸들러 막지 않음
      }
    }
  })
}

export function useShortcut(action: ShortcutAction, handler: Handler) {
  onMounted(() => {
    installGlobal()
    let set = bus.handlers.get(action)
    if (!set) {
      set = new Set()
      bus.handlers.set(action, set)
    }
    set.add(handler)
  })
  onUnmounted(() => {
    const set = bus.handlers.get(action)
    if (set) set.delete(handler)
  })
}
