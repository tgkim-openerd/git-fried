<script setup lang="ts">
// Push / Pull / Fetch + ahead/behind 표시.
import { useMutation } from '@tanstack/vue-query'
import { fetchAll, pull, push } from '@/api/git'
import { describeError, humanizeGitError } from '@/api/errors'
import { useInvalidateRepoQueries } from '@/composables/useStatus'

const props = defineProps<{
  repoId: number | null
  branch: string | null
  ahead: number
  behind: number
  upstream: string | null
}>()

const invalidate = useInvalidateRepoQueries()

const fetchMut = useMutation({
  mutationFn: (id: number) => fetchAll(id),
  onSuccess: (res) => {
    invalidate(props.repoId)
    if (!res.success)
      alert(
        `fetch 실패 (exit ${res.exitCode}):\n${humanizeGitError(res.stderr)}`,
      )
  },
  onError: (e) => alert(`fetch 호출 실패:\n${describeError(e)}`),
})
const pullMut = useMutation({
  mutationFn: (id: number) => pull({ repoId: id }),
  onSuccess: (res) => {
    invalidate(props.repoId)
    if (!res.success)
      alert(
        `pull 실패 (exit ${res.exitCode}):\n${humanizeGitError(res.stderr)}`,
      )
  },
  onError: (e) => alert(`pull 호출 실패:\n${describeError(e)}`),
})
const pushMut = useMutation({
  mutationFn: (id: number) =>
    push({
      repoId: id,
      setUpstream: !props.upstream,
    }),
  onSuccess: (res) => {
    invalidate(props.repoId)
    if (!res.success)
      alert(
        `push 실패 (exit ${res.exitCode}):\n${humanizeGitError(res.stderr)}`,
      )
  },
  onError: (e) => alert(`push 호출 실패:\n${describeError(e)}`),
})

function onFetch() {
  if (props.repoId != null) fetchMut.mutate(props.repoId)
}
function onPull() {
  if (props.repoId != null) pullMut.mutate(props.repoId)
}
function onPush() {
  if (props.repoId != null) pushMut.mutate(props.repoId)
}
</script>

<template>
  <header
    class="flex items-center justify-between border-b border-border bg-card px-4 py-2"
  >
    <div class="flex items-center gap-3 text-sm">
      <span class="font-mono">
        <span class="text-muted-foreground">on</span>
        <span class="ml-1 font-semibold">{{ branch || '(no branch)' }}</span>
      </span>
      <span v-if="upstream" class="text-xs text-muted-foreground">
        → {{ upstream }}
      </span>
      <span v-if="ahead || behind" class="text-xs">
        <span v-if="ahead" class="text-emerald-500">↑{{ ahead }}</span>
        <span v-if="behind" class="ml-1 text-rose-500">↓{{ behind }}</span>
      </span>
    </div>

    <div class="flex items-center gap-1">
      <button
        type="button"
        class="rounded-md border border-input px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-50"
        :disabled="!repoId || fetchMut.isPending.value"
        @click="onFetch"
      >
        {{ fetchMut.isPending.value ? '...' : 'Fetch' }}
      </button>
      <button
        type="button"
        class="rounded-md border border-input px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-50"
        :disabled="!repoId || pullMut.isPending.value"
        @click="onPull"
      >
        {{ pullMut.isPending.value ? '...' : 'Pull' }}
      </button>
      <button
        type="button"
        class="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
        :disabled="!repoId || pushMut.isPending.value"
        @click="onPush"
      >
        {{ pushMut.isPending.value ? '...' : 'Push' }}
      </button>
    </div>
  </header>
</template>
