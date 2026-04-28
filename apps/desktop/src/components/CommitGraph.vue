<script setup lang="ts">
// 커밋 그래프 + 로그 테이블 통합 컴포넌트.
// 좌측: Canvas 로 그래프 (pvigier straight-lane), 우측: 가상 스크롤 메타.
//
// 디자인:
//  - row 높이 28px 고정
//  - lane 폭 16px
//  - 노드 원 6px, 엣지 stroke 1.5px
//  - 8개 stable color (브랜치 hash)
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { VueDraggable } from 'vue-draggable-plus'
import { useGraph } from '@/composables/useGraph'
import { useHiddenRefMutations, useRefVisibility, useSoloRef } from '@/composables/useHiddenRefs'
import type { HiddenRefKind } from '@/api/git'
import { useShortcut } from '@/composables/useShortcuts'
import { useCommitColumns, type CommitColumnId } from '@/composables/useCommitColumns'
import { useCommitActions } from '@/composables/useCommitActions'
import { formatDateLocalized } from '@/composables/useUserSettings'
import ContextMenu, { type ContextMenuExpose } from './ContextMenu.vue'
import type { GraphRow } from '@/api/git'

const props = defineProps<{ repoId: number | null }>()
const { data: graph, isFetching } = useGraph(() => props.repoId, 500)
const { visibleFn: visibleRef, soloRef } = useRefVisibility(() => props.repoId)
const { hide: hideMut } = useHiddenRefMutations(() => props.repoId)
const { setSolo } = useSoloRef(() => props.repoId)

// Sprint 22-9 V-9 — ref-pill body click = solo toggle (이 ref 만 그래프에 표시 / 다시 클릭=해제).
// 🙈 버튼은 hide (기존 동작 유지). HEAD 표시 prefix 가 있을 수 있어 trim.
function toggleSoloRef(name: string) {
  const trimmed = name.replace(/^HEAD ->\s*/, '').trim()
  setSolo(soloRef.value === trimmed ? null : trimmed)
}

// Sprint K — branch ref hover → 🙈 클릭 시 즉시 숨김.
function refKindOf(name: string): HiddenRefKind {
  if (name.startsWith('refs/tags/') || name.startsWith('tag: ')) return 'tag'
  if (name.startsWith('stash@') || name === 'stash') return 'stash'
  // origin/main, upstream/feature 등 = remote
  if (name.includes('/') && !name.startsWith('refs/heads/')) return 'remote'
  return 'branch'
}

function hideRefByName(name: string) {
  // "HEAD -> main" 같이 표시 prefix 가 있을 수 있음 → tail 만 추출.
  const trimmed = name.replace(/^HEAD ->\s*/, '').trim()
  hideMut.mutate({ refName: trimmed, refKind: refKindOf(trimmed) })
}

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
const DEFAULT_LANE_W = 16
const LANE_W_KEY = 'git-fried.commit-graph-lane-width'
const LANE_W_MIN = 8
const LANE_W_MAX = 36

function loadLaneW(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_LANE_W
  const v = localStorage.getItem(LANE_W_KEY)
  if (!v) return DEFAULT_LANE_W
  const n = Number.parseInt(v, 10)
  if (!Number.isFinite(n)) return DEFAULT_LANE_W
  return Math.min(LANE_W_MAX, Math.max(LANE_W_MIN, n))
}
const laneW = ref<number>(loadLaneW())
watch(laneW, (v) => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LANE_W_KEY, String(v))
  } catch {
    /* ignore */
  }
})

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const rows = computed<GraphRow[]>(() => graph.value?.rows ?? [])
const maxLane = computed(() => graph.value?.maxLane ?? 1)
const graphWidth = computed(() => Math.max(1, maxLane.value) * laneW.value + 16)

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
      const lw = laneW.value
      const x = lane * lw + lw / 2
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
      const lw = laneW.value
      const fromX = row.lane * lw + lw / 2
      for (const pl of row.parentLanes) {
        const toX = pl * lw + lw / 2
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
          ctx.bezierCurveTo(fromX, y + ROW_H / 2, toX, nextY - ROW_H / 2, toX, nextY)
        }
        ctx.stroke()
      }
    }

    // 3. node circle (이 commit 의 lane)
    const lw3 = laneW.value
    const cx = row.lane * lw3 + lw3 / 2
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
watch([rows, maxLane, virtualItems, laneW], () => nextTick(() => drawGraph()))
import { onUnmounted } from 'vue'
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

function onScroll() {
  drawGraph()
}

function formatDate(unix: number): string {
  return formatDateLocalized(unix, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const emit = defineEmits<{
  selectCommit: [sha: string]
  showDiff: [sha: string]
  compareWith: [sha: string]
  explainAi: [sha: string]
  openInForge: [sha: string]
}>()
const selectedSha = ref<string | null>(null)
function selectRow(r: GraphRow) {
  selectedSha.value = r.commit.sha
  emit('selectCommit', r.commit.sha)
}

// === Sprint 22-2 CM-1: row 우클릭 메뉴 ===
const ctxMenu = useTemplateRef<ContextMenuExpose>('ctxMenu')
const commitActions = useCommitActions(() => props.repoId)

// === Sprint 22-3 V-1: row 더블클릭 → CommitDiffModal auto-open ===
function onRowDblClick(row: GraphRow | undefined) {
  if (!row) return
  selectedSha.value = row.commit.sha
  emit('selectCommit', row.commit.sha)
  emit('showDiff', row.commit.sha)
}

function onRowContextMenu(ev: MouseEvent, row: GraphRow | undefined) {
  if (!row) return
  ev.preventDefault()
  const sha = row.commit.sha
  selectedSha.value = sha
  emit('selectCommit', sha)
  ctxMenu.value?.openAt(
    ev,
    commitActions.buildItems(sha, {
      onShowDiff: (s) => emit('showDiff', s),
      onCompare: (s) => emit('compareWith', s),
      onExplainAi: (s) => emit('explainAi', s),
      onOpenInForge: (s) => emit('openInForge', s),
    }),
  )
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

// === 컬럼 토글 / 재정렬 (Sprint A3) ===
const cols = useCommitColumns()
const headerMenuOpen = ref(false)
const headerMenuRef = ref<HTMLDivElement | null>(null)

function openHeaderMenu(ev: MouseEvent) {
  ev.preventDefault()
  headerMenuOpen.value = true
}

function onHeaderMenuOutside(ev: MouseEvent) {
  if (!headerMenuRef.value) return
  if (!headerMenuRef.value.contains(ev.target as Node)) {
    headerMenuOpen.value = false
  }
}

watch(headerMenuOpen, (open) => {
  if (open) {
    nextTick(() => {
      window.addEventListener('mousedown', onHeaderMenuOutside)
    })
  } else {
    window.removeEventListener('mousedown', onHeaderMenuOutside)
  }
})

// drag-drop 의 v-model 은 visibleColumns 의 mutated 배열.
// VueDraggable 이 array 를 in-place 변경하므로 setOrder 호출.
const headerOrder = ref<CommitColumnId[]>(cols.visibleIds.value.slice())
watch(cols.visibleIds, (ids) => {
  headerOrder.value = ids.slice()
})
function onReorder() {
  cols.setOrder(headerOrder.value)
}

// header 메뉴 "기본값 복원" — prettier 가 vue template 의 multi-statement 를
// 깨뜨려 (semicolon → newline) parse 에러 일으키는 회귀 방지용 함수 추출.
function resetColsAndCloseMenu() {
  cols.reset()
  headerMenuOpen.value = false
}

function colDef(id: CommitColumnId) {
  return cols.allColumns.find((c) => c.id === id)
}

// === Sprint C5 — Lane drag-resize ===
let dragStartX = 0
let dragStartLaneW = 16
let dragging = false

function onDragHandleStart(ev: MouseEvent) {
  ev.preventDefault()
  dragging = true
  dragStartX = ev.clientX
  dragStartLaneW = laneW.value
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragEnd)
}

function onDragMove(ev: MouseEvent) {
  if (!dragging) return
  const dx = ev.clientX - dragStartX
  // maxLane 가 1 이면 dx 1 = laneW 1 변화. maxLane 가 5 면 dx 5 = laneW 1.
  const denom = Math.max(1, maxLane.value)
  const next = Math.round(dragStartLaneW + dx / denom)
  laneW.value = Math.min(36, Math.max(8, next))
}

function onDragEnd() {
  dragging = false
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
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
            aria-label="검색 닫기"
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
          aria-label="commit 검색 열기 (⌘F / Ctrl+F)"
          @click="openSearch"
        >
          🔍
        </button>
        <span v-if="isFetching" class="text-xs text-muted-foreground">불러오는 중...</span>
      </div>
    </header>

    <!-- 컬럼 헤더 (drag reorder + 우클릭 토글 메뉴) -->
    <div
      class="relative flex items-center border-b border-border bg-muted/40 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground"
      @contextmenu="openHeaderMenu"
    >
      <!-- 그래프 sticky 좌측 placeholder -->
      <span
        :style="{ width: graphWidth + 'px', flexShrink: 0 }"
        class="cursor-context-menu select-none"
        title="컬럼 토글: 우클릭"
      >
        Graph
      </span>
      <VueDraggable
        v-model="headerOrder"
        tag="div"
        class="flex flex-1 items-center gap-2 px-2"
        :animation="120"
        handle=".col-grip"
        @update="onReorder"
      >
        <span
          v-for="id in headerOrder"
          :key="id"
          :class="[colDef(id)?.widthClass, 'col-grip cursor-grab select-none truncate']"
          :title="`${colDef(id)?.label} — drag 로 순서 변경, 우클릭으로 토글`"
        >
          {{ colDef(id)?.label }}
        </span>
      </VueDraggable>

      <!-- 우클릭 메뉴 -->
      <div
        v-if="headerMenuOpen"
        ref="headerMenuRef"
        class="absolute right-2 top-full z-20 mt-1 w-44 rounded-md border border-border bg-card text-xs shadow-lg"
      >
        <ul class="py-1">
          <li
            v-for="c in cols.allColumns"
            :key="c.id"
            class="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-accent/40"
            @click="cols.toggle(c.id)"
          >
            <span class="w-3 text-center">
              {{ cols.isVisible(c.id) ? '✓' : '' }}
            </span>
            <span class="flex-1">{{ c.label }}</span>
          </li>
          <li class="border-t border-border" />
          <li
            class="cursor-pointer px-3 py-1.5 text-muted-foreground hover:bg-accent/40"
            @click="resetColsAndCloseMenu"
          >
            기본값 복원
          </li>
        </ul>
      </div>
    </div>

    <div ref="containerRef" class="relative flex-1 overflow-auto" @scroll="onScroll">
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
        <!-- Sprint C5 — Lane drag-resize handle -->
        <div
          :style="{
            position: 'sticky',
            top: 0,
            left: graphWidth - 2 + 'px',
            width: '4px',
            height: '100%',
            zIndex: 2,
            cursor: 'col-resize',
          }"
          class="hover:bg-primary/40 transition-colors"
          title="드래그로 그래프 폭 조절"
          @mousedown="onDragHandleStart"
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
            selectedSha === rows[v.index]?.commit.sha ? 'bg-accent text-accent-foreground' : '',
            searchQuery && rows[v.index] && !isMatch(rows[v.index], searchQuery)
              ? 'opacity-25'
              : '',
          ]"
          :data-testid="`commit-row-${rows[v.index]?.commit.sha?.slice(0, 7) ?? `idx-${v.index}`}`"
          draggable="true"
          @dragstart="
            (ev: DragEvent) => {
              const sha = rows[v.index]?.commit.sha
              if (sha && ev.dataTransfer) {
                ev.dataTransfer.setData('application/x-git-fried-commit', sha)
                ev.dataTransfer.effectAllowed = 'copy'
              }
            }
          "
          @click="selectRow(rows[v.index])"
          @dblclick="onRowDblClick(rows[v.index])"
          @contextmenu="onRowContextMenu($event, rows[v.index])"
        >
          <template v-for="col in cols.visibleColumns.value" :key="col.id">
            <!-- sha -->
            <span
              v-if="col.id === 'sha'"
              :class="[col.widthClass, 'truncate font-mono text-xs text-muted-foreground']"
            >
              {{ rows[v.index]?.commit.shortSha }}
            </span>
            <!-- message + refs -->
            <span v-else-if="col.id === 'message'" :class="[col.widthClass, 'truncate']">
              {{ rows[v.index]?.commit.subject }}
              <template v-for="r in rows[v.index]?.commit.refs ?? []" :key="r">
                <span
                  v-if="visibleRef(r)"
                  class="ref-pill ml-1.5 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px]"
                  :class="
                    soloRef === r
                      ? 'bg-orange-500/20 text-orange-500 ring-1 ring-orange-500/40'
                      : 'bg-muted text-muted-foreground'
                  "
                >
                  <button
                    type="button"
                    class="ref-pill-body cursor-pointer hover:underline"
                    :title="
                      soloRef === r
                        ? `Solo 해제: ${r}`
                        : `이 ref 만 표시 (Solo): ${r}\n🙈 = 그래프에서 숨김`
                    "
                    :aria-label="soloRef === r ? `'${r}' Solo 해제` : `'${r}' 만 그래프에 표시`"
                    @click.stop="toggleSoloRef(r)"
                  >
                    {{ r }}
                  </button>
                  <button
                    type="button"
                    class="ref-pill-hide opacity-0 transition-opacity hover:text-foreground"
                    :title="`그래프에서 숨김: ${r}`"
                    :aria-label="`'${r}' 그래프에서 숨김`"
                    @click.stop="hideRefByName(r)"
                  >
                    🙈
                  </button>
                </span>
              </template>
            </span>
            <!-- author -->
            <span
              v-else-if="col.id === 'author'"
              :class="[col.widthClass, 'truncate text-xs text-muted-foreground']"
            >
              {{ rows[v.index]?.commit.authorName }}
            </span>
            <!-- date -->
            <span
              v-else-if="col.id === 'date'"
              :class="[col.widthClass, 'text-xs text-muted-foreground']"
            >
              {{ formatDate(rows[v.index]?.commit.authorAt ?? 0) }}
            </span>
            <!-- signed -->
            <span
              v-else-if="col.id === 'signed'"
              :class="[col.widthClass, 'text-xs']"
              :title="rows[v.index]?.commit.signed ? 'GPG 서명' : ''"
            >
              <span v-if="rows[v.index]?.commit.signed" class="text-emerald-500">✓</span>
            </span>
          </template>
        </div>
      </div>
    </div>
    <ContextMenu ref="ctxMenu" />
  </div>
</template>

<style scoped>
/* Sprint K — branch ref hover 시에만 🙈 노출. */
.ref-pill:hover .ref-pill-hide {
  opacity: 1;
}
</style>
