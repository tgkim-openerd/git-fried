<script setup lang="ts">
// `git range-diff` patch series 비교 패널 — Sprint c38 / plan/29 E2.
//
// CompareModal 의 우측 main 영역에 "Range Diff" 모드로 진입 시 렌더.
// `git range-diff rev1...rev2` (3-dot 자동 base) 를 사용 — rev1/rev2 가
// 같은 base 에서 분기한 patch series 일 때 가장 의미 있음.
//
// 4 status icon:
//   "=" 동일 / "!" 변경 (inter-diff body 표시) / ">" 추가 / "<" 제거.
//
// 한글 commit subject 안전 (백엔드 NFC + UTF-8 강제 spawn).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuery } from '@tanstack/vue-query'
import { rangeDiffAuto, type RangeDiffEntry } from '@/api/git'
import { describeError } from '@/api/errors'
import { STALE_TIME } from '@/api/queryClient'

const { t } = useI18n()

const props = defineProps<{
  repoId: number | null
  rev1: string
  rev2: string
  /** 활성 시에만 fetch (CompareModal 의 모드 토글). */
  active: boolean
}>()

const enabled = computed(
  () => props.active && !!props.repoId && !!props.rev1 && !!props.rev2 && props.rev1 !== props.rev2,
)

const rdQuery = useQuery({
  queryKey: computed(() => ['range-diff', props.repoId, props.rev1, props.rev2] as const),
  queryFn: () => {
    if (props.repoId == null || !props.rev1 || !props.rev2) {
      return Promise.resolve<RangeDiffEntry[]>([])
    }
    return rangeDiffAuto(props.repoId, props.rev1, props.rev2)
  },
  enabled,
  staleTime: STALE_TIME.NORMAL,
})

const entries = computed<RangeDiffEntry[]>(() => rdQuery.data.value ?? [])

function statusIcon(status: string): string {
  switch (status) {
    case '=':
      return '='
    case '!':
      return '≠'
    case '>':
      return '＋'
    case '<':
      return '－'
    default:
      return '?'
  }
}

function statusClass(status: string): string {
  switch (status) {
    case '=':
      return 'text-muted-foreground'
    case '!':
      return 'text-warning-amber'
    case '>':
      return 'text-diff-add'
    case '<':
      return 'text-destructive'
    default:
      return 'text-muted-foreground'
  }
}

function fmtIdx(idx: number | null): string {
  return idx == null ? '−' : String(idx)
}

function fmtSha(sha: string | null): string {
  return sha ?? '−'
}
</script>

<template>
  <section class="flex h-full flex-col bg-background">
    <header class="border-b border-border bg-muted/30 px-3 py-1 text-[11px] text-muted-foreground">
      <code>{{ rev1 || '?' }}...{{ rev2 || '?' }}</code> {{ t('rangeDiff.headerSuffix') }}
      <span v-if="entries.length"> ({{ entries.length }} {{ t('rangeDiff.entriesSuffix') }})</span>
    </header>

    <p
      v-if="rdQuery.error.value"
      class="m-2 rounded border border-destructive bg-destructive/10 p-2 text-xs"
    >
      {{ describeError(rdQuery.error.value) }}
    </p>
    <p v-else-if="!enabled" class="p-4 text-center text-xs text-muted-foreground">
      {{ t('rangeDiff.promptInputs') }}
    </p>
    <p
      v-else-if="rdQuery.isFetching.value && entries.length === 0"
      class="p-4 text-center text-xs text-muted-foreground"
    >
      {{ t('common.loading') }}
    </p>
    <p v-else-if="entries.length === 0" class="p-4 text-center text-xs text-muted-foreground">
      {{ t('rangeDiff.noEntries') }}
    </p>

    <ul v-else class="flex-1 overflow-auto text-xs">
      <li
        v-for="(e, idx) in entries"
        :key="`${e.leftSha ?? '_'}-${e.rightSha ?? '_'}-${idx}`"
        class="border-b border-border/50 px-3 py-1.5 hover:bg-accent/20"
      >
        <div class="flex items-baseline gap-2">
          <span :class="statusClass(e.status)" class="w-5 text-center text-base font-bold">
            {{ statusIcon(e.status) }}
          </span>
          <code class="text-muted-foreground">{{ fmtIdx(e.leftIndex) }}</code>
          <code class="text-muted-foreground">{{ fmtSha(e.leftSha) }}</code>
          <span class="text-muted-foreground">→</span>
          <code class="text-muted-foreground">{{ fmtIdx(e.rightIndex) }}</code>
          <code class="text-muted-foreground">{{ fmtSha(e.rightSha) }}</code>
          <span class="ml-1 flex-1 truncate font-mono">{{ e.summary }}</span>
        </div>
        <details v-if="e.status === '!' && e.patchDiff" class="ml-7 mt-1 text-[11px]">
          <summary class="cursor-pointer text-muted-foreground hover:text-foreground">
            {{ t('rangeDiff.interDiffSummary') }}
          </summary>
          <pre
            class="mt-1 max-h-72 overflow-auto rounded border border-border bg-muted/20 p-2 font-mono text-[11px]"
            >{{ e.patchDiff }}</pre
          >
        </details>
      </li>
    </ul>
  </section>
</template>
