// Sprint c33 god comp 분리 10/N — CommitMessageInput.vue 의 commit mutation 영역 추출.
//
// 책임:
//   - lastResult ref (실패 panel 표시)
//   - commitMut useMutation (ipcCommit + 결과 분기)
//   - commit(noVerify) 호출 helper
//   - hookKind(stderr) 분류 (husky / lefthook / pre-commit)
//
// 부모 (CommitMessageInput) 는 form state (subject/body/footer/freeMessage/amend) 만 보유.
// onSuccess 시 부모의 resetForm 콜백 호출 → form clear + amend 토글 해제.
//
// Conflict marker 감지 (R-2A C5) 는 composable 내부 — toast 발화.

import { ref } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { commit as ipcCommit, push as ipcPush } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useInvalidateRepoQueries, useStatus } from '@/composables/useStatus'
import { useGeneralSettings } from '@/composables/useUserSettings'
import { localBranchName } from '@/composables/useBranchActions'
import type { CommitResult } from '@/types/git'
import { i18n } from '@/i18n'

const t = i18n.global.t

export interface UseCommitMutationOptions {
  /** 활성 레포 id getter (반응성). */
  repoId: () => number | null
  /** Conventional / free 모드에서 조립된 최종 메시지 getter. */
  finalMessage: () => string
  /** signoff 토글 getter. */
  signoff: () => boolean
  /** amend 토글 ref — 성공 시 자동으로 false 로 초기화. */
  amend: { value: boolean }
  /** 성공 시 form state 정리 콜백 (subject/body/footer/freeMessage/breaking 등 부모 책임). */
  resetForm: () => void
  /** 성공 시 emit('committed') 위임. */
  onCommitted: () => void
}

/** hook 출력에서 husky / lefthook 마커 감지. */
export function hookKind(stderr: string): string | null {
  if (/husky/i.test(stderr)) return 'husky'
  if (/lefthook/i.test(stderr)) return 'lefthook'
  if (/pre-commit/i.test(stderr)) return 'pre-commit'
  return null
}

const CONFLICT_HINTS = [
  /<{4,7}\s*HEAD/, // <<<<<<< HEAD
  /needs merge/i,
  /unmerged paths/i,
  /conflicting files/i,
  /you have unmerged files/i,
] as const

/** stdout/stderr 에 conflict marker 잔존 신호가 있는지 검사. */
export function hasConflictHints(res: { stdout?: string; stderr?: string }): boolean {
  const merged = `${res.stdout ?? ''}\n${res.stderr ?? ''}`
  return CONFLICT_HINTS.some((re) => re.test(merged))
}

export function useCommitMutation(opts: UseCommitMutationOptions) {
  const toast = useToast()
  const invalidate = useInvalidateRepoQueries()
  // Plan #42 M-1.2 wire (Sprint c97+) — commit 성공 후 commitPushAfter 설정 시
  // 자동 push. useStatus(opts.repoId) 로 현재 active branch 조회.
  const general = useGeneralSettings()
  const status = useStatus(() => opts.repoId())

  const lastResult = ref<CommitResult | null>(null)

  const commitMut = useMutation({
    mutationFn: ({ noVerify }: { noVerify: boolean }) => {
      const id = opts.repoId()
      if (id == null) return Promise.reject(new Error('no repo'))
      return ipcCommit({
        repoId: id,
        message: opts.finalMessage(),
        signoff: opts.signoff(),
        noVerify,
        amend: opts.amend.value,
      })
    },
    onSuccess: (res) => {
      if (res.success) {
        lastResult.value = null
        opts.resetForm()
        // Amend 성공 시 토글 해제 (다음 commit 은 일반 commit 로).
        opts.amend.value = false
        invalidate(opts.repoId())
        opts.onCommitted()
        // Plan #42 M-1.2 wire — commitPushAfter true 시 자동 push.
        // useStatus 의 branch 사용 (HEAD 의 short ref 형태). detached HEAD 또는
        // branch 미정 시 push skip + warning. branch fail 시 silent.
        if (general.value.commitPushAfter) {
          const repoId = opts.repoId()
          const branchName = status.data.value?.branch ?? null
          if (repoId != null && branchName) {
            ipcPush({
              repoId,
              branch: localBranchName(branchName),
              setUpstream: false,
            })
              .then((r) => {
                if (r.success) {
                  toast.success(t('toast.pushSuccess'), branchName)
                  invalidate(repoId)
                } else {
                  toast.warning(t('toast.pushAfterCommitFailed'), describeError(r))
                }
              })
              .catch((e) => {
                toast.error(t('toast.pushAfterCommitFailed'), describeError(e))
              })
          } else {
            toast.warning(
              t('toast.pushAfterCommitSkipped'),
              t('toast.pushAfterCommitSkippedReason'),
            )
          }
        }
      } else {
        // pre-commit hook 실패 등 — inline panel 로 표시.
        lastResult.value = res
        // R-2A C5 (`docs/plan/22 §2 C5`): conflict marker 가 stderr 에 보이면
        // 사용자에게 어디 충돌인지 안내. git 은 "<<<<<<<" 라인이 남으면 거부.
        if (hasConflictHints(res)) {
          toast.warning(
            '⚠ Conflict marker 가 남아 있습니다',
            'StatusPanel 의 "Conflicted" 섹션에서 충돌 파일을 열어 ours/theirs 를 선택하고 stage 하세요. (또는 우측 패널의 ⚔ Merge editor)',
          )
        }
      }
    },
    onError: (e) => toast.error(t('errors.commitInvokeFailed'), describeError(e)),
  })

  function commit(noVerifyOverride: boolean) {
    if (opts.repoId() == null) return
    commitMut.mutate({ noVerify: noVerifyOverride })
  }

  function clearLastResult() {
    lastResult.value = null
  }

  return {
    lastResult,
    commitMut,
    commit,
    clearLastResult,
  }
}
