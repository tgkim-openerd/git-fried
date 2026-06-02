<script setup lang="ts">
// Sprint c31 god comp 분리 3/N — PrDetailModal Files Changed tab 분리.
//
// V-2 Files Changed tab 의 모든 책임 (filesQuery + expand/collapse state +
// status badge + DiffViewer per-file) 을 자체 흡수.
//
// 부모 (PrDetailModal) 는 visible prop 만 토글.
import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { listPrFiles, type PrFile } from '@/api/git'
import { describeError } from '@/api/errors'
import { STALE_TIME } from '@/api/queryClient'
import DiffViewer from './DiffViewer.vue'

const props = defineProps<{
  repoId: number | null
  number: number | null
  /** 본 탭이 visible 일 때만 fetch (conversation 만 보면 무관 endpoint 호출 회피) */
  visible: boolean
  /** 너무 큰 파일 (patch 생략) 시 외부 링크 anchor — detailQuery.htmlUrl 형태 */
  detailHtmlUrl?: string | null
}>()

// E3 (plan #44) — diff 라인 "+" 클릭 → (path, new-file line) 을 부모(PrDetailModal)로 relay.
const emit = defineEmits<{ 'comment-line': [target: { path: string; line: number }] }>()

const expandedFiles = ref<Set<string>>(new Set())

const filesQuery = useQuery({
  queryKey: computed(() => ['pr-files', props.repoId, props.number]),
  queryFn: () => {
    if (props.repoId == null || props.number == null) return Promise.resolve([])
    return listPrFiles(props.repoId, props.number)
  },
  enabled: computed(() => props.visible && props.repoId != null && props.number != null),
  staleTime: STALE_TIME.NORMAL,
})

function toggleFileExpand(path: string) {
  if (expandedFiles.value.has(path)) expandedFiles.value.delete(path)
  else expandedFiles.value.add(path)
  // 새 Set 으로 reactivity 강제 (Set 자체 mutation 은 추적 안 됨)
  expandedFiles.value = new Set(expandedFiles.value)
}

function expandAllFiles() {
  const list = filesQuery.data.value ?? []
  expandedFiles.value = new Set(list.filter((f) => f.patch).map((f) => f.path))
}

function collapseAllFiles() {
  expandedFiles.value = new Set()
}

function statusBadge(s: PrFile['status']): { label: string; cls: string } {
  // Sprint c35 plan/28 옵션 C — 도메인 semantic colors 사용 (light/dark 자동 분기).
  switch (s) {
    case 'added':
      return { label: 'A', cls: 'bg-emerald-500/20 text-diff-add' }
    case 'removed':
      return { label: 'D', cls: 'bg-rose-500/20 text-diff-delete' }
    case 'renamed':
      return { label: 'R', cls: 'bg-violet-500/20 text-diff-rename' }
    case 'copied':
      return { label: 'C', cls: 'bg-cyan-500/20 text-cyan-500' }
    case 'modified':
    default:
      return { label: 'M', cls: 'bg-amber-500/20 text-warning-amber' }
  }
}

const totalAdditions = computed(
  () => filesQuery.data.value?.reduce((s, f) => s + f.additions, 0) ?? 0,
)
const totalDeletions = computed(
  () => filesQuery.data.value?.reduce((s, f) => s + f.deletions, 0) ?? 0,
)
</script>

<template>
  <div v-show="visible" class="flex-1 overflow-auto p-3 text-sm">
    <div
      v-if="filesQuery.error.value"
      class="m-2 rounded border border-destructive bg-destructive/10 p-2 text-xs whitespace-pre-wrap"
    >
      {{ describeError(filesQuery.error.value) }}
    </div>

    <div
      v-if="filesQuery.isFetching.value && !filesQuery.data.value"
      class="p-4 text-center text-xs text-muted-foreground"
    >
      파일 목록 불러오는 중...
    </div>

    <template v-else-if="filesQuery.data.value">
      <div class="mb-2 flex items-center justify-between text-3xs">
        <span class="text-muted-foreground">
          {{ filesQuery.data.value.length }} files / +{{ totalAdditions }} / -{{ totalDeletions }}
        </span>
        <div class="flex gap-1">
          <button
            type="button"
            class="rounded border border-border px-1.5 py-0.5 text-muted-foreground hover:bg-accent/40"
            aria-label="모든 파일 diff 펼치기"
            @click="expandAllFiles"
          >
            Expand all
          </button>
          <button
            type="button"
            class="rounded border border-border px-1.5 py-0.5 text-muted-foreground hover:bg-accent/40"
            aria-label="모든 파일 diff 접기"
            @click="collapseAllFiles"
          >
            Collapse all
          </button>
        </div>
      </div>

      <ul class="space-y-1">
        <li
          v-for="f in filesQuery.data.value"
          :key="f.path"
          class="rounded border border-border bg-muted/10"
        >
          <button
            type="button"
            class="flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-accent/30"
            :aria-label="`'${f.path}' diff ${expandedFiles.has(f.path) ? '접기' : '펼치기'}`"
            :aria-expanded="expandedFiles.has(f.path)"
            @click="toggleFileExpand(f.path)"
          >
            <span class="text-3xs text-muted-foreground">
              {{ expandedFiles.has(f.path) ? '▼' : '▸' }}
            </span>
            <span
              class="rounded px-1.5 text-3xs font-bold"
              :class="statusBadge(f.status).cls"
              :title="f.status"
            >
              {{ statusBadge(f.status).label }}
            </span>
            <span class="flex-1 truncate font-mono text-xs">
              <span v-if="f.previousPath" class="text-muted-foreground">
                {{ f.previousPath }} →
              </span>
              {{ f.path }}
            </span>
            <span class="text-3xs text-diff-add">+{{ f.additions }}</span>
            <span class="text-3xs text-diff-delete">-{{ f.deletions }}</span>
          </button>
          <div v-if="expandedFiles.has(f.path)" class="border-t border-border">
            <div v-if="!f.patch" class="p-3 text-center text-2xs text-muted-foreground">
              이 파일은 너무 커서 forge 가 patch 를 생략했습니다 (binary 또는 large file).
              <a
                v-if="detailHtmlUrl"
                :href="`${detailHtmlUrl}/files`"
                target="_blank"
                rel="noopener"
                class="ml-1 underline"
              >
                ↗ 외부에서 열기
              </a>
            </div>
            <DiffViewer
              v-else
              :patch="f.patch"
              commentable
              @comment-line="(line: number) => emit('comment-line', { path: f.path, line })"
            />
          </div>
        </li>
        <li
          v-if="filesQuery.data.value.length === 0"
          class="p-4 text-center text-xs text-muted-foreground"
        >
          변경된 파일 없음
        </li>
      </ul>
    </template>
  </div>
</template>
