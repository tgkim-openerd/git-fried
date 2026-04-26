<script setup lang="ts">
// Hunk-level stage / unstage — Sprint H (`docs/plan/11 §7`).
//
// 단일 파일의 diff 를 hunk 별로 분리하여 각 hunk 를 stage / unstage 할 수
// 있게 함. `git apply --cached [--reverse] -` 사용.
//
// v1: hunk 단위. line 단위는 v1.x 후속 (patch math 가 더 까다로움 — 선택 라인
//     외 - 는 context, 외 + 는 무시 등 변환 필요).
import { computed, ref } from 'vue'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { applyPatch, getDiff } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import {
  buildHunkPatch,
  parseDiffWithHunks,
  type DiffFileWithHunks,
  type DiffHunk,
} from '@/utils/parseDiff'

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
  queryKey: computed(
    () => ['hunk-diff', props.repoId, props.path, props.staged] as const,
  ),
  queryFn: () => {
    if (props.repoId == null || !props.path) return Promise.resolve('')
    return getDiff({
      repoId: props.repoId,
      staged: props.staged,
      path: props.path,
      context: null,
    })
  },
  enabled: computed(
    () => props.open && props.repoId != null && props.path != null,
  ),
  staleTime: 0,
})

const file = computed<DiffFileWithHunks | null>(() => {
  const raw = diffQuery.data.value || ''
  return parseDiffWithHunks(raw)[0] ?? null
})

const hunks = computed<DiffHunk[]>(() => file.value?.hunks ?? [])

const applyMut = useMutation({
  mutationFn: (args: { patch: string }) => {
    if (props.repoId == null) return Promise.reject(new Error('레포 미선택'))
    return applyPatch(props.repoId, args.patch, props.staged)
  },
  onSuccess: () => {
    toast.success(props.staged ? 'Hunk unstage 완료' : 'Hunk stage 완료', '')
    invalidate(props.repoId)
    diffQuery.refetch()
  },
  onError: (e) =>
    toast.error(props.staged ? 'Unstage 실패' : 'Stage 실패', describeError(e)),
})

function applyHunk(idx: number) {
  const f = file.value
  const h = hunks.value[idx]
  if (!f || !h) return
  const patch = buildHunkPatch(f, h)
  applyMut.mutate({ patch })
}

function applyAllHunks() {
  const f = file.value
  if (!f || hunks.value.length === 0) return
  // 모든 hunk 한 번에 — 원본 patch 그대로 적용.
  const tail = hunks.value
    .map((h) => `${h.header}\n${h.bodyLines.join('\n')}`)
    .join('\n')
  const patch = `${f.fileHeader}\n${tail}\n`
  applyMut.mutate({ patch })
}

function lineColor(prefix: string): string {
  if (prefix === '+') return 'bg-emerald-500/10 text-emerald-300'
  if (prefix === '-') return 'bg-rose-500/10 text-rose-300'
  return 'text-muted-foreground'
}

const expanded = ref<Set<number>>(new Set())
function toggleExpanded(idx: number) {
  const s = new Set(expanded.value)
  if (s.has(idx)) s.delete(idx)
  else s.add(idx)
  expanded.value = s
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="$emit('close')"
    >
      <div
        class="flex max-h-[90vh] w-[900px] max-w-full flex-col rounded-lg border border-border bg-card shadow-xl"
      >
        <header class="flex items-center justify-between border-b border-border px-4 py-2">
          <h2 class="font-mono text-sm">
            {{ staged ? 'Hunk Unstage' : 'Hunk Stage' }}
            <span class="ml-2 text-muted-foreground">{{ path }}</span>
            <span v-if="hunks.length" class="ml-2 text-xs text-muted-foreground">
              ({{ hunks.length }} hunks)
            </span>
          </h2>
          <div class="flex items-center gap-2">
            <button
              v-if="hunks.length > 1"
              type="button"
              class="rounded border border-border px-2 py-0.5 text-xs hover:bg-accent/40 disabled:opacity-50"
              :disabled="applyMut.isPending.value"
              :title="staged ? '모든 hunk unstage' : '모든 hunk stage'"
              @click="applyAllHunks"
            >
              {{ staged ? '모두 ✕' : '모두 ✓' }}
            </button>
            <button
              type="button"
              class="text-muted-foreground hover:text-foreground"
              @click="$emit('close')"
            >
              ✕
            </button>
          </div>
        </header>
        <div class="flex-1 overflow-auto p-2 font-mono text-xs">
          <p v-if="diffQuery.isFetching.value && !file" class="p-6 text-center text-muted-foreground">
            불러오는 중...
          </p>
          <p
            v-else-if="diffQuery.error.value"
            class="m-2 rounded border border-destructive bg-destructive/10 p-2"
          >
            {{ describeError(diffQuery.error.value) }}
          </p>
          <p v-else-if="!file" class="p-6 text-center text-muted-foreground">
            변경 없음 또는 binary / 모드 변경.
          </p>
          <div
            v-for="(h, idx) in hunks"
            :key="`h-${idx}`"
            class="mb-2 rounded border border-border"
          >
            <div
              class="flex items-center justify-between bg-muted/30 px-2 py-1 text-[11px]"
            >
              <button
                type="button"
                class="flex-1 truncate text-left text-muted-foreground hover:text-foreground"
                :title="expanded.has(idx) ? '접기' : '펼치기'"
                @click="toggleExpanded(idx)"
              >
                {{ expanded.has(idx) ? '▼' : '▶' }} {{ h.header }}
              </button>
              <button
                type="button"
                class="ml-2 rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-accent/40 disabled:opacity-50"
                :disabled="applyMut.isPending.value"
                @click="applyHunk(idx)"
              >
                {{ staged ? '✕ unstage' : '✓ stage' }}
              </button>
            </div>
            <pre
              v-if="expanded.has(idx)"
              class="overflow-x-auto px-2 py-1 leading-tight"
            >
              <code v-for="(line, li) in h.bodyLines"
                :key="li"
                :class="['block', lineColor(line.charAt(0) || ' ')]"
              >{{ line || ' ' }}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
