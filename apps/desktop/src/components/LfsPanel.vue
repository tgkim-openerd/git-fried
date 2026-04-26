<script setup lang="ts">
// Git LFS 패널 — list / track / fetch / pull / prune.
// 사용자 회사 sub-repo 6/6 사용 (`docs/plan/02 §3 W4`).
import { computed, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  lfsFetch,
  lfsListFiles,
  lfsPrune,
  lfsPull,
  lfsStatus,
  lfsTrack,
  lfsUntrack,
} from '@/api/git'
import { describeError } from '@/api/errors'

const props = defineProps<{ repoId: number | null }>()
const qc = useQueryClient()

const statusQuery = useQuery({
  queryKey: computed(() => ['lfs-status', props.repoId]),
  queryFn: () => {
    if (props.repoId == null) return Promise.reject(new Error('no repo'))
    return lfsStatus(props.repoId)
  },
  enabled: computed(() => props.repoId != null),
  staleTime: 30_000,
})

const filesQuery = useQuery({
  queryKey: computed(() => ['lfs-files', props.repoId]),
  queryFn: () => {
    if (props.repoId == null) return Promise.resolve([])
    return lfsListFiles(props.repoId)
  },
  enabled: computed(() => props.repoId != null && statusQuery.data.value?.installed === true),
})

const newPattern = ref('')

const trackMut = useMutation({
  mutationFn: () => {
    if (props.repoId == null || !newPattern.value.trim())
      return Promise.reject(new Error('no input'))
    return lfsTrack(props.repoId, newPattern.value.trim())
  },
  onSuccess: () => {
    newPattern.value = ''
    qc.invalidateQueries({ queryKey: ['lfs-status'] })
  },
  onError: (e) => alert(`track 실패:\n${describeError(e)}`),
})

const untrackMut = useMutation({
  mutationFn: (pattern: string) => {
    if (props.repoId == null) return Promise.reject(new Error('no repo'))
    return lfsUntrack(props.repoId, pattern)
  },
  onSuccess: () => qc.invalidateQueries({ queryKey: ['lfs-status'] }),
  onError: (e) => alert(`untrack 실패:\n${describeError(e)}`),
})

const fetchMut = useMutation({
  mutationFn: () => {
    if (props.repoId == null) return Promise.reject(new Error('no repo'))
    return lfsFetch(props.repoId)
  },
  onSuccess: () => qc.invalidateQueries({ queryKey: ['lfs-files'] }),
  onError: (e) => alert(`fetch 실패:\n${describeError(e)}`),
})

const pullMut = useMutation({
  mutationFn: () => {
    if (props.repoId == null) return Promise.reject(new Error('no repo'))
    return lfsPull(props.repoId)
  },
  onSuccess: () => qc.invalidateQueries({ queryKey: ['lfs-files'] }),
  onError: (e) => alert(`pull 실패:\n${describeError(e)}`),
})

const pruneMut = useMutation({
  mutationFn: () => {
    if (props.repoId == null) return Promise.reject(new Error('no repo'))
    return lfsPrune(props.repoId)
  },
  onSuccess: () => qc.invalidateQueries({ queryKey: ['lfs-files'] }),
  onError: (e) => alert(`prune 실패:\n${describeError(e)}`),
})

function confirmUntrack(p: string) {
  if (window.confirm(`패턴 '${p}' 추적 해제?`)) {
    untrackMut.mutate(p)
  }
}

function fmtSize(b: number | null): string {
  if (b == null) return '?'
  if (b < 1024) return `${b}B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)}MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)}GB`
}
</script>

<template>
  <section class="flex h-full flex-col border-l border-border bg-card">
    <header class="flex items-center justify-between border-b border-border px-3 py-2">
      <h3 class="text-sm font-semibold">Git LFS</h3>
      <div class="flex gap-1 text-xs">
        <button
          type="button"
          class="rounded-md border border-input px-2 py-0.5 hover:bg-accent disabled:opacity-50"
          :disabled="!repoId || fetchMut.isPending.value"
          @click="fetchMut.mutate()"
        >
          fetch
        </button>
        <button
          type="button"
          class="rounded-md border border-input px-2 py-0.5 hover:bg-accent disabled:opacity-50"
          :disabled="!repoId || pullMut.isPending.value"
          @click="pullMut.mutate()"
        >
          pull
        </button>
        <button
          type="button"
          class="rounded-md border border-input px-2 py-0.5 hover:bg-accent disabled:opacity-50"
          :disabled="!repoId || pruneMut.isPending.value"
          @click="pruneMut.mutate()"
        >
          prune
        </button>
      </div>
    </header>

    <!-- 미설치 알림 -->
    <div
      v-if="statusQuery.data.value && !statusQuery.data.value.installed"
      class="m-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs"
    >
      ⚠ Git LFS 가 설치되지 않았습니다.
      <a href="https://git-lfs.com" target="_blank" rel="noopener" class="underline">
        git-lfs.com
      </a>
      에서 설치 후 새로고침.
    </div>

    <!-- 추적 패턴 -->
    <section
      v-else-if="statusQuery.data.value"
      class="border-b border-border px-3 py-2"
    >
      <div class="text-[10px] uppercase tracking-wider text-muted-foreground">
        추적 패턴 ({{ statusQuery.data.value.trackedPatterns.length }})
      </div>
      <div v-if="statusQuery.data.value.version" class="text-[10px] text-muted-foreground">
        {{ statusQuery.data.value.version }}
      </div>
      <ul class="mt-1 space-y-0.5">
        <li
          v-for="p in statusQuery.data.value.trackedPatterns"
          :key="p"
          class="group flex items-center justify-between rounded px-1 py-0.5 hover:bg-accent/40"
        >
          <span class="font-mono text-xs">{{ p }}</span>
          <button
            type="button"
            class="opacity-0 group-hover:opacity-100 text-[10px] text-destructive hover:underline"
            @click="confirmUntrack(p)"
          >
            untrack
          </button>
        </li>
      </ul>
      <div class="mt-2 flex gap-1">
        <input
          v-model="newPattern"
          placeholder="새 패턴 (예: *.psd, design/**)"
          class="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
          @keyup.enter="trackMut.mutate()"
        />
        <button
          type="button"
          class="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
          :disabled="!newPattern.trim() || trackMut.isPending.value"
          @click="trackMut.mutate()"
        >
          track
        </button>
      </div>
    </section>

    <!-- LFS 파일 -->
    <div class="flex-1 overflow-auto px-2 py-2 text-sm">
      <div class="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        LFS 파일 ({{ filesQuery.data.value?.length ?? 0 }})
      </div>
      <ul>
        <li
          v-for="f in filesQuery.data.value"
          :key="`${f.oid}-${f.path}`"
          class="flex items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-accent/40"
        >
          <span :class="f.downloaded ? 'text-emerald-500' : 'text-muted-foreground'">
            {{ f.downloaded ? '●' : '◌' }}
          </span>
          <span class="flex-1 truncate font-mono">{{ f.path }}</span>
          <span class="font-mono text-[10px] text-muted-foreground">
            {{ f.oid.slice(0, 7) }}
          </span>
          <span class="w-12 text-right text-[10px] text-muted-foreground">
            {{ fmtSize(f.size) }}
          </span>
        </li>
        <li
          v-if="filesQuery.data.value && filesQuery.data.value.length === 0"
          class="px-2 py-3 text-center text-xs text-muted-foreground"
        >
          LFS 파일 없음
        </li>
      </ul>
      <p class="mt-2 text-[10px] text-muted-foreground">
        ● = 다운로드됨 / ◌ = pointer 만 (fetch / pull 필요)
      </p>
    </div>
  </section>
</template>
