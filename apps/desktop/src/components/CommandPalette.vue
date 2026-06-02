<script setup lang="ts">
// Command Palette ⌘P / Ctrl+P (Sprint B6 — `docs/plan/11 §17`).
//
// 카테고리 모델 + 30+ 명령. 모든 신규 액션은 본 palette 등록을 게이트로 한다.
// 검색은 fuzzy + label/category/id/hint 매칭. 그룹 헤더는 검색어 없을 때만 표시.
//
// Sprint c31 god comp 분리 2/N — 명령 catalog + 헬퍼는 useCommandCatalog 로 분리.
// 본 컴포넌트는 open / filter / keyboard nav / UI rendering 만 담당.
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  useCommandCatalog,
  type Category,
  type Cmd,
} from '@/composables/useCommandCatalog'

const { t } = useI18n()
const { allCommands } = useCommandCatalog()

const open = ref(false)
const filter = ref('')
const selected = ref(0)

function score(cmd: Cmd, q: string): number {
  if (!q) return 1
  const ql = q.toLowerCase()
  const label = cmd.label.toLowerCase()
  const cat = CATEGORY_LABELS[cmd.category].toLowerCase()
  if (label.startsWith(ql)) return 4
  if (label.includes(ql)) return 3
  if (cmd.id.includes(ql)) return 2
  if (cat.includes(ql)) return 1.5
  if (cmd.hint?.toLowerCase().includes(ql)) return 1
  return 0
}

const filtered = computed(() => {
  const q = filter.value.trim()
  if (!q) return allCommands.value
  return allCommands.value
    .map((c) => ({ c, s: score(c, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c)
})

interface DisplayGroup {
  category: Category
  label: string
  items: Cmd[]
}

const groupedDisplay = computed<DisplayGroup[]>(() => {
  // 검색어 있으면 그룹 헤더 안 보이게 (단일 ranked list).
  if (filter.value.trim()) {
    return [
      {
        category: 'repo',
        label: '',
        items: filtered.value,
      },
    ]
  }
  const map = new Map<Category, Cmd[]>()
  for (const c of filtered.value) {
    if (!map.has(c.category)) map.set(c.category, [])
    map.get(c.category)!.push(c)
  }
  const out: DisplayGroup[] = []
  for (const cat of CATEGORY_ORDER) {
    const items = map.get(cat)
    if (items && items.length) {
      out.push({ category: cat, label: CATEGORY_LABELS[cat], items })
    }
  }
  return out
})

// flat list (selected index keyboard nav 기준).
const flatList = computed<Cmd[]>(() => {
  const out: Cmd[] = []
  for (const g of groupedDisplay.value) out.push(...g.items)
  return out
})

watch(filter, () => (selected.value = 0))
watch(flatList, () => {
  if (selected.value >= flatList.value.length) selected.value = 0
})

function indexInFlat(cmd: Cmd): number {
  return flatList.value.findIndex((x) => x.id === cmd.id)
}

function onKey(e: KeyboardEvent) {
  // ⌘P / Ctrl+P
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p' && !e.shiftKey) {
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
    selected.value = Math.min(flatList.value.length - 1, selected.value + 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selected.value = Math.max(0, selected.value - 1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const c = flatList.value[selected.value]
    if (c) {
      void c.action()
      open.value = false
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  // Phase 10-6 — 네이티브 메뉴 'View > Command Palette' bridge.
  window.gitFriedOpenCommandPalette = () => {
    open.value = true
    filter.value = ''
    selected.value = 0
  }
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  delete window.gitFriedOpenCommandPalette
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-32"
      @click.self="open = false"
    >
      <div class="w-[600px] max-w-[90vw] rounded-lg border border-border bg-card shadow-xl">
        <input
          v-model="filter"
          autofocus
          :placeholder="t('templ.commandPalettePlaceholder')"
          class="w-full rounded-t-lg border-b border-border bg-transparent px-3 py-2 text-sm outline-none"
        />
        <div class="max-h-[60vh] overflow-auto py-1">
          <template v-for="g in groupedDisplay" :key="g.category">
            <div
              v-if="g.label"
              class="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground"
            >
              {{ g.label }}
            </div>
            <ul>
              <li
                v-for="c in g.items"
                :key="c.id"
                class="cursor-pointer px-3 py-1.5 text-sm"
                :class="indexInFlat(c) === selected ? 'bg-accent text-accent-foreground' : ''"
                @mouseenter="selected = indexInFlat(c)"
                @click="
                  () => {
                    void c.action()
                    open = false
                  }
                "
              >
                <div class="flex items-center justify-between">
                  <span>{{ c.label }}</span>
                  <span class="text-[10px] text-muted-foreground">{{ c.hint || '' }}</span>
                </div>
              </li>
            </ul>
          </template>
          <p
            v-if="flatList.length === 0"
            class="px-3 py-3 text-center text-xs text-muted-foreground"
          >
            결과 없음
          </p>
        </div>
        <div class="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
          ↑↓ 탐색 · Enter 실행 · Esc 닫기 · 카테고리: Repo / Branch / File / View / Stash / History
          / AI / Settings
        </div>
      </div>
    </div>
  </Teleport>
</template>
