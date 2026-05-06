<script setup lang="ts">
// 커밋 그래프 + 로그 테이블 통합 컴포넌트.
// 좌측: Canvas 로 그래프 (pvigier straight-lane), 우측: 가상 스크롤 메타.
//
// 디자인:
//  - row 높이 28px 고정
//  - lane 폭 16px
//  - 노드 원 6px, 엣지 stroke 1.5px
//  - 8개 stable color (브랜치 hash)
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVirtualizer } from '@tanstack/vue-virtual'

const { t } = useI18n()
import { VueDraggable } from 'vue-draggable-plus'
import { useGraph } from '@/composables/useGraph'
// Sprint c30 / GitKraken UX (Phase 8a) — graph 첫 row 에 WIP pseudo-row 직접 통합.
import { useStatus } from '@/composables/useStatus'
// Sprint c40 후속 review ARCH-004 — ref visibility (hide/solo) 분리.
import { useGraphRefVisibility } from '@/composables/useGraphRefVisibility'
// Sprint c40 후속 review ARCH-004 — column 토글/재정렬 + header menu 분리.
import { useCommitGraphHeader } from '@/composables/useCommitGraphHeader'
import { useCommitActions } from '@/composables/useCommitActions'
// Sprint c31 god comp 분리 7/N — 검색 state + isMatch + ⌘F/Esc 통합 composable.
import { useGraphSearch } from '@/composables/useGraphSearch'
// Sprint c37 god 18/N — graphWidth + laneW + zoom + drag handle 분리.
import { useGraphWidth, ROW_H } from '@/composables/useGraphWidth'
// Sprint c37 god 19/N — selectedSha + vim nav 분리.
import { useGraphSelection } from '@/composables/useGraphSelection'
// Sprint c40 god comp 분리 — canvas 렌더링 (palette + laneColor + drawGraph) 분리.
import { useGraphCanvasRenderer } from '@/composables/useGraphCanvasRenderer'
import { formatDateLocalized } from '@/composables/useUserSettings'
import ContextMenu, { type ContextMenuExpose } from './ContextMenu.vue'
import type { GraphRow } from '@/api/git'

const props = defineProps<{
  repoId: number | null
  /** Sprint c30 / GitKraken UX (Phase 8a) — '__WIP__' 선택 시 WIP row 활성 highlight. */
  selectedWip?: boolean
}>()
const { data: graph, isFetching } = useGraph(() => props.repoId, 500)
// Sprint c30 / GitKraken UX (Phase 8a) — working dir dirty 감지.
const { data: status } = useStatus(() => props.repoId)
const wipActive = computed(() => !!status.value && !status.value.isClean)
const wipChangeCount = computed(() => {
  const s = status.value
  if (!s) return 0
  return s.staged.length + s.unstaged.length + s.untracked.length + s.conflicted.length
})

/**
 * virtualizer index → row 매핑.
 * wipActive 시 idx=0 는 WIP, idx=1+ 는 rows[idx-1].
 * 그 외 (clean) idx 그대로 rows[idx].
 * isWipIdx 는 useGraphCanvasRenderer composable 에서 destructure (아래).
 */
function commitRowAt(idx: number): GraphRow | null {
  if (isWipIdx(idx)) return null
  const offset = wipActive.value ? idx - 1 : idx
  return rows.value[offset] ?? null
}
function commitTooltip(row: GraphRow | null | undefined): string {
  if (!row) return ''
  const subject = row.commit.subject ?? ''
  const body = (row.commit.body ?? '').trim()
  return body ? `${subject}\n\n${body}` : subject
}
// Sprint c40 후속 review ARCH-004 — ref hide/solo composable 위임.
const { visibleRef, soloRef, toggleSoloRef, hideRefByName } = useGraphRefVisibility(
  () => props.repoId,
)

// === 검색 — Sprint c31 분리 7/N. composable 호출은 rows 정의 이후 (TDZ 회피) — line ~137 부근. ===

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const rows = computed<GraphRow[]>(() => graph.value?.rows ?? [])
const maxLane = computed(() => graph.value?.maxLane ?? 1)

// Sprint c37 god 18/N — graphWidth + laneW + zoom + drag handle composable.
//   graphWidth state (localStorage 영속) / laneW 자동 계산 / zoomIn,Out / onDragHandleStart.
const {
  graphWidth,
  laneW,
  zoomOutDisabled,
  zoomInDisabled,
  zoomIn,
  zoomOut,
  onDragHandleStart,
  cleanup: cleanupGraphWidth,
} = useGraphWidth(maxLane)

// === 검색 (Sprint c31 god comp 분리 7/N — useGraphSearch composable) ===
// v0.x 단계: 현재 그래프 (최대 500 commits) 내에서 subject / author / sha / refs 부분일치.
// FTS5 인덱싱은 v1.0 (Cross-repo + 5000+ commits 시).
// drawGraph 는 function declaration (hoisting 됨) 이라 callback 으로 안전하게 참조.
const {
  searchQuery,
  searchOpen,
  searchInputRef,
  matchCount,
  isMatch,
  openSearch,
  closeSearch,
  onKeydown,
} = useGraphSearch(rows, { onClose: () => drawGraph() })

// Sprint c30 / GitKraken UX (Phase 8a) — wipActive 시 virtualizer count + 1.
// Sprint c45 PERF-2 — overscan 동적: 5000+ commits 시 stutter 감소 (12 → 최대 24).
//   기준: 1000 미만 12 / 1000~3000 16 / 3000~5000 20 / 5000+ 24.
//   소규모 repo 는 메모리 경량, 대규모는 스크롤 평탄화.
const dynamicOverscan = computed(() => {
  const n = rows.value.length
  if (n < 1000) return 12
  if (n < 3000) return 16
  if (n < 5000) return 20
  return 24
})
const virtualizer = useVirtualizer(
  computed(() => ({
    count: rows.value.length + (wipActive.value ? 1 : 0),
    getScrollElement: () => containerRef.value,
    estimateSize: () => ROW_H,
    overscan: dynamicOverscan.value,
  })),
)
const virtualItems = computed(() => virtualizer.value.getVirtualItems())
const totalHeight = computed(() => virtualizer.value.getTotalSize())

// Sprint c40 — canvas 렌더링 + WIP idx 판정 composable 위임.
const { drawGraph, isWipIdx } = useGraphCanvasRenderer({
  canvasRef,
  containerRef,
  virtualItems,
  rows,
  laneW,
  graphWidth,
  wipActive,
  rowHeight: ROW_H,
})

onMounted(() => {
  nextTick(() => drawGraph())
  window.addEventListener('keydown', onKeydown)
})
watch([rows, maxLane, virtualItems, laneW, wipActive], () => nextTick(() => drawGraph()))
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
  /** Sprint c30 / GitKraken UX (Phase 8a) — WIP row click. */
  selectWip: []
  showDiff: [sha: string]
  compareWith: [sha: string]
  explainAi: [sha: string]
  openInForge: [sha: string]
}>()

// Sprint c37 god 19/N — selectedSha + moveSelection (vim J/K) + selectWip composable.
const { selectedSha, selectRow, selectWipRow, moveSelection } = useGraphSelection({
  rows,
  containerRef,
  onSelectCommit: (sha) => emit('selectCommit', sha),
  onSelectWip: () => emit('selectWip'),
  rowHeight: ROW_H,
})

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
// moveSelection 은 useGraphSelection 에서 노출 — 사용 안 한 변수 lint 회피용.
void moveSelection

// === 컬럼 토글 / 재정렬 (Sprint A3) — useCommitGraphHeader 위임 (c40 review ARCH-004) ===
const {
  cols,
  headerMenuOpen,
  headerMenuRef,
  headerOrder,
  branchTagColumnVisible,
  openHeaderMenu,
  onReorder,
  resetColsAndCloseMenu,
  colDef,
} = useCommitGraphHeader()

// Sprint c37 god 18/N — drag-resize 로직은 useGraphWidth composable 위임.
//   onDragHandleStart 는 위에서 destructure, cleanup 은 unmount 시.
onUnmounted(() => cleanupGraphWidth())
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
      <h2 class="text-sm font-semibold">커밋 그래프</h2>
      <div class="flex flex-1 items-center justify-end gap-2">
        <!-- Phase 1 (plan-commit-graph-ux v2) — Zoom +/- button. drag handle 보완. -->
        <div
          class="flex items-center gap-0.5 rounded border border-border bg-muted/40 p-0.5"
          title="그래프 lane 폭 조절 (drag handle 보완)"
        >
          <button
            type="button"
            class="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent/40 hover:text-foreground disabled:opacity-40"
            :disabled="zoomOutDisabled"
            :aria-label="`그래프 column 축소 (현재 width: ${graphWidth}px)`"
            @click="zoomOut"
          >
            −
          </button>
          <button
            type="button"
            class="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent/40 hover:text-foreground disabled:opacity-40"
            :disabled="zoomInDisabled"
            :aria-label="`그래프 column 확대 (현재 width: ${graphWidth}px)`"
            @click="zoomIn"
          >
            +
          </button>
        </div>
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
            left: graphWidth - 6 + 'px',
            width: '12px',
            height: '100%',
            zIndex: 2,
            cursor: 'col-resize',
          }"
          class="group transition-colors"
          :title="t('templ.graphResizeHandle')"
          aria-label="Resize graph width"
          role="separator"
          @mousedown="onDragHandleStart"
        >
          <!-- Sprint c46 UX-10 — handle hit area 4px → 12px, visual marker 1px (inner ghost divider) -->
          <div
            :style="{
              position: 'absolute',
              top: 0,
              left: '5px',
              width: '2px',
              height: '100%',
              pointerEvents: 'none',
            }"
            class="bg-transparent group-hover:bg-primary/60 transition-colors"
          />
        </div>
        <!-- Sprint c30 / GitKraken UX (Phase 8a) — virtualizer 의 idx=0 + wipActive = WIP row.
             그 외 idx → commitRowAt(idx) (wipActive 시 idx-1 offset). -->
        <template v-for="v in virtualItems" :key="`v-${v.index}`">
          <!-- WIP pseudo-row -->
          <div
            v-if="isWipIdx(v.index)"
            :style="{
              position: 'absolute',
              top: v.start + 'px',
              left: graphWidth + 'px',
              right: 0,
              height: ROW_H + 'px',
            }"
            class="flex cursor-pointer items-center gap-2 border-b border-border/40 px-2 text-xs transition-colors"
            :class="selectedWip ? 'bg-accent ring-1 ring-primary/40' : 'hover:bg-accent/30'"
            data-testid="wip-row"
            :title="`Working directory — ${wipChangeCount} change${wipChangeCount !== 1 ? 's' : ''}`"
            @click="selectWipRow"
          >
            <span class="font-mono text-muted-foreground">// WIP</span>
            <span
              v-if="wipChangeCount > 0"
              class="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-warning-amber"
            >
              {{ wipChangeCount }}
            </span>
            <span class="text-[10px] text-muted-foreground/70">
              (작업 중인 변경 — 클릭하면 우측 staging 패널)
            </span>
          </div>

          <!-- commit row -->
          <div
            v-else
            :style="{
              position: 'absolute',
              top: v.start + 'px',
              left: graphWidth + 'px',
              right: 0,
              height: ROW_H + 'px',
            }"
            class="flex cursor-pointer items-center gap-2 px-2 text-sm hover:bg-accent/40 transition-opacity"
            :class="[
              selectedSha === commitRowAt(v.index)?.commit.sha
                ? 'bg-accent text-accent-foreground'
                : '',
              searchQuery && commitRowAt(v.index) && isMatch(commitRowAt(v.index)!, searchQuery)
                ? 'bg-yellow-100 dark:bg-yellow-700/25 ring-1 ring-yellow-500/40'
                : '',
              searchQuery && commitRowAt(v.index) && !isMatch(commitRowAt(v.index)!, searchQuery)
                ? 'opacity-30 grayscale'
                : '',
            ]"
            :data-testid="`commit-row-${commitRowAt(v.index)?.commit.sha?.slice(0, 7) ?? `idx-${v.index}`}`"
            draggable="true"
            @dragstart="
              (ev: DragEvent) => {
                const sha = commitRowAt(v.index)?.commit.sha
                if (sha && ev.dataTransfer) {
                  ev.dataTransfer.setData('application/x-git-fried-commit', sha)
                  ev.dataTransfer.effectAllowed = 'copy'
                }
              }
            "
            @click="selectRow(commitRowAt(v.index))"
            @dblclick="onRowDblClick(commitRowAt(v.index) ?? undefined)"
            @contextmenu="onRowContextMenu($event, commitRowAt(v.index) ?? undefined)"
          >
            <template v-for="col in cols.visibleColumns.value" :key="col.id">
              <!-- branchTag (Phase 13-4 — GitKraken parity 별도 컬럼) -->
              <span
                v-if="col.id === 'branchTag'"
                :class="[col.widthClass, 'flex items-center gap-1 overflow-hidden']"
              >
                <template v-for="r in commitRowAt(v.index)?.commit.refs ?? []" :key="r">
                  <span
                    v-if="visibleRef(r)"
                    class="ref-pill inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px]"
                    :class="
                      soloRef === r
                        ? 'bg-orange-500/20 text-orange-700 dark:text-orange-500 ring-1 ring-orange-500/40'
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
              <!-- sha -->
              <span
                v-else-if="col.id === 'sha'"
                :class="[col.widthClass, 'truncate font-mono text-xs text-muted-foreground']"
              >
                {{ commitRowAt(v.index)?.commit.shortSha }}
              </span>
              <!-- message + (refs only when branchTag column hidden — backward compat) -->
              <span
                v-else-if="col.id === 'message'"
                :class="[col.widthClass, 'truncate']"
                :title="commitTooltip(commitRowAt(v.index))"
              >
                {{ commitRowAt(v.index)?.commit.subject }}
                <template v-if="!branchTagColumnVisible">
                  <template v-for="r in commitRowAt(v.index)?.commit.refs ?? []" :key="r">
                    <span
                      v-if="visibleRef(r)"
                      class="ref-pill ml-1.5 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px]"
                      :class="
                        soloRef === r
                          ? 'bg-orange-500/20 text-orange-700 dark:text-orange-500 ring-1 ring-orange-500/40'
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
                </template>
              </span>
              <!-- author -->
              <span
                v-else-if="col.id === 'author'"
                :class="[col.widthClass, 'truncate text-xs text-muted-foreground']"
              >
                {{ commitRowAt(v.index)?.commit.authorName }}
              </span>
              <!-- date -->
              <span
                v-else-if="col.id === 'date'"
                :class="[col.widthClass, 'text-xs text-muted-foreground']"
              >
                {{ formatDate(commitRowAt(v.index)?.commit.authorAt ?? 0) }}
              </span>
              <!-- signed -->
              <span
                v-else-if="col.id === 'signed'"
                :class="[col.widthClass, 'text-xs']"
                :title="commitRowAt(v.index)?.commit.signed ? 'GPG 서명' : ''"
              >
                <span v-if="commitRowAt(v.index)?.commit.signed" class="text-diff-add">✓</span>
              </span>
            </template>
          </div>
        </template>
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
