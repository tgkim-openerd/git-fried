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
  // Vim nav (Sprint A2 — `docs/plan/11 §27`).
  // input focus 가 아닐 때만 발화 (modifier 없이 단일 키).
  | 'vimDown' // J — CommitGraph 다음 행
  | 'vimUp' // K — 이전 행
  | 'vimRight' // L — Enter (선택 commit 확장)
  | 'vimLeft' // H — Escape (선택 해제)
  | 'stageCurrent' // S — StatusPanel 의 selected 파일 stage
  | 'unstageCurrent' // U — selected 파일 unstage
  // Sprint B5 — 단축키 12+ (`docs/plan/11 §27`).
  | 'stageAllExplicit' // ⌘⇧S
  | 'unstageAll' // ⌘⇧U
  | 'stageAndCommit' // ⌘⇧Enter
  | 'focusMessage' // ⌘⇧M
  | 'showDiff' // ⌘D — 선택 commit diff
  | 'closeModal' // ⌘W — 활성 모달 닫기
  | 'zoomIn' // ⌘=
  | 'zoomOut' // ⌘-
  | 'zoomReset' // ⌘0
  | 'toggleSidebar' // ⌘J
  | 'toggleDetail' // ⌘K
  | 'fileHistorySearch' // ⌘⇧H
  | 'newTab' // ⌘T — Repo Switcher (⌘⇧P alias)
  | 'openInExplorer' // ⌥O — OS 파일 매니저 (Sprint F4)
  | 'toggleFullscreen' // F11 — 전체화면 토글 (Sprint F5)

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

    // Vim nav (modifier 없이 단일 키, input focus 시 비활성).
    // J/K/H/L = nav, S/U = stage/unstage current.
    if (
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.shiftKey &&
      !isInputFocused()
    ) {
      let vimAction: ShortcutAction | null = null
      switch (e.key) {
        case 'j':
          vimAction = 'vimDown'
          break
        case 'k':
          vimAction = 'vimUp'
          break
        case 'l':
          vimAction = 'vimRight'
          break
        case 'h':
          vimAction = 'vimLeft'
          break
        case 's':
          vimAction = 'stageCurrent'
          break
        case 'u':
          vimAction = 'unstageCurrent'
          break
      }
      if (vimAction) {
        const set = bus.handlers.get(vimAction)
        if (set && set.size > 0) {
          e.preventDefault()
          for (const fn of set) {
            try {
              fn()
            } catch {
              /* ignore */
            }
          }
          return
        }
      }
    }

    // Alt+O — OS 파일 매니저 (Sprint F4). modifier=alt 단독.
    if (e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'o') {
      const set = bus.handlers.get('openInExplorer')
      if (set && set.size > 0) {
        e.preventDefault()
        for (const fn of set) {
          try {
            fn()
          } catch {
            /* ignore */
          }
        }
        return
      }
    }

    // F11 (또는 ⌃⌘F) — Fullscreen 토글 (Sprint F5).
    if (
      (e.key === 'F11' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) ||
      (e.metaKey && e.ctrlKey && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f')
    ) {
      const set = bus.handlers.get('toggleFullscreen')
      if (set && set.size > 0) {
        e.preventDefault()
        for (const fn of set) {
          try {
            fn()
          } catch {
            /* ignore */
          }
        }
        return
      }
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
    else if (k === 'enter' && e.shiftKey) action = 'stageAndCommit'
    else if (k === 'enter') action = 'commit'
    else if (e.key === '`' || e.code === 'Backquote') action = 'terminal'
    else if (e.key === '1') action = 'tab1'
    else if (e.key === '2') action = 'tab2'
    else if (e.key === '3') action = 'tab3'
    else if (e.key === '4') action = 'tab4'
    else if (e.key === '5') action = 'tab5'
    else if (e.key === '6') action = 'tab6'
    else if (e.key === '7') action = 'tab7'
    // Sprint B5 — 단축키 12+
    else if (k === 's' && e.shiftKey) action = 'stageAllExplicit'
    else if (k === 'u' && e.shiftKey) action = 'unstageAll'
    else if (k === 'm' && e.shiftKey) action = 'focusMessage'
    else if (k === 'h' && e.shiftKey) action = 'fileHistorySearch'
    else if (k === 'd' && !e.shiftKey) action = 'showDiff'
    else if (k === 'w' && !e.shiftKey) action = 'closeModal'
    else if (k === 'j' && !e.shiftKey) action = 'toggleSidebar'
    else if (k === 'k' && !e.shiftKey) action = 'toggleDetail'
    else if (k === 't' && !e.shiftKey) action = 'newTab'
    else if ((e.key === '=' || e.key === '+') && !e.altKey) action = 'zoomIn'
    else if (e.key === '-' && !e.altKey) action = 'zoomOut'
    else if (e.key === '0' && !e.altKey) action = 'zoomReset'

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

/**
 * 등록된 모든 핸들러 즉시 호출 (Command Palette 가 사용).
 * 키보드 이벤트 우회 — 등록된 핸들러가 0 개면 no-op.
 */
export function dispatchShortcut(action: ShortcutAction): boolean {
  const set = bus.handlers.get(action)
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
