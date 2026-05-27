<script setup lang="ts">
// Hunk + Line-level stage / unstage — Sprint H (hunk) + N (line, `docs/plan/11 §7`).
//
// 단일 파일 diff 를 hunk 별 collapsible 표시. 각 hunk 마다:
//   - "✓ stage" / "✕ unstage" : hunk 전체 적용 (buildHunkPatch).
//   - 라인별 checkbox (+/- 만 선택 가능) → "선택 라인만 ✓ stage" / "선택만 ✕ unstage"
//     (buildLinePatch — context 변환 + count 재계산).
//   - shift-click 으로 range select.
//
// `git apply --cached [--reverse] -` 사용 (apply_patch IPC).
// Sprint c48 Wave B-3 — script 235 → ~85 LOC. mutations + handlers 를
// useHunkStageActions composable 로 분리.
import { ref, useTemplateRef } from 'vue'
import { describeError } from '@/api/errors'
import ContextMenu, { type ContextMenuExpose, type ContextMenuItem } from './ContextMenu.vue'
import BaseModal from './BaseModal.vue'
import { isStageableLine } from '@/utils/parseDiff'
import { useHunkStageActions } from '@/composables/useHunkStageActions'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  repoId: number | null
  path: string | null
  /** true 면 staged diff 기준으로 unstage, false 면 unstaged 기준으로 stage. */
  staged: boolean
  open: boolean
}>()
defineEmits<{ close: [] }>()

const {
  diffQuery,
  file,
  hunks,
  selected,
  isSelected,
  toggleLine,
  selectAllLines,
  clearLines,
  totalSelected,
  applyMut,
  restoreWtMut,
  applyHunk,
  applySelectedLines,
  restoreHunkToWorktree,
  applyAllHunks,
} = useHunkStageActions({
  repoId: () => props.repoId,
  path: () => props.path,
  staged: () => props.staged,
  open: () => props.open,
})

// === Sprint 22-2 CM-4: hunk row 우클릭 메뉴 ===
const ctxMenu = useTemplateRef<ContextMenuExpose>('ctxMenu')
function onHunkContextMenu(ev: MouseEvent, hIdx: number) {
  ev.preventDefault()
  const sel = selected.value.get(hIdx)
  const items: ContextMenuItem[] = [
    {
      label: props.staged ? t('hunkStage.ctxHunkUnstageAll') : t('hunkStage.ctxHunkStageAll'),
      icon: '✂',
      action: () => applyHunk(hIdx),
      disabled: applyMut.isPending.value,
    },
    {
      label: props.staged
        ? t('hunkStage.ctxSelectedLinesUnstage', { n: sel?.size ?? 0 })
        : t('hunkStage.ctxSelectedLinesStage', { n: sel?.size ?? 0 }),
      icon: '✓',
      action: () => applySelectedLines(hIdx),
      disabled: !sel?.size || applyMut.isPending.value,
    },
  ]
  // Sprint c38 / plan/29 E1 후속 — staged=false 모드만 hunk-level restore worktree 노출.
  // (staged 모드의 hunk 폐기는 의미 모호 — 인덱스+워킹트리 둘 다 영향, 별도 sprint)
  if (!props.staged) {
    items.push(
      { divider: true },
      {
        label: t('hunkStage.ctxRestoreWorktreeHunk'),
        icon: '↩',
        destructive: true,
        action: () => void restoreHunkToWorktree(hIdx, false),
        disabled: restoreWtMut.isPending.value,
      },
      {
        label: t('hunkStage.ctxRestoreWorktreeLines', { n: sel?.size ?? 0 }),
        icon: '↩',
        destructive: true,
        action: () => void restoreHunkToWorktree(hIdx, true),
        disabled: !sel?.size || restoreWtMut.isPending.value,
      },
    )
  }
  items.push(
    { divider: true },
    {
      label: expanded.value.has(hIdx)
        ? t('hunkStage.ctxCollapseHunk')
        : t('hunkStage.ctxExpandHunk'),
      icon: expanded.value.has(hIdx) ? '▼' : '▶',
      action: () => toggleExpanded(hIdx),
    },
  )
  ctxMenu.value?.openAt(ev, items)
}

function lineColor(prefix: string): string {
  if (prefix === '+') return 'bg-emerald-500/10 text-emerald-300'
  if (prefix === '-') return 'bg-rose-500/10 text-rose-300'
  return 'text-muted-foreground'
}

const expanded = ref<Set<number>>(new Set([0])) // 첫 hunk 기본 펼침
function toggleExpanded(idx: number) {
  const s = new Set(expanded.value)
  if (s.has(idx)) s.delete(idx)
  else s.add(idx)
  expanded.value = s
}
</script>

<template>
  <BaseModal
    :open="open"
    panel-class="max-h-[90vh] w-[1000px]"
    max-width="full"
    :show-close-button="false"
    @close="$emit('close')"
  >
    <template #header>
      <div class="flex w-full items-center justify-between gap-2">
        <h2 class="font-mono text-sm">
          {{ staged ? 'Hunk / Line Unstage' : 'Hunk / Line Stage' }}
          <span class="ml-2 text-muted-foreground">{{ path }}</span>
          <span v-if="hunks.length" class="ml-2 text-xs text-muted-foreground">
            {{
              t('hunkStage.hunksSelectedCount', { hunks: hunks.length, selected: totalSelected })
            }}
          </span>
        </h2>
        <div class="flex items-center gap-2">
          <button
            v-if="hunks.length > 1"
            type="button"
            class="rounded border border-border px-2 py-0.5 text-xs hover:bg-accent/40 disabled:opacity-50"
            :disabled="applyMut.isPending.value"
            :title="staged ? t('hunkStage.allHunksUnstage') : t('hunkStage.allHunksStage')"
            :aria-label="staged ? t('hunkStage.allHunksUnstage') : t('hunkStage.allHunksStage')"
            @click="applyAllHunks"
          >
            {{ staged ? t('hunkStage.allUnstageButton') : t('hunkStage.allStageButton') }}
          </button>
          <button
            type="button"
            class="flex items-center justify-center rounded min-h-[24px] min-w-[24px] p-1 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
            :aria-label="t('common.close')"
            @click="$emit('close')"
          >
            ✕
          </button>
        </div>
      </div>
    </template>
    <div class="p-2 font-mono text-xs">
      <p v-if="diffQuery.isFetching.value && !file" class="p-6 text-center text-muted-foreground">
        {{ t('common.loading') }}
      </p>
      <p
        v-else-if="diffQuery.error.value"
        class="m-2 rounded border border-destructive bg-destructive/10 p-2"
      >
        {{ describeError(diffQuery.error.value) }}
      </p>
      <p v-else-if="!file" class="p-6 text-center text-muted-foreground">
        {{ t('hunkStage.emptyDiff') }}
      </p>
      <div
        v-for="(h, hIdx) in hunks"
        :key="`h-${hIdx}`"
        class="mb-2 rounded border border-border"
        @contextmenu="onHunkContextMenu($event, hIdx)"
      >
        <div class="flex items-center justify-between bg-muted/30 px-2 py-1 text-[11px]">
          <button
            type="button"
            class="flex-1 truncate text-left text-muted-foreground hover:text-foreground"
            :title="expanded.has(hIdx) ? t('hunkStage.collapse') : t('hunkStage.expand')"
            @click="toggleExpanded(hIdx)"
          >
            {{ expanded.has(hIdx) ? '▼' : '▶' }} {{ h.header }}
            <span v-if="selected.get(hIdx)?.size" class="ml-1 text-warning-amber">
              {{ t('hunkStage.selectedSuffix', { n: selected.get(hIdx)?.size }) }}
            </span>
          </button>
          <button
            v-if="selected.get(hIdx)?.size"
            type="button"
            class="ml-1 rounded border border-amber-500/40 px-1.5 py-0.5 text-[10px] text-warning-amber hover:bg-amber-500/20 disabled:opacity-50"
            :disabled="applyMut.isPending.value"
            :title="staged ? t('hunkStage.lineUnstageTitle') : t('hunkStage.lineStageTitle')"
            @click="applySelectedLines(hIdx)"
          >
            {{ staged ? t('hunkStage.lineUnstageButton') : t('hunkStage.lineStageButton') }}
          </button>
          <button
            type="button"
            class="ml-1 rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-accent/40 disabled:opacity-50"
            :disabled="applyMut.isPending.value"
            @click="applyHunk(hIdx)"
          >
            {{ staged ? t('hunkStage.hunkUnstageButton') : t('hunkStage.hunkStageButton') }}
          </button>
        </div>
        <div v-if="expanded.has(hIdx)" class="overflow-x-auto">
          <div
            v-for="(line, lIdx) in h.bodyLines"
            :key="lIdx"
            class="flex items-start leading-tight"
            :class="lineColor(line.charAt(0) || ' ')"
          >
            <!-- checkbox: +/- 만, ' ' 는 spacer -->
            <span class="w-5 shrink-0 select-none px-1 text-center">
              <input
                v-if="isStageableLine(line)"
                type="checkbox"
                class="cursor-pointer align-middle"
                :checked="isSelected(hIdx, lIdx)"
                :title="t('hunkStage.lineRangeTitle', { idx: lIdx })"
                @click.stop="toggleLine(hIdx, lIdx, $event as MouseEvent)"
              />
            </span>
            <span
              class="flex-1 cursor-pointer whitespace-pre-wrap break-all px-1"
              @click="isStageableLine(line) && toggleLine(hIdx, lIdx, $event as MouseEvent)"
              >{{ line || ' ' }}</span
            >
          </div>
          <div
            class="flex items-center gap-2 border-t border-border bg-muted/20 px-2 py-0.5 text-[10px] text-muted-foreground"
          >
            <button type="button" class="hover:text-foreground" @click="selectAllLines(hIdx)">
              {{ t('hunkStage.selectAllLines') }}
            </button>
            <button type="button" class="hover:text-foreground" @click="clearLines(hIdx)">
              {{ t('hunkStage.clearSelection') }}
            </button>
            <span class="ml-auto">shift-click = range</span>
          </div>
        </div>
      </div>
    </div>
    <ContextMenu ref="ctxMenu" />
  </BaseModal>
</template>
