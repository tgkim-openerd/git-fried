<script setup lang="ts">
// Bisect — binary search 로 잘못된 commit 식별.
import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  bisectMark,
  bisectReset,
  bisectStart,
  getBisectStatus,
} from '@/api/git'
import { describeError } from '@/api/errors'
import { STALE_TIME } from '@/api/queryClient'
import { useToast } from '@/composables/useToast'
import { useReposStore } from '@/stores/repos'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import BaseModal from './BaseModal.vue'

const toast = useToast()

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const store = useReposStore()
const qc = useQueryClient()
const invalidate = useInvalidateRepoQueries()
const repoId = computed(() => store.activeRepoId)

const statusQuery = useQuery({
  queryKey: computed(() => ['bisect-status', repoId.value]),
  queryFn: () => {
    if (repoId.value == null) return Promise.reject(new Error('no repo'))
    return getBisectStatus(repoId.value)
  },
  enabled: computed(() => props.open && repoId.value != null),
  staleTime: STALE_TIME.REALTIME,
})

const startMut = useMutation({
  mutationFn: () => {
    if (repoId.value == null) return Promise.reject(new Error('no repo'))
    return bisectStart(repoId.value)
  },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['bisect-status'] })
    invalidate(repoId.value)
  },
  onError: (e) => toast.error('Bisect start 실패', describeError(e)),
})

const markMut = useMutation({
  mutationFn: (m: 'good' | 'bad' | 'skip') => {
    if (repoId.value == null) return Promise.reject(new Error('no repo'))
    return bisectMark(repoId.value, m)
  },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['bisect-status'] })
    invalidate(repoId.value)
  },
  onError: (e) => toast.error('Bisect mark 실패', describeError(e)),
})

const resetMut = useMutation({
  mutationFn: () => {
    if (repoId.value == null) return Promise.reject(new Error('no repo'))
    return bisectReset(repoId.value)
  },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['bisect-status'] })
    invalidate(repoId.value)
  },
  onError: (e) => toast.error('Bisect reset 실패', describeError(e)),
})
</script>

<template>
  <BaseModal
    :open="open"
    max-width="2xl"
    title="🔬 Bisect — 잘못된 commit 찾기"
    @close="emit('close')"
  >
    <div class="p-4 text-sm">
          <p class="mb-3 text-xs text-muted-foreground">
            🔬 binary search 로 버그 commit 식별. 시작 → 현재 HEAD 가 좋은지 나쁜지 표시 →
            git 이 자동으로 중간 commit 으로 checkout → 반복.
          </p>

          <div v-if="statusQuery.error.value" class="mb-3 rounded border border-destructive bg-destructive/10 p-2 text-xs">
            {{ describeError(statusQuery.error.value) }}
          </div>

          <!-- 미시작 -->
          <div v-if="statusQuery.data.value && !statusQuery.data.value.inProgress">
            <button
              type="button"
              class="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
              :disabled="!repoId || startMut.isPending.value"
              @click="startMut.mutate()"
            >
              {{ startMut.isPending.value ? '...' : 'Bisect 시작' }}
            </button>
            <p class="mt-2 text-[10px] text-muted-foreground">
              시작 후: 현재 commit 이 작동하지 않으면 "Bad", 작동하면 "Good" 표시.
              git 이 자동으로 다음 후보 commit checkout. 범위가 좁아질 때까지 반복.
            </p>
          </div>

          <!-- 진행 중 -->
          <div v-else-if="statusQuery.data.value?.inProgress">
            <div class="mb-3 rounded-md border border-border bg-muted/20 p-3">
              <div class="text-xs">
                <strong>현재 commit:</strong>
                <span class="ml-2 font-mono">{{ statusQuery.data.value.currentSha?.slice(0, 8) }}</span>
              </div>
              <div class="mt-1 text-xs text-muted-foreground">
                Good: {{ statusQuery.data.value.good.length }} ·
                Bad: {{ statusQuery.data.value.bad.length }}
              </div>
            </div>

            <div class="flex gap-2">
              <button
                type="button"
                class="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-500 hover:bg-emerald-500/20 disabled:opacity-50"
                :disabled="markMut.isPending.value"
                @click="markMut.mutate('good')"
              >
                ✓ Good (작동함)
              </button>
              <button
                type="button"
                class="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-500 hover:bg-rose-500/20 disabled:opacity-50"
                :disabled="markMut.isPending.value"
                @click="markMut.mutate('bad')"
              >
                ✕ Bad (버그)
              </button>
              <button
                type="button"
                class="rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                :disabled="markMut.isPending.value"
                @click="markMut.mutate('skip')"
              >
                ⏭ Skip
              </button>
              <button
                type="button"
                class="ml-auto rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
                :disabled="resetMut.isPending.value"
                @click="resetMut.mutate()"
              >
                Reset (종료)
              </button>
            </div>

            <details class="mt-3 rounded border border-border bg-muted/10 p-2 text-[11px]">
              <summary class="cursor-pointer text-muted-foreground">bisect log</summary>
              <pre class="mt-1 max-h-48 overflow-auto whitespace-pre-wrap font-mono">{{ statusQuery.data.value.lastOutput }}</pre>
            </details>
          </div>
    </div>
  </BaseModal>
</template>
