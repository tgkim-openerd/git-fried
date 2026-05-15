<script setup lang="ts">
// 커밋 그래프 + 로그 테이블 통합 컴포넌트.
// 좌측: Canvas 로 그래프 (pvigier straight-lane), 우측: 가상 스크롤 메타.
//
// 디자인:
//  - row 높이 28px 고정
//  - lane 폭 16px
//  - 노드 원 6px, 엣지 stroke 1.5px
//  - 8개 stable color (브랜치 hash)
// Sprint c48 Wave B-2 — script 227 LOC → ~110 LOC. WIP+virtualizer 와 row interaction 을
// useCommitGraphRows / useCommitGraphInteraction 으로 분리.
import { computed, ref, useTemplateRef, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { VueDraggable } from 'vue-draggable-plus'
import { useGraph } from '@/composables/useGraph'
import { useGraphRefVisibility } from '@/composables/useGraphRefVisibility'
import { useCommitGraphHeader } from '@/composables/useCommitGraphHeader'
import { useCommitActions } from '@/composables/useCommitActions'
import { useGraphSearch } from '@/composables/useGraphSearch'
import { useGraphWidth, ROW_H } from '@/composables/useGraphWidth'
import { useGraphSelection } from '@/composables/useGraphSelection'
import { useGraphCanvasRenderer } from '@/composables/useGraphCanvasRenderer'
import { useCommitGraphRows } from '@/composables/useCommitGraphRows'
import { useCommitGraphInteraction } from '@/composables/useCommitGraphInteraction'
// Sprint c65 — presentation helpers (bodyFirstLine / refPillClass / authorInitial / authorAvatarBg).
import { useCommitGraphPresentation } from '@/composables/useCommitGraphPresentation'
// Sprint c75-A — god comp 회귀 해소 (c74 +48 LOC 영역 분리).
import { useGraphInfiniteScroll, GRAPH_LIMIT_STEP } from '@/composables/useGraphInfiniteScroll'
import { useCommitGraphSelection } from '@/composables/useCommitGraphSelection'
// Sprint c78-A — c76 +5 LOC 회귀 해소 (sticky overlay 좌표 + lifecycle 분리).
import {
  useCommitGraphStickyLayout,
  HANDLE_WIDTH,
  INNER_DIVIDER_WIDTH,
  INNER_DIVIDER_LEFT,
} from '@/composables/useCommitGraphStickyLayout'
import {
  useCommitGraphLifecycle,
  useGlobalCommitJumpHook,
} from '@/composables/useCommitGraphLifecycle'
import ContextMenu, { type ContextMenuExpose } from './ContextMenu.vue'
import SkeletonBlock from './SkeletonBlock.vue'
import CommitRefPill from './CommitRefPill.vue'
import type { GraphRow } from '@/api/git'

const { t } = useI18n()

const props = defineProps<{
  repoId: number | null
  /** Sprint c30 / GitKraken UX (Phase 8a) — '__WIP__' 선택 시 WIP row 활성 highlight. */
  selectedWip?: boolean
}>()

const emit = defineEmits<{
  selectCommit: [sha: string]
  /** Sprint c30 / GitKraken UX (Phase 8a) — WIP row click. */
  selectWip: []
  showDiff: [sha: string]
  compareWith: [sha: string]
  explainAi: [sha: string]
  openInForge: [sha: string]
}>()

// Sprint c75-A — 무한 스크롤 (useGraphInfiniteScroll 분리). graphLimit 은 useGraph 가 필요로
// 하므로 caller 가 ref 로 만들어 주입 (Pattern 9 caller-decision).
const graphLimit = ref(GRAPH_LIMIT_STEP)
const { data: graph, isFetching } = useGraph(() => props.repoId, graphLimit)
const { visibleRef, soloRef, toggleSoloRef, hideRefByName, refKindOf } = useGraphRefVisibility(
  () => props.repoId,
)

// Sprint c51 — GitKraken parity Minor (body 첫 줄 / ref-pill 색 / avatar) — c65 useCommitGraphPresentation 위임.
// c73 ARCH-002 — getter 패턴 마이그 (family 일관).
const { bodyFirstLine, refPillClass, authorInitial, authorAvatarBg } = useCommitGraphPresentation({
  soloRef: () => soloRef.value,
  refKindOf,
})

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const rows = computed<GraphRow[]>(() => graph.value?.rows ?? [])
const maxLane = computed(() => graph.value?.maxLane ?? 1)

// Sprint c37 god 18/N — graphWidth + laneW + zoom + drag handle composable.
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

// c48 Wave B-2 — WIP/virtualizer/commitRowAt/Tooltip + c76 wipRowCount SOT.
const cgRows = useCommitGraphRows({ repoId: () => props.repoId, rows, containerRef })
const { wipActive, wipRowCount, wipChangeCount, virtualItems, totalHeight } = cgRows
const { commitRowAt, commitTooltip } = cgRows

// Sprint c31 — 검색 composable. drawGraph 는 hoisting 으로 callback 안전.
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

// Sprint c40 — canvas 렌더링 + WIP idx 판정.
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

// Sprint c75-A — 무한 스크롤 onScroll 추출.
const { onScroll } = useGraphInfiniteScroll({
  graphLimit,
  containerRef,
  rows,
  isFetching,
  onScrollSideEffect: () => drawGraph(),
})

// Sprint c37 god 19/N — selectedSha + moveSelection (vim J/K) + selectWip.
const { selectedSha, selectRow, selectWipRow, moveSelection } = useGraphSelection({
  rows,
  containerRef,
  onSelectCommit: (sha) => emit('selectCommit', sha),
  onSelectWip: () => emit('selectWip'),
  rowHeight: ROW_H,
})

// 22-2/22-3 row 우클릭 / 더블클릭. c48 Wave B-2 분리. moveSelection unused void.
const ctxMenu = useTemplateRef<ContextMenuExpose>('ctxMenu')
const commitActions = useCommitActions(() => props.repoId)
const { onRowDblClick, onRowContextMenu, formatDate } = useCommitGraphInteraction({
  selectedSha,
  ctxMenu,
  commitActions,
  emit,
})

// c75-A: sha jump (외부 진입점). c76: wipRowCount SOT (Pattern 13 sister).
const { selectAndScrollToSha } = useCommitGraphSelection({
  rows,
  containerRef,
  wipRowCount,
  rowHeight: ROW_H,
  selectRow,
  onScrollComplete: () => drawGraph(),
})

// c78-A lifecycle (mount/watch repoId/unmount). c79 ARCH-002: MaybeRefOrGetter family.
useCommitGraphLifecycle({
  containerRef,
  repoIdRef: () => props.repoId,
  draw: drawGraph,
  onKeydown,
  cleanup: cleanupGraphWidth,
})
// c79 ARCH-003 — window.gitFriedSelectCommit 등록 단일책임 분리.
useGlobalCommitJumpHook(selectAndScrollToSha)
watch([rows, maxLane, virtualItems, laneW, wipActive], () => nextTick(() => drawGraph()))

// Sprint A3 / c40 review ARCH-004 — 컬럼 토글 / 재정렬 + header menu.
// Sprint c52 — branchTagSticky (branchTag visible + 첫 위치) 활성 시 sticky overlay column 노출.
const {
  cols,
  headerMenuOpen,
  headerMenuRef,
  headerOrder,
  branchTagColumnVisible,
  branchTagSticky,
  openHeaderMenu,
  onReorder,
  resetColsAndCloseMenu,
  colDef,
} = useCommitGraphHeader()

// c52/c51 #5 + c78-A: branch chip sticky overlay 좌표 (useCommitGraphStickyLayout SOT 위임).
const { branchChipStickyWidth, branchChipStickyLeft } = useCommitGraphStickyLayout({
  graphWidth,
  allColumns: () => cols.allColumns,
})

// template-ref / unused-but-used markers (vue-tsc TS6133 회피, 런타임 영향 0).
void [searchInputRef, moveSelection, headerMenuRef]
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
      <h2 class="text-sm font-semibold">{{ t('commitGraph.title') }}</h2>
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
        <span v-if="isFetching" class="text-xs text-muted-foreground">{{
          t('commitGraph.loading')
        }}</span>
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
      <!-- Sprint c54 — rows 첫 로딩 시 skeleton placeholder (Issue 2). isFetching 이지만
           graph.value 가 아직 undefined 또는 rows 0 인 시점에 빈 영역 대신 시각적 안정. -->
      <div
        v-if="isFetching && rows.length === 0"
        class="px-4 py-3"
        data-testid="commit-graph-skeleton"
      >
        <SkeletonBlock :count="12" height="md" :width-range="[40, 90]" />
      </div>
      <!-- 가상 height -->
      <div v-else :style="{ height: totalHeight + 'px', position: 'relative' }">
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
            left: graphWidth - HANDLE_WIDTH / 2 + 'px',
            width: HANDLE_WIDTH + 'px',
            height: '100%',
            zIndex: 2,
            cursor: 'col-resize',
          }"
          class="group transition-colors"
          :title="t('templ.graphResizeHandle')"
          aria-label="Resize graph width"
          role="separator"
          tabindex="0"
          @mousedown="onDragHandleStart"
          @keydown.left.prevent="zoomOut"
          @keydown.right.prevent="zoomIn"
        >
          <!-- Sprint c46 UX-10 — handle hit area 4px → 12px, visual marker 1px (inner ghost divider) -->
          <!-- Sprint c52 ARCH-009 — left/width 매직넘버 → INNER_DIVIDER_* SOT derive -->
          <div
            :style="{
              position: 'absolute',
              top: 0,
              left: INNER_DIVIDER_LEFT + 'px',
              width: INNER_DIVIDER_WIDTH + 'px',
              height: '100%',
              pointerEvents: 'none',
            }"
            class="bg-transparent group-hover:bg-primary/60 transition-colors"
          />
        </div>
        <!-- Sprint c52 / c51 보류 #5 — branch chip sticky-left overlay column.
             branchTagSticky (branchTag visible + 첫 위치) 시 활성. 가로 스크롤 시 좌측 고정.
             기존 commit row 의 branchTag column 은 placeholder (width 만 유지) 로 변경 (아래 v-if).
             pointerEvents: 'none' 로 overlay 자체는 click 통과, 안의 chip 만 'auto' 로 처리.
             z-index 3 = canvas(1) + handle(2) 보다 위.

             [DEAD until c54+ sticky redesign] — Sprint c54 (사용자 보고 회귀):
             `position: sticky + top: 0 + height: 100%` 와 virtualizer children `top: v.start`
             좌표 mismatch → chip 잘못된 위치 또는 0건. branchTagSticky 강제 false 로 임시 폐기
             (useCommitGraphHeader.ts:33-44 주석 참조). c54+ 재설계 시 활성 조건 복원. -->
        <div
          v-if="branchTagSticky"
          :style="{
            position: 'sticky',
            top: 0,
            left: branchChipStickyLeft + 'px',
            width: branchChipStickyWidth + 'px',
            height: '100%',
            zIndex: 3,
            pointerEvents: 'none',
          }"
          class="bg-background/0"
          data-testid="branch-chip-sticky-overlay"
        >
          <template v-for="v in virtualItems" :key="`stk-${v.index}`">
            <div
              v-if="!isWipIdx(v.index)"
              :style="{
                position: 'absolute',
                top: v.start + 'px',
                left: 0,
                width: '100%',
                height: ROW_H + 'px',
                pointerEvents: 'auto',
              }"
              class="flex items-center gap-1 overflow-hidden bg-background/95 px-2"
            >
              <template v-for="r in commitRowAt(v.index)?.commit.refs ?? []" :key="`stk-r-${r}`">
                <CommitRefPill
                  v-if="visibleRef(r)"
                  :name="r"
                  :solo-ref="soloRef"
                  :pill-class="refPillClass(r)"
                  @solo="toggleSoloRef"
                  @hide="hideRefByName"
                />
              </template>
            </div>
          </template>
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
          <!-- PR-B.2 보류: v-memo 는 v-for 와 같은 element 에만 가능 (vue/valid-v-memo).
               virtualizer outer <template v-for> 안의 v-if/v-else 분기 둘 다 v-memo 적용
               불가. 별도 sprint 에서 outer wrapper div + branch 통합 구조로 재설계 후 적용. -->
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
              <!-- branchTag (Phase 13-4 — GitKraken parity 별도 컬럼).
                   Sprint c52 — branchTagSticky 시 sticky overlay (위) 가 chip 책임,
                   여기는 width placeholder 만 (layout 보존, chip 중복 방지). -->
              <span
                v-if="col.id === 'branchTag' && branchTagSticky"
                :class="[col.widthClass]"
                aria-hidden="true"
              />
              <span
                v-else-if="col.id === 'branchTag'"
                :class="[col.widthClass, 'flex items-center gap-1 overflow-hidden']"
              >
                <template v-for="r in commitRowAt(v.index)?.commit.refs ?? []" :key="r">
                  <CommitRefPill
                    v-if="visibleRef(r)"
                    :name="r"
                    :solo-ref="soloRef"
                    :pill-class="refPillClass(r)"
                    @solo="toggleSoloRef"
                    @hide="hideRefByName"
                  />
                </template>
              </span>
              <!-- sha -->
              <span
                v-else-if="col.id === 'sha'"
                :class="[col.widthClass, 'truncate font-mono text-xs text-muted-foreground']"
              >
                {{ commitRowAt(v.index)?.commit.shortSha }}
              </span>
              <!-- message + body 첫 줄 회색 inline (Sprint c51 GitKraken parity) + (refs only when branchTag column hidden — backward compat) -->
              <span
                v-else-if="col.id === 'message'"
                :class="[col.widthClass, 'truncate']"
                :title="commitTooltip(commitRowAt(v.index))"
              >
                {{ commitRowAt(v.index)?.commit.subject }}
                <span
                  v-if="bodyFirstLine(commitRowAt(v.index)?.commit.body)"
                  class="ml-2 text-[11px] text-muted-foreground/70"
                >
                  {{ bodyFirstLine(commitRowAt(v.index)?.commit.body) }}
                </span>
                <template v-if="!branchTagColumnVisible">
                  <template v-for="r in commitRowAt(v.index)?.commit.refs ?? []" :key="r">
                    <CommitRefPill
                      v-if="visibleRef(r)"
                      :name="r"
                      :solo-ref="soloRef"
                      :pill-class="refPillClass(r)"
                      extra-class="ml-1.5"
                      :shrink="false"
                      @solo="toggleSoloRef"
                      @hide="hideRefByName"
                    />
                  </template>
                </template>
              </span>
              <!-- author + Sprint c51 avatar prefix (initial-letter mini circle, hash-color) -->
              <span
                v-else-if="col.id === 'author'"
                :class="[
                  col.widthClass,
                  'flex items-center gap-1.5 truncate text-xs text-muted-foreground',
                ]"
              >
                <span
                  class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-semibold text-white"
                  :class="[
                    authorAvatarBg(commitRowAt(v.index)?.commit.authorName),
                    /* c58 P3-5 보강 — 한글 2글자 시 font 축소 + tracking-tight (w-4 14px fit) */
                    authorInitial(commitRowAt(v.index)?.commit.authorName).length >= 2
                      ? 'text-[7px] tracking-tighter'
                      : 'text-[9px]',
                  ]"
                  :title="commitRowAt(v.index)?.commit.authorEmail || ''"
                  aria-hidden="true"
                >
                  {{ authorInitial(commitRowAt(v.index)?.commit.authorName) }}
                </span>
                <span class="truncate">{{ commitRowAt(v.index)?.commit.authorName }}</span>
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

<!-- Sprint c89-A — .ref-pill / .ref-pill-hide hover 룰은 CommitRefPill.vue 로 이주. -->
