// Sprint c63-B — InteractiveRebaseModal god comp 추출 (Pattern 9 sister, large 변형).
//
// 원본 SFC 211 LOC script — 5 mutation + 6 state ref + 4 handler 통합. small sister
// (ContextMenu builder, ~50 LOC) 와 분리, large 변형 — state machine + mutation 묶음.
//
// 추출 책임:
//   - state: open / step / count / todo / lastResult / status
//   - 5 mutation: prepareMut / runMut / continueMut / skipMut / abortMut
//   - handlers: close / refreshStatus / setAction / canRun / externalOpen
//
// SFC 잔여 책임:
//   - import + destructure (5 LOC)
//   - aiComp (useAiComposer 위임 — 별도 composable, 그대로 유지)
//   - window.gitFriedOpenRebase 트리거 등록 (onMounted/onUnmounted)
//   - template (변경 없음)
//
// LOC 절감: SFC 211 -> ~55 LOC script.
import { computed, ref } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import {
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
import { describeError, humanizeGitError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { useI18n } from 'vue-i18n'

export type Step = 'setup' | 'edit' | 'running' | 'result'

export interface UseInteractiveRebaseFlowOptions {
  repoId: () => number | null
}

export function useInteractiveRebaseFlow(opts: UseInteractiveRebaseFlowOptions) {
  const { t } = useI18n()
  const toast = useToast()
  const invalidate = useInvalidateRepoQueries()

  const open = ref(false)
  const step = ref<Step>('setup')
  const count = ref(5)
  const todo = ref<RebaseTodoEntry[]>([])
  const lastResult = ref<RebaseRunResult | null>(null)
  const status = ref<RebaseStatus | null>(null)

  function close() {
    open.value = false
    step.value = 'setup'
    todo.value = []
    lastResult.value = null
    status.value = null
  }

  async function refreshStatus() {
    const id = opts.repoId()
    if (id == null) return
    try {
      status.value = await getRebaseStatus(id)
    } catch {
      /* ignore */
    }
  }

  const prepareMut = useMutation({
    mutationFn: () => {
      const id = opts.repoId()
      if (id == null) throw new Error(t('interactiveRebase.errNoRepo'))
      return rebasePrepareTodo(id, count.value)
    },
    onSuccess: (entries) => {
      todo.value = entries
      step.value = 'edit'
    },
    onError: (e) => toast.error(t('interactiveRebase.toastTodoFailed'), describeError(e)),
  })

  const runMut = useMutation({
    mutationFn: () => {
      const id = opts.repoId()
      if (id == null) throw new Error(t('interactiveRebase.errNoRepo'))
      const base = `HEAD~${todo.value.length}`
      return rebaseRun(id, base, todo.value)
    },
    onSuccess: (res) => {
      lastResult.value = res
      status.value = res.status
      step.value = 'result'
      invalidate(opts.repoId())
      if (res.success) {
        toast.success(
          t('interactiveRebase.toastSuccess'),
          t('interactiveRebase.toastSuccessBody', { n: todo.value.length }),
        )
      } else if (res.status.conflict) {
        toast.error(
          t('interactiveRebase.toastConflict'),
          t('interactiveRebase.toastConflictBody', {
            current: res.status.currentStep,
            total: res.status.totalSteps,
          }),
        )
      } else {
        toast.error(t('interactiveRebase.toastFailed'), humanizeGitError(res.stderr))
      }
    },
    onError: (e) => {
      toast.error(t('interactiveRebase.toastRunFailed'), describeError(e))
      step.value = 'edit'
    },
  })

  const continueMut = useMutation({
    mutationFn: () => {
      const id = opts.repoId()
      if (id == null) throw new Error(t('interactiveRebase.errNoRepo'))
      return rebaseContinue(id)
    },
    onSuccess: (res) => {
      lastResult.value = res
      status.value = res.status
      invalidate(opts.repoId())
      if (res.success) toast.success(t('interactiveRebase.toastContinueSuccess'))
    },
    onError: (e) => toast.error(t('interactiveRebase.toastContinueFailed'), describeError(e)),
  })

  const skipMut = useMutation({
    mutationFn: () => {
      const id = opts.repoId()
      if (id == null) throw new Error(t('interactiveRebase.errNoRepo'))
      return rebaseSkip(id)
    },
    onSuccess: (res) => {
      lastResult.value = res
      status.value = res.status
      invalidate(opts.repoId())
    },
    onError: (e) => toast.error(t('interactiveRebase.toastSkipFailed'), describeError(e)),
  })

  const abortMut = useMutation({
    mutationFn: () => {
      const id = opts.repoId()
      if (id == null) throw new Error(t('interactiveRebase.errNoRepo'))
      return rebaseAbort(id)
    },
    onSuccess: () => {
      invalidate(opts.repoId())
      toast.success(t('interactiveRebase.toastAbortSuccess'))
      close()
    },
    onError: (e) => toast.error(t('interactiveRebase.toastAbortFailed'), describeError(e)),
  })

  function setAction(idx: number, action: RebaseAction) {
    const e = todo.value[idx]
    if (!e) return
    todo.value[idx] = {
      ...e,
      action,
      newMessage: action === 'reword' ? (e.newMessage ?? e.subject) : null,
    }
  }

  const canRun = computed(() => {
    if (todo.value.length === 0) return false
    // reword 는 newMessage 비어있지 않아야 함.
    for (const e of todo.value) {
      if (e.action === 'reword' && !(e.newMessage ?? '').trim()) return false
    }
    return true
  })

  /**
   * 외부 트리거 — CommandPalette 의 window.gitFriedOpenRebase 핸들러.
   * repoId null 시 toast.error 후 미진행. 이미 진행 중 rebase 가 있으면 result step 으로 점프.
   */
  function externalOpen() {
    if (opts.repoId() == null) {
      toast.error(t('interactiveRebase.errNoRepo'), t('interactiveRebase.errNoRepoBody'))
      return
    }
    open.value = true
    step.value = 'setup'
    count.value = 5
    refreshStatus().then(() => {
      // TYPE-005 — optional chaining 대신 명시 narrowing (status.value non-null 보장).
      if (status.value && status.value.inProgress) {
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

  return {
    // state
    open,
    step,
    count,
    todo,
    lastResult,
    status,
    // mutations
    prepareMut,
    runMut,
    continueMut,
    skipMut,
    abortMut,
    // handlers
    close,
    refreshStatus,
    setAction,
    canRun,
    externalOpen,
  }
}
