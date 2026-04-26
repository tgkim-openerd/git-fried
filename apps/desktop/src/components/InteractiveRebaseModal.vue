<script setup lang="ts">
// Interactive rebase modal — `docs/plan/09 옵션 A` MVP.
//
// 사용자 흐름:
//   1. setup       : 마지막 N 개 commit (count) 선택
//   2. edit        : todo 리스트 — drag-drop reorder + 액션 select + reword textarea
//   3. running     : run 호출 후 결과/충돌 표시
//
// 트리거: `window.gitFriedOpenRebase()` (CommandPalette 등에서 호출).
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { useMutation } from '@tanstack/vue-query'
import {
  aiComposerPlan,
  rebasePrepareTodo,
  rebaseRun,
  rebaseAbort,
  rebaseContinue,
  rebaseSkip,
  getRebaseStatus,
  type RebaseAction,
  type RebaseTodoEntry,
  type RebaseStatus,
  type RebaseRunResult,
} from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useReposStore } from '@/stores/repos'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { useAiCli, confirmAiSend } from '@/composables/useAiCli'

type Step = 'setup' | 'edit' | 'running' | 'result'

const store = useReposStore()
const toast = useToast()
const invalidate = useInvalidateRepoQueries()

const open = ref(false)
const step = ref<Step>('setup')
const count = ref(5)
const todo = ref<RebaseTodoEntry[]>([])
const lastResult = ref<RebaseRunResult | null>(null)
const status = ref<RebaseStatus | null>(null)

const repoId = computed(() => store.activeRepoId)

function close() {
  open.value = false
  step.value = 'setup'
  todo.value = []
  lastResult.value = null
  status.value = null
}

async function refreshStatus() {
  if (repoId.value == null) return
  try {
    status.value = await getRebaseStatus(repoId.value)
  } catch {
    /* ignore */
  }
}

const prepareMut = useMutation({
  mutationFn: () => {
    if (repoId.value == null) throw new Error('레포 미선택')
    return rebasePrepareTodo(repoId.value, count.value)
  },
  onSuccess: (entries) => {
    todo.value = entries
    step.value = 'edit'
  },
  onError: (e) => toast.error('todo 준비 실패', describeError(e)),
})

const runMut = useMutation({
  mutationFn: () => {
    if (repoId.value == null) throw new Error('레포 미선택')
    const base = `HEAD~${todo.value.length}`
    return rebaseRun(repoId.value, base, todo.value)
  },
  onSuccess: (res) => {
    lastResult.value = res
    status.value = res.status
    step.value = 'result'
    invalidate(repoId.value)
    if (res.success) {
      toast.success('Rebase 완료', `${todo.value.length} 개 commit 처리`)
    } else if (res.status.conflict) {
      toast.error('충돌 발생', `step ${res.status.currentStep}/${res.status.totalSteps}`)
    } else {
      toast.error('Rebase 실패', res.stderr.slice(0, 200))
    }
  },
  onError: (e) => {
    toast.error('Rebase 실행 실패', describeError(e))
    step.value = 'edit'
  },
})

const continueMut = useMutation({
  mutationFn: () => {
    if (repoId.value == null) throw new Error('레포 미선택')
    return rebaseContinue(repoId.value)
  },
  onSuccess: (res) => {
    lastResult.value = res
    status.value = res.status
    invalidate(repoId.value)
    if (res.success) toast.success('Rebase --continue 완료')
  },
  onError: (e) => toast.error('--continue 실패', describeError(e)),
})

const skipMut = useMutation({
  mutationFn: () => {
    if (repoId.value == null) throw new Error('레포 미선택')
    return rebaseSkip(repoId.value)
  },
  onSuccess: (res) => {
    lastResult.value = res
    status.value = res.status
    invalidate(repoId.value)
  },
  onError: (e) => toast.error('--skip 실패', describeError(e)),
})

const abortMut = useMutation({
  mutationFn: () => {
    if (repoId.value == null) throw new Error('레포 미선택')
    return rebaseAbort(repoId.value)
  },
  onSuccess: () => {
    invalidate(repoId.value)
    toast.success('Rebase 중단됨')
    close()
  },
  onError: (e) => toast.error('--abort 실패', describeError(e)),
})

function setAction(idx: number, action: RebaseAction) {
  const e = todo.value[idx]
  if (!e) return
  todo.value[idx] = {
    ...e,
    action,
    newMessage: action === 'reword' ? e.newMessage ?? e.subject : null,
  }
}

// === Sprint B3 — AI Commit Composer ===
const ai = useAiCli()

interface ComposerPlanEntry {
  sha: string
  action: RebaseAction
  newMessage: string | null
}

function parseComposerPlan(text: string): ComposerPlanEntry[] {
  // 응답에 마크다운 코드블록이 끼어 있을 가능성 → 첫/마지막 [ ] 추출.
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start < 0 || end <= start) return []
  const json = text.slice(start, end + 1)
  try {
    const arr = JSON.parse(json) as unknown
    if (!Array.isArray(arr)) return []
    const out: ComposerPlanEntry[] = []
    const allowed: RebaseAction[] = ['pick', 'reword', 'squash', 'fixup', 'drop']
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue
      const obj = item as Record<string, unknown>
      const sha = typeof obj.sha === 'string' ? obj.sha : null
      const action = typeof obj.action === 'string' ? obj.action : null
      const newMessage =
        typeof obj.newMessage === 'string' ? obj.newMessage : null
      if (!sha || !action) continue
      if (!allowed.includes(action as RebaseAction)) continue
      out.push({ sha, action: action as RebaseAction, newMessage })
    }
    return out
  } catch {
    return []
  }
}

function applyComposerPlan(plan: ComposerPlanEntry[]) {
  const bySha = new Map<string, ComposerPlanEntry>()
  for (const p of plan) bySha.set(p.sha, p)
  todo.value = todo.value.map((e) => {
    const p = bySha.get(e.sha)
    if (!p) return e
    return {
      ...e,
      action: p.action,
      newMessage: p.action === 'reword' ? p.newMessage ?? e.subject : null,
    }
  })
}

const composerMut = useMutation({
  mutationFn: () => {
    if (repoId.value == null || ai.available.value == null) {
      return Promise.reject(new Error('AI 사용 불가 — Claude/Codex CLI 미설치'))
    }
    if (!confirmAiSend()) return Promise.reject(new Error('cancelled'))
    return aiComposerPlan(repoId.value, ai.available.value, todo.value.length, true)
  },
  onSuccess: (out) => {
    if (!out.success) {
      toast.error('AI 응답 실패', out.stderr || out.text || '')
      return
    }
    const plan = parseComposerPlan(out.text)
    if (plan.length === 0) {
      toast.error('AI 응답 파싱 실패', '응답이 JSON array 가 아니거나 비어있음.')
      return
    }
    applyComposerPlan(plan)
    const changed = plan.filter((p) => p.action !== 'pick').length
    toast.success(
      `✨ AI 제안 적용 (${changed}건 변경)`,
      'pick 외 액션 검토 후 Run rebase.',
    )
  },
  onError: (e) => {
    const m = describeError(e)
    if (m.includes('cancelled')) return
    toast.error('AI 호출 실패', m)
  },
})

const canRun = computed(() => {
  if (todo.value.length === 0) return false
  // reword 는 newMessage 비어있지 않아야 함.
  for (const e of todo.value) {
    if (e.action === 'reword' && !(e.newMessage ?? '').trim()) return false
  }
  return true
})

// 외부 트리거 (CommandPalette).
function externalOpen() {
  if (repoId.value == null) {
    toast.error('레포 미선택', '먼저 사이드바에서 레포를 선택하세요.')
    return
  }
  open.value = true
  step.value = 'setup'
  count.value = 5
  refreshStatus().then(() => {
    if (status.value?.inProgress) {
      // 이미 진행 중이면 result/conflict 화면으로 점프.
      step.value = 'result'
      lastResult.value = {
        success: false,
        exitCode: null,
        stdout: '',
        stderr: '',
        status: status.value,
      }
    }
  })
}

onMounted(() => {
  ;(window as unknown as {
    gitFriedOpenRebase?: () => void
  }).gitFriedOpenRebase = externalOpen
})
onUnmounted(() => {
  delete (window as unknown as { gitFriedOpenRebase?: () => void })
    .gitFriedOpenRebase
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="close"
    >
      <div
        class="flex max-h-[90vh] w-[720px] max-w-full flex-col rounded-lg border border-border bg-card shadow-xl"
      >
        <header
          class="flex items-center justify-between border-b border-border px-4 py-2.5"
        >
          <h2 class="text-sm font-semibold">Interactive rebase</h2>
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground"
            @click="close"
          >
            ✕
          </button>
        </header>

        <!-- step: setup -->
        <section v-if="step === 'setup'" class="flex flex-col gap-3 p-4">
          <p class="text-sm text-muted-foreground">
            마지막 몇 개 commit 을 편집할까요? (1 ~ 50)
          </p>
          <input
            v-model.number="count"
            type="number"
            min="1"
            max="50"
            class="w-32 rounded border border-border bg-background px-2 py-1 text-sm"
          />
          <p class="text-xs text-muted-foreground">
            진행 중 발생 가능: drop / reword / squash / fixup. 충돌 시 모달이 conflict
            상태를 표시합니다.
          </p>
          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              class="rounded border border-border px-3 py-1 text-sm hover:bg-accent/40"
              @click="close"
            >
              취소
            </button>
            <button
              type="button"
              class="rounded bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              :disabled="prepareMut.isPending.value || repoId == null"
              @click="prepareMut.mutate()"
            >
              {{ prepareMut.isPending.value ? '준비 중...' : '다음' }}
            </button>
          </div>
        </section>

        <!-- step: edit -->
        <section
          v-else-if="step === 'edit'"
          class="flex flex-1 flex-col overflow-hidden"
        >
          <p class="border-b border-border bg-muted/40 px-4 py-1.5 text-xs text-muted-foreground">
            드래그로 순서 변경 · 행마다 액션/메시지 편집 · 위쪽이 oldest, 아래쪽이 newest
          </p>
          <VueDraggable
            v-model="todo"
            tag="ul"
            class="flex-1 overflow-auto"
            handle=".rebase-drag"
            :animation="120"
          >
            <li
              v-for="(e, i) in todo"
              :key="e.sha"
              class="flex items-start gap-2 border-b border-border px-3 py-2"
            >
              <span class="rebase-drag mt-1 cursor-grab select-none text-muted-foreground">
                ⋮⋮
              </span>
              <select
                :value="e.action"
                class="rounded border border-border bg-background px-1 py-0.5 text-xs"
                :class="
                  e.action === 'drop'
                    ? 'text-red-500 line-through'
                    : e.action === 'reword'
                    ? 'text-blue-500'
                    : e.action === 'squash' || e.action === 'fixup'
                    ? 'text-amber-500'
                    : ''
                "
                @change="setAction(i, ($event.target as HTMLSelectElement).value as RebaseAction)"
              >
                <option value="pick">pick</option>
                <option value="reword">reword</option>
                <option value="squash">squash</option>
                <option value="fixup">fixup</option>
                <option value="drop">drop</option>
              </select>
              <div class="min-w-0 flex-1">
                <div class="font-mono text-xs">
                  <span class="text-muted-foreground">{{ e.sha.slice(0, 7) }}</span>
                  <span class="ml-2 truncate">{{ e.subject }}</span>
                </div>
                <textarea
                  v-if="e.action === 'reword'"
                  v-model="e.newMessage"
                  rows="3"
                  placeholder="새 commit 메시지 (한글 OK, 빈 줄 후 본문)"
                  class="mt-1.5 w-full rounded border border-blue-500/40 bg-background px-2 py-1 text-xs"
                />
              </div>
            </li>
          </VueDraggable>
          <footer class="flex justify-between gap-2 border-t border-border px-4 py-2">
            <button
              v-if="ai.available.value"
              type="button"
              class="rounded border border-border px-3 py-1 text-sm hover:bg-accent/40 disabled:opacity-50"
              :title="`✨ ${ai.available.value} 가 squash/reword/drop 제안`"
              :disabled="composerMut.isPending.value || todo.length === 0"
              @click="composerMut.mutate()"
            >
              ✨ {{ composerMut.isPending.value ? 'AI...' : 'AI 제안' }}
            </button>
            <span v-else />
            <div class="flex gap-2">
              <button
                type="button"
                class="rounded border border-border px-3 py-1 text-sm hover:bg-accent/40"
                @click="step = 'setup'"
              >
                뒤로
              </button>
              <button
                type="button"
                class="rounded bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                :disabled="!canRun || runMut.isPending.value"
                @click="runMut.mutate()"
              >
                {{ runMut.isPending.value ? '실행 중...' : 'Run rebase' }}
              </button>
            </div>
          </footer>
        </section>

        <!-- step: result / conflict -->
        <section v-else-if="step === 'result'" class="flex flex-col gap-3 p-4">
          <div v-if="status?.inProgress" class="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <p class="font-semibold text-amber-500">
              Rebase 진행 중 (step {{ status.currentStep ?? '?' }} / {{ status.totalSteps ?? '?' }})
            </p>
            <p v-if="status.conflict" class="mt-1 text-xs">
              충돌 발생: <span class="font-mono">{{ status.stoppedAt?.slice(0, 7) }}</span>.
              변경 패널 (⌘1) 에서 conflicted 파일을 해결한 후 [Continue] 클릭.
            </p>
            <p v-else class="mt-1 text-xs">
              사용자 개입 대기 중 (edit 액션 등).
            </p>
          </div>
          <div
            v-else-if="lastResult?.success"
            class="rounded border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-500"
          >
            ✔ Rebase 완료 ({{ todo.length }}개 commit 처리)
          </div>
          <div
            v-else
            class="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-500"
          >
            Rebase 실패 (exit {{ lastResult?.exitCode }})
          </div>

          <pre
            v-if="lastResult?.stderr"
            class="max-h-48 overflow-auto rounded border border-border bg-muted/40 p-2 text-[11px] text-muted-foreground"
          >{{ lastResult.stderr }}</pre>

          <footer class="flex justify-end gap-2 pt-2">
            <template v-if="status?.inProgress">
              <button
                type="button"
                class="rounded border border-red-500/60 px-3 py-1 text-sm text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                :disabled="abortMut.isPending.value"
                @click="abortMut.mutate()"
              >
                Abort
              </button>
              <button
                type="button"
                class="rounded border border-border px-3 py-1 text-sm hover:bg-accent/40 disabled:opacity-50"
                :disabled="skipMut.isPending.value"
                @click="skipMut.mutate()"
              >
                Skip
              </button>
              <button
                type="button"
                class="rounded bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                :disabled="continueMut.isPending.value"
                @click="continueMut.mutate()"
              >
                {{ continueMut.isPending.value ? '...' : 'Continue' }}
              </button>
            </template>
            <button
              v-else
              type="button"
              class="rounded bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground hover:opacity-90"
              @click="close"
            >
              닫기
            </button>
          </footer>
        </section>
      </div>
    </div>
  </Teleport>
</template>
