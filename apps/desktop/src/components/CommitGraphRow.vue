<script setup lang="ts">
// Sprint c103 (B-3) — CommitGraph 의 commit row(6 컬럼 switch)를 분리.
//
// virtualizer 의 v-else(=commit) 행 markup 을 그대로 흡수 (DOM-identical). ref-visibility
// state(soloRef/hiddenRefs)는 module 싱글톤 + vue-query 라 부모 sticky overlay 와 공유되며,
// 본 컴포넌트는 부모가 단일 인스턴스에서 unwrap 해 내린 fn/value(visibleRef/soloRef/
// refPillClass/toggleSoloRef/hideRefByName)를 prop 으로 받아 per-row composable 재호출을 피한다.
// bodyFirstLine/authorInitial/authorAvatarBg 는 순수 named export 라 직접 import.
//
// v-memo(virtualizer 행 re-render skip)는 outer wrapper div 재설계가 필요해 DOM 변경 →
// 본 추출(DOM-identical)과 분리, 별도 sprint (CommitGraph.vue 주석 PR-B.2 참조).
import { computed } from 'vue'
import type { GraphRow } from '@/api/git'
import type { CommitColumnDef } from '@/composables/useCommitColumns'
import {
  bodyFirstLine,
  authorInitial,
  authorAvatarBg,
} from '@/composables/useCommitGraphPresentation'

const props = defineProps<{
  /** commitRowAt(index) 결과 (null 가능) */
  row: GraphRow | null
  /** virtualizer index — testid fallback */
  index: number
  /** 위치/크기 (virtualizer + 그래프 폭) */
  top: number
  graphWidth: number
  rowHeight: number
  /** 선택/검색 하이라이트 (부모 selectedSha / searchQuery·isMatch 계산 결과) */
  selected: boolean
  searchActive: boolean
  matched: boolean
  /** 표시 컬럼 + branchTag sticky 여부 */
  columns: CommitColumnDef[]
  branchTagSticky: boolean
  /** 부모 계산 문자열 (commitTooltip(row) / formatDate(authorAt)) */
  tooltip: string
  date: string
  /** ref-visibility — 부모 단일 인스턴스에서 unwrap 전달 (반응성 보존) */
  visibleRef: (r: string) => boolean
  soloRef: string | null
  refPillClass: (r: string) => string
  toggleSoloRef: (r: string) => void
  hideRefByName: (r: string) => void
}>()

const emit = defineEmits<{ select: []; dblclick: []; contextmenu: [e: MouseEvent] }>()

// branchTag 컬럼이 visible 인지 (message 컬럼 내 inline ref fallback 판정).
const branchTagColumnVisible = computed(() => props.columns.some((c) => c.id === 'branchTag'))

// /verify 2026-06-04 — 좁은 branchTag 컬럼 ref 라벨 겹침 방지: 첫 N 개만 + "+K".
const MAX_REF_PILLS = 3
function shownRefs(refs: readonly string[] | undefined): string[] {
  return (refs ?? []).filter((r) => props.visibleRef(r)).slice(0, MAX_REF_PILLS)
}
function extraRefCount(refs: readonly string[] | undefined): number {
  const n = (refs ?? []).filter((r) => props.visibleRef(r)).length
  return Math.max(0, n - MAX_REF_PILLS)
}
function hiddenRefNames(refs: readonly string[] | undefined): string {
  return (refs ?? [])
    .filter((r) => props.visibleRef(r))
    .slice(MAX_REF_PILLS)
    .join('\n')
}

function onDragStart(ev: DragEvent) {
  const sha = props.row?.commit.sha
  if (sha && ev.dataTransfer) {
    ev.dataTransfer.setData('application/x-git-fried-commit', sha)
    ev.dataTransfer.effectAllowed = 'copy'
  }
}
</script>

<template>
  <div
    :style="{
      position: 'absolute',
      top: top + 'px',
      left: graphWidth + 'px',
      right: 0,
      height: rowHeight + 'px',
    }"
    class="flex cursor-pointer items-center gap-2 px-2 text-sm hover:bg-accent/40 transition-opacity"
    :class="[
      selected ? 'bg-accent text-accent-foreground' : '',
      searchActive && matched
        ? 'bg-yellow-100 dark:bg-yellow-700/25 ring-1 ring-yellow-500/40'
        : '',
      searchActive && !matched ? 'opacity-30 grayscale' : '',
    ]"
    :data-testid="`commit-row-${row?.commit.sha?.slice(0, 7) ?? `idx-${index}`}`"
    draggable="true"
    role="button"
    tabindex="0"
    @dragstart="onDragStart"
    @click="$emit('select')"
    @keydown.enter.self="$emit('select')"
    @keydown.space.self.prevent="$emit('select')"
    @dblclick="$emit('dblclick')"
    @contextmenu="$emit('contextmenu', $event)"
  >
    <template v-for="col in columns" :key="col.id">
      <!-- branchTag — sticky overlay 활성 시 width placeholder 만 (chip 중복 방지) -->
      <span
        v-if="col.id === 'branchTag' && branchTagSticky"
        :class="[col.widthClass]"
        aria-hidden="true"
      />
      <span
        v-else-if="col.id === 'branchTag'"
        :class="[col.widthClass, 'flex items-center gap-1 overflow-hidden']"
      >
        <CommitRefPill
          v-for="r in shownRefs(row?.commit.refs)"
          :key="r"
          :name="r"
          :solo-ref="soloRef"
          :pill-class="refPillClass(r)"
          @solo="toggleSoloRef"
          @hide="hideRefByName"
        />
        <span
          v-if="extraRefCount(row?.commit.refs) > 0"
          class="shrink-0 rounded bg-muted/50 px-1 py-0.5 text-3xs text-muted-foreground"
          :title="hiddenRefNames(row?.commit.refs)"
        >
          +{{ extraRefCount(row?.commit.refs) }}
        </span>
      </span>
      <!-- sha -->
      <span
        v-else-if="col.id === 'sha'"
        :class="[col.widthClass, 'truncate font-mono text-xs text-muted-foreground']"
      >
        {{ row?.commit.shortSha }}
      </span>
      <!-- message + body 첫 줄 회색 inline + (branchTag 컬럼 숨김 시 inline refs) -->
      <span v-else-if="col.id === 'message'" :class="[col.widthClass, 'truncate']" :title="tooltip">
        {{ row?.commit.subject }}
        <span v-if="bodyFirstLine(row?.commit.body)" class="ml-2 text-2xs text-muted-foreground/70">
          {{ bodyFirstLine(row?.commit.body) }}
        </span>
        <template v-if="!branchTagColumnVisible">
          <template v-for="r in row?.commit.refs ?? []" :key="r">
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
      <!-- author + avatar prefix (initial-letter mini circle, hash-color) -->
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
            authorAvatarBg(row?.commit.authorName),
            authorInitial(row?.commit.authorName).length >= 2
              ? 'text-[7px] tracking-tighter'
              : 'text-4xs',
          ]"
          :title="row?.commit.authorEmail || ''"
          aria-hidden="true"
        >
          {{ authorInitial(row?.commit.authorName) }}
        </span>
        <span class="truncate">{{ row?.commit.authorName }}</span>
      </span>
      <!-- date -->
      <span
        v-else-if="col.id === 'date'"
        :class="[col.widthClass, 'text-xs text-muted-foreground']"
      >
        {{ date }}
      </span>
      <!-- signed -->
      <span
        v-else-if="col.id === 'signed'"
        :class="[col.widthClass, 'text-xs']"
        :title="row?.commit.signed ? 'GPG 서명' : ''"
      >
        <span v-if="row?.commit.signed" class="text-diff-add">✓</span>
      </span>
    </template>
  </div>
</template>
