<script setup lang="ts">
// Sync-template 어시스턴트 — 한 commit 을 여러 레포에 cherry-pick.
// 사용자 회사 워크플로우 직격 (`docs/plan/02 §3 W3`):
//   27.template_work-dir → 다른 회사 레포로 chore/sync-template-* 전파.
//
// 흐름:
//   1) source sha 입력 (또는 props 로 사전 채움)
//   2) target repos 다중 선택 (체크박스, 활성 워크스페이스 default)
//   3) 전략 / no-commit 옵션
//   4) 실행 → 결과 row 별 표시 (success / conflict / error)
import { computed, ref, watch } from 'vue'
import { useMutation, useQuery } from '@tanstack/vue-query'
import {
  bulkCherryPick,
  listRepos,
} from '@/api/git'
import type { CherryPickResult, CherryPickStrategy } from '@/api/git'
import type { Repo } from '@/types/git'
import { useReposStore } from '@/stores/repos'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const props = defineProps<{
  open: boolean
  /** 사전 입력될 source sha (커밋 그래프에서 호출 시). */
  initialSha?: string | null
}>()
const emit = defineEmits<{ close: [] }>()

const store = useReposStore()
const sha = ref('')
const strategy = ref<CherryPickStrategy>('default')
const noCommit = ref(false)
const selectedIds = ref<Set<number>>(new Set())
const results = ref<CherryPickResult[] | null>(null)

watch(
  () => props.open,
  (o) => {
    if (o) {
      sha.value = (props.initialSha ?? '').trim()
      results.value = null
      // 디폴트로 활성 워크스페이스 의 모든 레포에서 source 제외 자동 선택
      // (source 자체를 cherry-pick 대상에 넣으면 안 되므로 사용자가 풀어야)
    }
  },
)

const { data: repos } = useQuery({
  queryKey: ['repos', store.activeWorkspaceId, '__sync__'],
  queryFn: () => listRepos(store.activeWorkspaceId),
  enabled: computed(() => props.open),
})

function toggle(id: number) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id)
  else selectedIds.value.add(id)
  // Set 변경 trigger (Vue reactivity)
  selectedIds.value = new Set(selectedIds.value)
}

function selectAll() {
  if (!repos.value) return
  selectedIds.value = new Set(repos.value.map((r) => r.id))
}
function clearAll() {
  selectedIds.value = new Set()
}

const runMut = useMutation({
  mutationFn: () =>
    bulkCherryPick({
      repoIds: [...selectedIds.value],
      sha: sha.value.trim(),
      strategy: strategy.value,
      noCommit: noCommit.value,
    }),
  onSuccess: (res) => {
    results.value = res
  },
  onError: (e) => toast.error('Cherry-pick 호출 실패', describeError(e)),
})

const canRun = computed(
  () =>
    sha.value.trim().length >= 4 &&
    selectedIds.value.size > 0 &&
    !runMut.isPending.value,
)

function statusOf(r: CherryPickResult): {
  label: string
  color: string
} {
  if (r.success) return { label: '성공', color: 'text-emerald-500' }
  if (r.conflicted) return { label: '충돌', color: 'text-amber-500' }
  return { label: '실패', color: 'text-rose-500' }
}

function repoName(id: number): string {
  return (repos.value as Repo[] | undefined)?.find((r) => r.id === id)?.name ?? '?'
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-6"
      @click.self="emit('close')"
    >
      <div class="flex h-full w-full max-w-3xl flex-col rounded-lg border border-border bg-card shadow-xl">
        <header class="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 class="text-base font-semibold">Sync template — 다중 레포 Cherry-pick</h2>
          <button class="text-muted-foreground hover:text-foreground" @click="emit('close')">✕</button>
        </header>

        <div class="flex-1 overflow-auto p-4 text-sm">
          <!-- 1. SHA -->
          <section class="mb-4">
            <label class="mb-1 block text-xs text-muted-foreground">
              Source commit SHA (40자 또는 short, 4자 이상)
            </label>
            <input
              v-model="sha"
              placeholder="예: c51a617 또는 c51a617deadbeef..."
              class="w-full rounded-md border border-input bg-background px-3 py-1.5 font-mono text-sm"
            />
            <p class="mt-1 text-[10px] text-muted-foreground">
              source repo (template_work-dir 등) 가 활성이고 그 commit 이 존재해야 합니다.
              현재 앱은 source repo 의 commit graph 가 같이 있다고 가정.
            </p>
          </section>

          <!-- 2. 옵션 -->
          <section class="mb-4 grid grid-cols-2 gap-3">
            <label class="text-xs text-muted-foreground">
              전략
              <select
                v-model="strategy"
                class="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
              >
                <option value="default">default (단일 부모)</option>
                <option value="mainlineParent">mainline parent (-m 1, 머지 commit 용)</option>
              </select>
            </label>
            <label class="flex items-center gap-2 self-end pb-1 text-xs">
              <input v-model="noCommit" type="checkbox" />
              --no-commit (수동 검토 후 commit)
            </label>
          </section>

          <!-- 3. 레포 선택 -->
          <section class="mb-3">
            <div class="mb-1 flex items-center justify-between">
              <label class="text-xs text-muted-foreground">
                대상 레포 ({{ selectedIds.size }} 선택)
              </label>
              <div class="flex gap-2 text-[11px]">
                <button class="text-muted-foreground hover:underline" @click="selectAll">모두</button>
                <button class="text-muted-foreground hover:underline" @click="clearAll">해제</button>
              </div>
            </div>
            <div class="max-h-60 overflow-auto rounded-md border border-border">
              <ul>
                <li
                  v-for="r in repos"
                  :key="r.id"
                  class="flex items-center gap-2 px-3 py-1 text-xs hover:bg-accent/40"
                >
                  <input
                    :checked="selectedIds.has(r.id)"
                    type="checkbox"
                    @change="toggle(r.id)"
                  />
                  <span class="font-medium">{{ r.name }}</span>
                  <span class="ml-auto text-[10px] text-muted-foreground">
                    {{ r.defaultBranch || '?' }}
                  </span>
                  <span
                    v-if="r.forgeKind !== 'unknown'"
                    class="rounded bg-muted px-1 text-[9px] uppercase"
                  >
                    {{ r.forgeKind }}
                  </span>
                </li>
                <li
                  v-if="repos && repos.length === 0"
                  class="p-3 text-center text-xs text-muted-foreground"
                >
                  레포 없음
                </li>
              </ul>
            </div>
          </section>

          <!-- 4. 결과 -->
          <section v-if="results" class="mt-4 rounded-md border border-border">
            <div class="border-b border-border px-3 py-1.5 text-xs font-semibold">
              결과 ({{ results.filter((r) => r.success).length }}/{{ results.length }} 성공)
            </div>
            <ul class="max-h-60 overflow-auto">
              <li
                v-for="r in results"
                :key="r.repoId"
                class="border-b border-border/50 px-3 py-2 text-xs last:border-0"
              >
                <div class="flex items-center justify-between">
                  <span class="font-medium">{{ r.repoName || repoName(r.repoId) }}</span>
                  <span :class="statusOf(r).color">{{ statusOf(r).label }}</span>
                </div>
                <pre
                  v-if="!r.success"
                  class="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-[10px] text-muted-foreground"
                >{{ r.stderr || r.stdout }}</pre>
              </li>
            </ul>
          </section>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t border-border px-4 py-3 text-xs">
          <button class="rounded-md border border-input px-3 py-1.5 hover:bg-accent" @click="emit('close')">
            닫기
          </button>
          <button
            class="rounded-md bg-primary px-4 py-1.5 text-primary-foreground disabled:opacity-50"
            :disabled="!canRun"
            @click="runMut.mutate()"
          >
            {{ runMut.isPending.value ? '실행 중...' : `${selectedIds.size}개 레포에 적용` }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
