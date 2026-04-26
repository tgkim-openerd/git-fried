<script setup lang="ts">
// 통합 터미널 — `docs/plan/10 옵션 A`.
//
// xterm.js + Tauri Channel<Vec<u8>> 로 PTY (pwsh.exe / sh) stdin·stdout binding.
// 활성 레포의 local_path 를 cwd 로 spawn. 레포 변경 시 자동 재spawn.
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Channel } from '@tauri-apps/api/core'
import '@xterm/xterm/css/xterm.css'
import { ptyOpen, ptyWrite, ptyResize, ptyClose } from '@/api/git'
import { useReposStore } from '@/stores/repos'
import { listRepos } from '@/api/git'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const store = useReposStore()
const containerRef = useTemplateRef<HTMLDivElement>('container')
const term = shallowRef<Terminal | null>(null)
const fit = shallowRef<FitAddon | null>(null)
const sessionId = ref<number | null>(null)
const spawnedFor = ref<number | null>(null) // 마지막으로 spawn 한 repoId
const error = ref<string | null>(null)

// 디폴트 shell — Windows 는 pwsh.exe, 그 외 /bin/sh.
const defaultShell = computed<string>(() => {
  const ua = navigator.userAgent.toLowerCase()
  return ua.includes('windows') ? 'pwsh.exe' : '/bin/sh'
})

async function resolveCwd(repoId: number | null): Promise<string> {
  if (repoId == null) {
    // 사용자 홈으로 fallback.
    return ''
  }
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
  () => props.visible,
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
    if (!props.visible) return
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

defineExpose({ refit: () => fit.value?.fit() })
</script>

<template>
  <div
    v-show="visible"
    class="flex h-full flex-col border-t border-border bg-[#0a0a0a]"
  >
    <header
      class="flex items-center justify-between border-b border-border bg-card px-3 py-1 text-xs"
    >
      <span class="text-muted-foreground">
        Terminal — {{ defaultShell }}
        <span v-if="error" class="ml-2 text-red-500">{{ error }}</span>
      </span>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground"
          title="재시작"
          @click="spawn"
        >
          ⟳
        </button>
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground"
          title="닫기 (⌘`)"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>
    </header>
    <div ref="container" class="flex-1 overflow-hidden p-1" />
  </div>
</template>
