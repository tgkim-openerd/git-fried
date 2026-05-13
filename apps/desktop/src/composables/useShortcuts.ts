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
  | 'showDiff' // ⌘D — 선택 commit diff (modal)
  | 'toggleInlineDiff' // ⌘⇧D — inline diff panel 토글 (Sprint c25-4.5)
  | 'prevHunk' // Alt+↑ — diff 이전 hunk (inline + modal, Sprint c26-3)
  | 'nextHunk' // Alt+↓ — diff 다음 hunk
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
  | 'nextTab' // ⌃Tab — 다음 레포 탭 (Sprint G)
  | 'prevTab' // ⌃⇧Tab — 이전 레포 탭 (Sprint G)
  | 'closeTab' // ⌘⇧W — 활성 레포 탭 닫기 (Sprint G)
  | 'filterRepos' // ⌘⌥F — Sidebar 레포 필터 focus (Sprint I)

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
    if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey && !isInputFocused()) {
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
    if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && !isInputFocused()) {
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

    // Alt+↑ / Alt+↓ — diff hunk navigation (Sprint c26-3). modifier=alt 단독.
    // ARCH-001 fix — input/textarea 안에서 발화 시 텍스트 편집 (커서 이동) 충돌 방지.
    if (e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey && !isInputFocused()) {
      let hunkAction: ShortcutAction | null = null
      if (e.key === 'ArrowUp') hunkAction = 'prevHunk'
      else if (e.key === 'ArrowDown') hunkAction = 'nextHunk'
      if (hunkAction) {
        const set = bus.handlers.get(hunkAction)
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

    // ⌃Tab / ⌃⇧Tab — 레포 탭 전환 (Sprint G). browser-default Tab 키 충돌 방지.
    if (e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'Tab') {
      const action: ShortcutAction = e.shiftKey ? 'prevTab' : 'nextTab'
      const set = bus.handlers.get(action)
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

    // ⌘⌥F / Ctrl+Alt+F — Sidebar 레포 필터 focus (Sprint I).
    if (e.altKey && (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'f') {
      const set = bus.handlers.get('filterRepos')
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
    else if (k === 'd' && e.shiftKey) action = 'toggleInlineDiff'
    else if (k === 'w' && !e.shiftKey) action = 'closeModal'
    else if (k === 'w' && e.shiftKey) action = 'closeTab'
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

// ====== v0.6 #22 (UltraPlan plan/31) — Keybindings 충돌 검출 ======
//
// 사용자 customization (v0.5 #15) 도입 시 같은 키 조합이 2+ action 에 매핑되면
// 검출. 현재 hardcoded chain 은 implicit 으로 충돌 없음 (단일 if/else if).
// findShortcutConflicts 는 외부 customization map 받아서 dup key 식별.

export interface ShortcutBinding {
  /** 정규화된 chord — 'mod+shift+k' 같은 string. */
  chord: string
  action: ShortcutAction
}

export interface ShortcutConflict {
  chord: string
  actions: ShortcutAction[]
}

/**
 * Customization map 의 충돌 검출. chord 별로 action 그룹화 → 2+ 면 conflict.
 *
 * @param bindings — 사용자 정의 binding list (v0.5 #15 SQLite 에서 load).
 * @returns chord 별 conflict (actions ≥ 2). 빈 배열 = no conflict.
 */
export function findShortcutConflicts(bindings: readonly ShortcutBinding[]): ShortcutConflict[] {
  const map = new Map<string, ShortcutAction[]>()
  for (const b of bindings) {
    const arr = map.get(b.chord) ?? []
    arr.push(b.action)
    map.set(b.chord, arr)
  }
  return Array.from(map.entries())
    .filter(([, actions]) => actions.length >= 2)
    .map(([chord, actions]) => ({ chord, actions }))
}

/** chord 정규화 — 'Ctrl+Shift+K' / 'ctrl+SHIFT+k' → 'mod+shift+k'. macOS Cmd 도 'mod'. */
export function normalizeChord(input: string): string {
  const parts = input
    .split('+')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const mods: string[] = []
  const keys: string[] = []
  for (const p of parts) {
    if (p === 'cmd' || p === 'meta' || p === 'ctrl' || p === 'control') mods.push('mod')
    else if (p === 'shift') mods.push('shift')
    else if (p === 'alt' || p === 'option') mods.push('alt')
    else keys.push(p)
  }
  // mod → shift → alt 순서 (chord 비교 일관).
  const order = ['mod', 'shift', 'alt']
  const dedupModsSorted = order.filter((m) => mods.includes(m))
  return [...dedupModsSorted, ...keys].join('+')
}
