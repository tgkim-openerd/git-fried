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
import type { GraphRow } from '@/api/git'

const props = defineProps<{ repoId: number | null }>()
const { data: graph, isFetching } = useGraph(() => props.repoId, 500)

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

onMounted(() => nextTick(() => drawGraph()))
watch([rows, maxLane, virtualItems], () => nextTick(() => drawGraph()))

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
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="flex items-center justify-between border-b border-border px-4 py-2">
      <h2 class="text-sm font-semibold">커밋 그래프</h2>
      <span v-if="isFetching" class="text-xs text-muted-foreground">불러오는 중...</span>
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
          class="flex cursor-pointer items-center gap-2 px-2 text-sm hover:bg-accent/40"
          :class="
            selectedSha === rows[v.index]?.commit.sha
              ? 'bg-accent text-accent-foreground'
              : ''
          "
          @click="selectRow(rows[v.index])"
        >
          <span class="w-16 shrink-0 truncate font-mono text-xs text-muted-foreground">
            {{ rows[v.index]?.commit.shortSha }}
          </span>
          <span class="flex-1 truncate">
            {{ rows[v.index]?.commit.subject }}
            <template v-for="r in rows[v.index]?.commit.refs ?? []" :key="r">
              <span class="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
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
