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
import { computed, ref, useTemplateRef } from 'vue'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { applyPatch, getDiff, restoreWorktreePatch } from '@/api/git'
import { describeError } from '@/api/errors'
import ContextMenu, { type ContextMenuExpose, type ContextMenuItem } from './ContextMenu.vue'
import { useToast } from '@/composables/useToast'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import BaseModal from './BaseModal.vue'
// Sprint c38 / plan/29 E1 후속 — hunk-level restore worktree 의 destructive confirm.
import { confirmDialog } from '@/composables/useConfirm'
import {
  buildHunkPatch,
  buildLinePatch,
  isStageableLine,
  parseDiffWithHunks,
  type DiffFileWithHunks,
  type DiffHunk,
} from '@/utils/parseDiff'
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

const toast = useToast()
const invalidate = useInvalidateRepoQueries()

const diffQuery = useQuery({
  queryKey: computed(() => ['hunk-diff', props.repoId, props.path, props.staged] as const),
  queryFn: () => {
    if (props.repoId == null || !props.path) return Promise.resolve('')
    return getDiff({
      repoId: props.repoId,
      staged: props.staged,
      path: props.path,
      context: null,
    })
  },
  enabled: computed(() => props.open && props.repoId != null && props.path != null),
  // staleTime=0 의도적 (always-fresh): hunk-stage 모달 진입 시 항상 최신 patch 필요.
  // 정책 STALE_TIME.REALTIME(2s) 보다 짧아 별도 처리.
  staleTime: 0,
})

const file = computed<DiffFileWithHunks | null>(() => {
  const raw = diffQuery.data.value || ''
  return parseDiffWithHunks(raw)[0] ?? null
})

const hunks = computed<DiffHunk[]>(() => file.value?.hunks ?? [])

// Sprint N — 라인 선택 상태. Map<hunkIdx, Set<lineIdx>>.
const selected = ref<Map<number, Set<number>>>(new Map())
// shift-click range 의 anchor (hunkIdx, lineIdx).
const anchor = ref<{ hunk: number; line: number } | null>(null)

function isSelected(hunkIdx: number, lineIdx: number): boolean {
  return selected.value.get(hunkIdx)?.has(lineIdx) ?? false
}

function toggleLine(hunkIdx: number, lineIdx: number, e?: MouseEvent) {
  const m = new Map(selected.value)
  let s = m.get(hunkIdx) ? new Set(m.get(hunkIdx)) : new Set<number>()
  if (e?.shiftKey && anchor.value && anchor.value.hunk === hunkIdx) {
    // range — anchor 부터 lineIdx 까지 stageable 라인 모두 선택.
    const [a, b] = [anchor.value.line, lineIdx].sort((x, y) => x - y)
    const body = hunks.value[hunkIdx].bodyLines
    for (let i = a; i <= b; i++) {
      if (body[i] && isStageableLine(body[i])) s.add(i)
    }
  } else {
    if (s.has(lineIdx)) s.delete(lineIdx)
    else s.add(lineIdx)
    anchor.value = { hunk: hunkIdx, line: lineIdx }
  }
  if (s.size === 0) m.delete(hunkIdx)
  else m.set(hunkIdx, s)
  selected.value = m
}

function selectAllLines(hunkIdx: number) {
  const body = hunks.value[hunkIdx].bodyLines
  const s = new Set<number>()
  body.forEach((l, i) => {
    if (isStageableLine(l)) s.add(i)
  })
  const m = new Map(selected.value)
  if (s.size === 0) m.delete(hunkIdx)
  else m.set(hunkIdx, s)
  selected.value = m
}

function clearLines(hunkIdx: number) {
  const m = new Map(selected.value)
  m.delete(hunkIdx)
  selected.value = m
}

const totalSelected = computed(() => {
  let n = 0
  for (const s of selected.value.values()) n += s.size
  return n
})

const applyMut = useMutation({
  mutationFn: (args: { patch: string; what: string }) => {
    if (props.repoId == null) return Promise.reject(new Error(t('hunkStage.errRepoNotSelected')))
    return applyPatch(props.repoId, args.patch, props.staged).then(() => args.what)
  },
  onSuccess: (what) => {
    const action = props.staged ? t('hunkStage.actionUnstage') : t('hunkStage.actionStage')
    toast.success(t('hunkStage.applySuccessTitle', { what, action }), '')
    invalidate(props.repoId)
    diffQuery.refetch()
    selected.value = new Map()
  },
  onError: (e) =>
    toast.error(
      props.staged ? t('hunkStage.unstageFailed') : t('hunkStage.stageFailed'),
      describeError(e),
    ),
})

function applyHunk(idx: number) {
  const f = file.value
  const h = hunks.value[idx]
  if (!f || !h) return
  applyMut.mutate({ patch: buildHunkPatch(f, h), what: t('hunkStage.wholeHunk') })
}

function applySelectedLines(hunkIdx: number) {
  const f = file.value
  const h = hunks.value[hunkIdx]
  const s = selected.value.get(hunkIdx)
  if (!f || !h || !s || s.size === 0) return
  const patch = buildLinePatch(f, h, s)
  if (!patch) {
    toast.warning(t('hunkStage.noChange'), t('hunkStage.noChangeMessage'))
    return
  }
  applyMut.mutate({ patch, what: t('hunkStage.linesSuffix', { n: s.size }) })
}

// === Sprint c38 / plan/29 E1 후속 — hunk 단위 워킹트리 복원 (discard hunk) ===
//
// staged=false 모드 (unstaged hunk 보기) 에서만 의미. 그 hunk 의 변경을
// 워킹트리에서 완전히 폐기 (`git apply --reverse`, 인덱스 보존). selected
// lines 가 있으면 그 라인만, 없으면 hunk 전체.
const restoreWtMut = useMutation({
  mutationFn: (args: { patch: string; what: string }) => {
    if (props.repoId == null) return Promise.reject(new Error(t('hunkStage.errRepoNotSelected')))
    return restoreWorktreePatch(props.repoId, args.patch).then(() => args.what)
  },
  onSuccess: (what) => {
    toast.success(t('hunkStage.restoreSuccessTitle', { what }), '')
    invalidate(props.repoId)
    diffQuery.refetch()
    selected.value = new Map()
  },
  onError: (e) => toast.error(t('hunkStage.restoreFailed'), describeError(e)),
})

async function restoreHunkToWorktree(hunkIdx: number, linesOnly: boolean) {
  const f = file.value
  const h = hunks.value[hunkIdx]
  if (!f || !h) return
  let patch: string | null
  let what: string
  if (linesOnly) {
    const s = selected.value.get(hunkIdx)
    if (!s || s.size === 0) return
    patch = buildLinePatch(f, h, s)
    what = t('hunkStage.linesSuffix', { n: s.size })
  } else {
    patch = buildHunkPatch(f, h)
    what = t('hunkStage.wholeHunk')
  }
  if (!patch) {
    toast.warning(t('hunkStage.noChange'), t('hunkStage.noChangeMessage'))
    return
  }
  const ok = await confirmDialog({
    title: t('hunkStage.restoreConfirmTitle'),
    message: t('hunkStage.restoreConfirmMessage', { what, path: props.path ?? '' }),
    danger: true,
  })
  if (!ok) return
  restoreWtMut.mutate({ patch, what })
}

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

function applyAllHunks() {
  const f = file.value
  if (!f || hunks.value.length === 0) return
  const tail = hunks.value.map((h) => `${h.header}\n${h.bodyLines.join('\n')}`).join('\n')
  const patch = `${f.fileHeader}\n${tail}\n`
  applyMut.mutate({ patch, what: t('hunkStage.wholeHunk') })
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
            class="text-muted-foreground hover:text-foreground"
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
