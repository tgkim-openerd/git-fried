// Sprint c48 Wave B-3 — TerminalPanel.vue script 211 LOC 분리.
//
// 본 composable: xterm.js Terminal + Tauri PTY Channel binding 통합.
//   - Terminal/FitAddon/WebLinks 초기화 (ensureTerm)
//   - PTY spawn + Channel<Vec<u8>> stdin/stdout binding (spawn)
//   - 활성 레포 변경 시 자동 재spawn (watch activeRepoId)
//   - visible toggle lazy init (watch visible)
//   - 창 resize → pty resize 동기화
//   - drag-drop 파일 → quoted path stdin 삽입
//   - cleanup (onBeforeUnmount)
//
// SFC 는 template + emit close 만 담당 + defineExpose({ refit }).
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  type ShallowRef,
  watch,
  type Ref,
} from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Channel } from '@tauri-apps/api/core'
import '@xterm/xterm/css/xterm.css'
import { ptyOpen, ptyWrite, ptyResize, ptyClose, listRepos } from '@/api/git'
import { useReposStore } from '@/stores/repos'

interface UsePtyTerminalArgs {
  visible: () => boolean
  containerRef: Readonly<ShallowRef<HTMLDivElement | null>>
}

export function usePtyTerminal({ visible, containerRef }: UsePtyTerminalArgs) {
  const store = useReposStore()
  const term = shallowRef<Terminal | null>(null)
  const fit = shallowRef<FitAddon | null>(null)
  const sessionId: Ref<number | null> = ref(null)
  const spawnedFor: Ref<number | null> = ref(null) // 마지막으로 spawn 한 repoId
  const error: Ref<string | null> = ref(null)

  // 디폴트 shell — Windows 는 pwsh.exe, 그 외 /bin/sh.
  const defaultShell = computed<string>(() => {
    const ua = navigator.userAgent.toLowerCase()
    return ua.includes('windows') ? 'pwsh.exe' : '/bin/sh'
  })

  async function resolveCwd(repoId: number | null): Promise<string> {
    if (repoId == null) return ''
    // 활성 워크스페이스 무시 — 모든 레포를 가져와서 매칭.
    const all = await listRepos(null)
    const r = all.find((x) => x.id === repoId)
    return r?.localPath ?? ''
  }

  async function spawn() {
    if (!containerRef.value || !term.value || !fit.value) return
    if (sessionId.value != null) {
      await closeSession()
    }

    const repoId = store.activeRepoId
    const cwd = await resolveCwd(repoId)
    if (!cwd) {
      error.value = '레포를 먼저 선택하세요. (사이드바)'
      return
    }
    error.value = null

    const t = term.value
    t.clear()

    const onData = new Channel<number[]>()
    onData.onmessage = (chunk) => {
      // chunk 는 number[] (Vec<u8>). xterm 은 Uint8Array 가능.
      t.write(new Uint8Array(chunk))
    }

    try {
      const id = await ptyOpen(cwd, defaultShell.value, t.cols, t.rows, onData)
      sessionId.value = id
      spawnedFor.value = repoId
    } catch (e: unknown) {
      error.value = `터미널 시작 실패: ${(e as Error)?.message ?? String(e)}`
      return
    }

    // 사용자 입력 → pty stdin.
    t.onData((data) => {
      if (sessionId.value == null) return
      const bytes = Array.from(new TextEncoder().encode(data))
      ptyWrite(sessionId.value, bytes).catch(() => {
        /* ignore — 세션 종료된 경우 */
      })
    })
  }

  async function closeSession() {
    const id = sessionId.value
    sessionId.value = null
    spawnedFor.value = null
    if (id != null) {
      try {
        await ptyClose(id)
      } catch {
        /* ignore */
      }
    }
  }

  function ensureTerm() {
    if (term.value || !containerRef.value) return
    const t = new Terminal({
      fontFamily: 'Consolas, "JetBrains Mono", "D2Coding", monospace',
      fontSize: 13,
      convertEol: true,
      scrollback: 5000,
      theme: { background: '#0a0a0a', foreground: '#e6e6e6' },
    })
    const f = new FitAddon()
    t.loadAddon(f)
    t.loadAddon(new WebLinksAddon())
    t.open(containerRef.value)
    term.value = t
    fit.value = f
    nextTick(() => f.fit())
  }

  // visible 토글 시: 처음 보일 때 lazy 초기화 + spawn.
  watch(
    () => visible(),
    async (v) => {
      if (v) {
        await nextTick()
        ensureTerm()
        if (sessionId.value == null || spawnedFor.value !== store.activeRepoId) {
          await spawn()
        }
        requestAnimationFrame(() => fit.value?.fit())
      }
    },
    { immediate: true },
  )

  // 활성 레포 변경 → 새 세션 spawn (visible 일 때만).
  watch(
    () => store.activeRepoId,
    async (id) => {
      if (!visible()) return
      if (id !== spawnedFor.value) {
        await spawn()
      }
    },
  )

  // 창 / 패널 크기 변경 → fit + pty resize.
  function onWindowResize() {
    if (!fit.value || !term.value || sessionId.value == null) return
    fit.value.fit()
    ptyResize(sessionId.value, term.value.cols, term.value.rows).catch(() => {
      /* ignore */
    })
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onWindowResize)
  }

  onBeforeUnmount(() => {
    window.removeEventListener('resize', onWindowResize)
    void closeSession()
    term.value?.dispose()
    term.value = null
    fit.value = null
  })

  // Sprint M — drag-drop 파일 → 터미널 stdin 에 quoted path 삽입.
  function quotePath(p: string): string {
    if (!p) return ''
    // 공백 / 따옴표 / `$` 가 있으면 작은따옴표 (PowerShell + bash 모두 안전).
    if (/[\s"'$`]/.test(p)) {
      // 작은따옴표 안 단일따옴표는 '"'"' 로 escape (bash); pwsh 도 ' 단일 ' 안에서는 그대로.
      return `'${p.replace(/'/g, "'\\''")}'`
    }
    return p
  }

  function pathForShell(p: string): string {
    // pwsh.exe 환경은 path 가 이미 win style. /bin/sh 환경에서는 그대로.
    return quotePath(p)
  }

  function onDragOver(e: DragEvent) {
    if (e.dataTransfer && e.dataTransfer.types.includes('text/plain')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    if (!e.dataTransfer || sessionId.value == null) return
    const raw = e.dataTransfer.getData('text/plain')
    if (!raw) return
    const text = pathForShell(raw)
    // 입력 보조: 앞뒤 공백 — 사용자가 명령 가운데 삽입 가능.
    const bytes = Array.from(new TextEncoder().encode(` ${text} `))
    ptyWrite(sessionId.value, bytes).catch(() => {
      /* ignore */
    })
    term.value?.focus()
  }

  return {
    defaultShell,
    error,
    spawn,
    refit: () => fit.value?.fit(),
    onDragOver,
    onDrop,
  }
}
