<script setup lang="ts">
// 우측 패널 영구 헤더 (Sprint c25-2 — `docs/plan/25 §3`).
//
// GitKraken 의 "N file changes on {branch}" 헤더를 흡수.
// 탭 전환 무관 항상 표시 — Branches/Stash/PR 등 다른 패널 보고 있어도 변경 카운트가 보임.
// 클릭 시 status 탭으로 전환 (emit:'navigate-status').
import { computed } from 'vue'
import { useStatus } from '@/composables/useStatus'

const props = defineProps<{
  repoId: number | null
  branch: string | null
}>()
const emit = defineEmits<{
  'navigate-status': []
}>()

const repoIdRef = computed(() => props.repoId)
const { data: status } = useStatus(repoIdRef)

const counts = computed(() => {
  const s = status.value
  if (!s) return { total: 0, staged: 0, unstaged: 0, untracked: 0, conflicted: 0 }
  const staged = s.staged?.length ?? 0
  const unstaged = s.unstaged?.length ?? 0
  const untracked = s.untracked?.length ?? 0
  const conflicted = s.conflicted?.length ?? 0
  return {
    total: staged + unstaged + untracked + conflicted,
    staged,
    unstaged,
    untracked,
    conflicted,
  }
})

const isClean = computed(() => counts.value.total === 0)
</script>

<template>
  <button
    type="button"
    class="flex w-full items-center justify-between gap-2 border-b border-border bg-card px-3 py-1.5 text-left text-xs hover:bg-accent/30"
    :title="
      isClean
        ? '변경사항 없음 — 클릭 시 변경 탭으로 이동'
        : `${counts.total} file changes — 클릭 시 변경 탭으로 이동`
    "
    @click="emit('navigate-status')"
  >
    <div class="flex items-center gap-1.5">
      <span class="font-semibold">
        <span v-if="isClean" class="text-muted-foreground">변경사항 없음 ✓</span>
        <span v-else>
          <span class="text-foreground">{{ counts.total }}</span>
          <span class="text-muted-foreground"> file changes</span>
        </span>
      </span>
      <span v-if="!isClean" class="flex items-center gap-1 text-[10px]">
        <span v-if="counts.staged > 0" class="rounded bg-emerald-500/15 px-1 text-emerald-500">
          staged {{ counts.staged }}
        </span>
        <span v-if="counts.unstaged > 0" class="rounded bg-amber-500/15 px-1 text-amber-500">
          mod {{ counts.unstaged }}
        </span>
        <span v-if="counts.untracked > 0" class="rounded bg-sky-500/15 px-1 text-sky-500">
          new {{ counts.untracked }}
        </span>
        <span v-if="counts.conflicted > 0" class="rounded bg-rose-500/15 px-1 text-rose-500">
          ⚠ {{ counts.conflicted }}
        </span>
      </span>
    </div>
    <span v-if="branch" class="font-mono text-[11px] text-muted-foreground">
      on
      <span class="ml-0.5 font-semibold text-foreground">{{ branch }}</span>
    </span>
  </button>
</template>
