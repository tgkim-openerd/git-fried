<script setup lang="ts">
// 커밋 그래프 + 로그 테이블 통합 컴포넌트.
// 좌측: Canvas 로 그래프 (pvigier straight-lane), 우측: 가상 스크롤 메타.
//
// 디자인:
//  - row 높이 28px 고정
//  - lane 폭 16px
//  - 노드 원 6px, 엣지 stroke 1.5px
//  - 8개 stable color (브랜치 hash)
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useGraph } from '@/composables/useGraph'
import { useRefVisibility } from '@/composables/useHiddenRefs'
import { useShortcut } from '@/composables/useShortcuts'
import type { GraphRow } from '@/api/git'

const props = defineProps<{ repoId: number | null }>()
const { data: graph, isFetching } = useGraph(() => props.repoId, 500)
const { visibleFn: visibleRef, soloRef } = useRefVisibility(() => props.repoId)

// === 검색 (in-memory) ===
// v0.x 단계: 현재 그래프 (최대 500 commits) 내에서 subject / author / sha 부분일치.
// FTS5 인덱싱은 v1.0 (Cross-repo + 5000+ commits 시).
const searchQuery = ref('')
const searchOpen = ref(false)
const searchInputRef = ref<HTMLInputElement | null>(null)

function isMatch(r: GraphRow, q: string): boolean {
  if (!q) return true
  const lower = q.toLowerCase()
  return (
    r.commit.subject.toLowerCase().includes(lower) ||
    r.commit.authorName.toLowerCase().includes(lower) ||
    r.commit.sha.startsWith(lower) ||
    r.commit.refs.some((x) => x.toLowerCase().includes(lower))
  )
}

const matchCount = computed(() => {
  if (!searchQuery.value) return 0
  return rows.value.filter((r) => isMatch(r, searchQuery.value)).length
})

function openSearch() {
  searchOpen.value = true
  nextTick(() => searchInputRef.value?.focus())
}
function closeSearch() {
  searchOpen.value = false
  searchQuery.value = ''
  drawGraph()
}

// ⌘F / Ctrl+F 단축키
function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault()
    if (searchOpen.value) closeSearch()
    else openSearch()
  } else if (e.key === 'Escape' && searchOpen.value) {
    e.preventDefault()
    closeSearch()
  }
}

const ROW_H = 28
const LANE_W = 16

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const rows = computed<GraphRow[]>(() => graph.value?.rows ?? [])
const maxLane = computed(() => graph.value?.maxLane ?? 1)
const graphWidth = computed(() => Math.max(1, maxLane.value) * LANE_W + 16)

const virtualizer = useVirtualizer(
  computed(() => ({
    count: rows.value.length,
    getScrollElement: () => containerRef.value,
    estimateSize: () => ROW_H,
    overscan: 12,
  })),
)
const virtualItems = computed(() => virtualizer.value.getVirtualItems())
const totalHeight = computed(() => virtualizer.value.getTotalSize())

// stable color (브랜치 lane hash)
const palette = [
  '#22c55e', // green
  '#0ea5e9', // sky
  '#f59e0b', // amber
  '#a78bfa', // violet
  '#f43f5e', // rose
  '#10b981', // emerald
  '#eab308', // yellow
  '#06b6d4', // cyan
]
function laneColor(lane: number): string {
  return palette[lane % palette.length]
}

function drawGraph() {
  const c = canvasRef.value
  const container = containerRef.value
  if (!c || !container) return

  const dpi = window.devicePixelRatio || 1
  const w = graphWidth.value
  const h = container.clientHeight
  c.width = w * dpi
  c.height = h * dpi
  c.style.width = `${w}px`
  c.style.height = `${h}px`
  const ctx = c.getContext('2d')!
  ctx.setTransform(dpi, 0, 0, dpi, 0, 0)
  ctx.clearRect(0, 0, w, h)

  const scrollTop = container.scrollTop

  // 보이는 row 들에 대해서만 그리기
  for (const v of virtualItems.value) {
    const idx = v.index
    const row = rows.value[idx]
    if (!row) continue

    const y = v.start - scrollTop + ROW_H / 2

    // 1. crossing lanes — vertical line
    for (const lane of row.crossingLanes) {
      const x = lane * LANE_W + LANE_W / 2
      ctx.strokeStyle = laneColor(lane)
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x, v.start - scrollTop)
      ctx.lineTo(x, v.start - scrollTop + ROW_H)
      ctx.stroke()
    }

    // 2. parent edges (curve to next row's parent_lane)
    const nextRow = rows.value[idx + 1]
    if (nextRow) {
      const nextY = v.start - scrollTop + ROW_H + ROW_H / 2
      const fromX = row.lane * LANE_W + LANE_W / 2
      for (const pl of row.parentLanes) {
        const toX = pl * LANE_W + LANE_W / 2
        ctx.strokeStyle = laneColor(pl)
        ctx.lineWidth = 1.5
        ctx.beginPath()
        if (pl === row.lane) {
          // 직진
          ctx.moveTo(fromX, y)
          ctx.lineTo(toX, nextY)
        } else {
          // 곡선 (베지어)
          ctx.moveTo(fromX, y)
          ctx.bezierCurveTo(
            fromX,
            y + ROW_H / 2,
            toX,
            nextY - ROW_H / 2,
            toX,
            nextY,
          )
        }
        ctx.stroke()
      }
    }

    // 3. node circle (이 commit 의 lane)
    const cx = row.lane * LANE_W + LANE_W / 2
    ctx.fillStyle = laneColor(row.lane)
    ctx.beginPath()
    ctx.arc(cx, y, row.isMerge ? 4 : 3.5, 0, Math.PI * 2)
    ctx.fill()
    if (row.isMerge) {
      ctx.strokeStyle = '#0a0a0a'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }
}

onMounted(() => {
  nextTick(() => drawGraph())
  window.addEventListener('keydown', onKeydown)
})
watch([rows, maxLane, virtualItems], () => nextTick(() => drawGraph()))
import { onUnmounted } from 'vue'
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

function onScroll() {
  drawGraph()
}

function formatDate(unix: number): string {
  const d = new Date(unix * 1000)
  return d.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const emit = defineEmits<{
  selectCommit: [sha: string]
}>()
const selectedSha = ref<string | null>(null)
function selectRow(r: GraphRow) {
  selectedSha.value = r.commit.sha
  emit('selectCommit', r.commit.sha)
}

// Vim nav (J/K) — selectedSha 다음/이전 행. 비어있으면 첫 행 선택.
function moveSelection(delta: 1 | -1) {
  const list = rows.value
  if (list.length === 0) return
  let idx = list.findIndex((r) => r.commit.sha === selectedSha.value)
  if (idx < 0) {
    idx = delta > 0 ? 0 : list.length - 1
  } else {
    idx = Math.max(0, Math.min(list.length - 1, idx + delta))
  }
  const r = list[idx]
  if (!r) return
  selectedSha.value = r.commit.sha
  emit('selectCommit', r.commit.sha)
  // 가시 영역으로 스크롤
  if (containerRef.value) {
    const targetTop = idx * ROW_H
    const ct = containerRef.value
    if (targetTop < ct.scrollTop) ct.scrollTop = targetTop
    else if (targetTop + ROW_H > ct.scrollTop + ct.clientHeight) {
      ct.scrollTop = targetTop + ROW_H - ct.clientHeight
    }
  }
}

useShortcut('vimDown', () => moveSelection(1))
useShortcut('vimUp', () => moveSelection(-1))
useShortcut('vimLeft', () => {
  selectedSha.value = null
})
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
      <h2 class="text-sm font-semibold">커밋 그래프</h2>
      <div class="flex flex-1 items-center justify-end gap-2">
        <div v-if="searchOpen" class="flex items-center gap-1">
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            placeholder="검색: subject / 작성자 / SHA / ref (esc 닫기)"
            class="w-72 rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
          <span class="text-[10px] text-muted-foreground">
            {{ searchQuery ? `${matchCount} / ${rows.length}` : `${rows.length}` }}
          </span>
          <button
            type="button"
            class="text-xs text-muted-foreground hover:text-foreground"
            @click="closeSearch"
          >
            ✕
          </button>
        </div>
        <button
          v-else
          type="button"
          class="rounded-md border border-input px-2 py-0.5 text-xs hover:bg-accent"
          title="⌘F / Ctrl+F"
          @click="openSearch"
        >
          🔍
        </button>
        <span v-if="isFetching" class="text-xs text-muted-foreground">불러오는 중...</span>
      </div>
    </header>

    <div
      ref="containerRef"
      class="relative flex-1 overflow-auto"
      @scroll="onScroll"
    >
      <!-- 가상 height -->
      <div :style="{ height: totalHeight + 'px', position: 'relative' }">
        <!-- canvas (sticky 좌측) -->
        <canvas
          ref="canvasRef"
          :style="{
            position: 'sticky',
            top: 0,
            left: 0,
            width: graphWidth + 'px',
            zIndex: 1,
            pointerEvents: 'none',
          }"
          class="block"
        />
        <!-- row 들 -->
        <div
          v-for="v in virtualItems"
          :key="rows[v.index]?.commit.sha"
          :style="{
            position: 'absolute',
            top: v.start + 'px',
            left: graphWidth + 'px',
            right: 0,
            height: ROW_H + 'px',
          }"
          class="flex cursor-pointer items-center gap-2 px-2 text-sm hover:bg-accent/40 transition-opacity"
          :class="[
            selectedSha === rows[v.index]?.commit.sha
              ? 'bg-accent text-accent-foreground'
              : '',
            searchQuery && rows[v.index] && !isMatch(rows[v.index], searchQuery)
              ? 'opacity-25'
              : '',
          ]"
          @click="selectRow(rows[v.index])"
        >
          <span class="w-16 shrink-0 truncate font-mono text-xs text-muted-foreground">
            {{ rows[v.index]?.commit.shortSha }}
          </span>
          <span class="flex-1 truncate">
            {{ rows[v.index]?.commit.subject }}
            <template v-for="r in rows[v.index]?.commit.refs ?? []" :key="r">
              <span
                v-if="visibleRef(r)"
                class="ml-1.5 rounded px-1.5 py-0.5 text-[10px]"
                :class="
                  soloRef === r
                    ? 'bg-orange-500/20 text-orange-500 ring-1 ring-orange-500/40'
                    : 'bg-muted text-muted-foreground'
                "
              >
                {{ r }}
              </span>
            </template>
          </span>
          <span class="w-32 shrink-0 truncate text-xs text-muted-foreground">
            {{ rows[v.index]?.commit.authorName }}
          </span>
          <span class="w-20 shrink-0 text-xs text-muted-foreground">
            {{ formatDate(rows[v.index]?.commit.authorAt ?? 0) }}
          </span>
          <span
            v-if="rows[v.index]?.commit.signed"
            class="w-3 text-xs text-emerald-500"
            title="GPG 서명"
            >✓</span
          >
        </div>
      </div>
    </div>
  </div>
</template>
