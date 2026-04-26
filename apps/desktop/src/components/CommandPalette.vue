<script setup lang="ts">
// Command Palette ⌘P / Ctrl+P.
// 모든 신규 액션은 본 palette 에 등록을 게이트로 한다.
// v0.2 minimal 구현 — fuzzy filter + Enter 실행.
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useReposStore } from '@/stores/repos'
import { useQueryClient } from '@tanstack/vue-query'

interface Cmd {
  id: string
  label: string
  hint?: string
  action: () => void | Promise<void>
}

const router = useRouter()
const store = useReposStore()
const qc = useQueryClient()

const open = ref(false)
const filter = ref('')
const selected = ref(0)

// 등록된 명령어 (정적 — 추후 plugin 으로 확장 가능)
const allCommands = computed<Cmd[]>(() => [
  {
    id: 'go.home',
    label: '홈으로',
    hint: 'navigate /',
    action: () => router.push('/'),
  },
  {
    id: 'go.settings',
    label: '설정 / Forge 계정',
    hint: 'navigate /settings',
    action: () => router.push('/settings'),
  },
  {
    id: 'workspace.all',
    label: '워크스페이스: 전체',
    action: () => store.setActiveWorkspace(null),
  },
  {
    id: 'refetch.all',
    label: '모든 쿼리 무효화',
    hint: 'invalidate everything',
    action: () => qc.invalidateQueries(),
  },
  {
    id: 'theme.toggle',
    label: '다크/라이트 모드 토글',
    action: () => {
      const root = document.documentElement
      root.classList.toggle('dark')
      localStorage.setItem(
        'git-fried.theme',
        root.classList.contains('dark') ? 'dark' : 'light',
      )
    },
  },
])

const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return allCommands.value
  return allCommands.value.filter(
    (c) => c.label.toLowerCase().includes(q) || c.id.includes(q),
  )
})

watch(filter, () => (selected.value = 0))
watch(filtered, () => {
  if (selected.value >= filtered.value.length) selected.value = 0
})

function onKey(e: KeyboardEvent) {
  // ⌘P / Ctrl+P
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
    e.preventDefault()
    open.value = !open.value
    if (open.value) {
      filter.value = ''
      selected.value = 0
    }
    return
  }
  if (!open.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    open.value = false
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    selected.value = Math.min(filtered.value.length - 1, selected.value + 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selected.value = Math.max(0, selected.value - 1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const c = filtered.value[selected.value]
    if (c) {
      c.action()
      open.value = false
    }
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-32"
      @click.self="open = false"
    >
      <div class="w-[560px] max-w-[90vw] rounded-lg border border-border bg-card shadow-xl">
        <input
          v-model="filter"
          autofocus
          placeholder="명령어 검색... (⌘P 닫기)"
          class="w-full rounded-t-lg border-b border-border bg-transparent px-3 py-2 text-sm outline-none"
        />
        <ul class="max-h-72 overflow-auto py-1">
          <li
            v-for="(c, i) in filtered"
            :key="c.id"
            class="cursor-pointer px-3 py-1.5 text-sm"
            :class="i === selected ? 'bg-accent text-accent-foreground' : ''"
            @mouseenter="selected = i"
            @click="
              () => {
                c.action()
                open = false
              }
            "
          >
            <div class="flex items-center justify-between">
              <span>{{ c.label }}</span>
              <span class="text-[10px] text-muted-foreground">{{ c.hint || c.id }}</span>
            </div>
          </li>
          <li
            v-if="filtered.length === 0"
            class="px-3 py-3 text-center text-xs text-muted-foreground"
          >
            결과 없음
          </li>
        </ul>
      </div>
    </div>
  </Teleport>
</template>
