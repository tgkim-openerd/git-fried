// Sprint c36 god 17/N — GitKrakenToolbar.vue 의 undo/redo mutation 영역 추출.
//
// 책임:
//   - undoMut / redoMut useMutation (undoLastAction / redoLastAction IPC)
//   - 결과 분기 (executed / rejected) 별 toast (성공 / 자동 미지원 안내)
//   - rejection 시 window.gitFriedOpenReflog 자동 호출 (ReflogModal 안내)
//   - 메시지 control char 위생화 (SEC-005)
//
// 부모 (GitKrakenToolbar) 는 wrapper 함수 (onUndo / onRedo) 만 호출.
import { useMutation } from '@tanstack/vue-query'
import { redoLastAction, undoLastAction, type UndoResult } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useInvalidateRepoQueries } from '@/composables/useStatus'

/** SEC-005 — reflog 출력의 control char (ANSI escape 등) 위생화. */
export function sanitizeReflogPreview(message: string): string {
  return (
    message
      .split(/\r?\n/)[0]
      ?.slice(0, 50)
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f]/g, '') ?? ''
  )
}

export function useUndoRedo(repoIdGetter: () => number | null) {
  const toast = useToast()
  const invalidate = useInvalidateRepoQueries()

  function handleResult(res: UndoResult, kind: 'Undo' | 'Redo'): void {
    const preview = sanitizeReflogPreview(res.message)
    const verb = kind === 'Undo' ? '되돌림' : '다시 적용'
    if (res.executed) {
      invalidate(repoIdGetter())
      toast.success(
        `${kind === 'Undo' ? 'Undid' : 'Redo'}: ${res.action}`,
        preview
          ? `'${preview}' ${verb} (${kind === 'Undo' ? '--soft, working tree 보존' : '재적용 완료'})`
          : `${verb} 완료`,
      )
    } else {
      const title =
        kind === 'Undo' ? `${res.action} 은 자동 undo 미지원` : `Redo 거부 (${res.action})`
      toast.warning(title, (res.rejectionReason ?? '') + ' — Reflog 모달에서 직접 처리하세요.')
      // 거부된 경우 ReflogModal 자동 오픈 — 사용자 후속 액션 가이드.
      window.gitFriedOpenReflog?.()
    }
  }

  const undoMut = useMutation({
    mutationFn: (id: number) => undoLastAction(id),
    onSuccess: (res) => handleResult(res, 'Undo'),
    onError: (e) => toast.error('Undo 실패', describeError(e)),
  })

  const redoMut = useMutation({
    mutationFn: (id: number) => redoLastAction(id),
    onSuccess: (res) => handleResult(res, 'Redo'),
    onError: (e) => toast.error('Redo 실패', describeError(e)),
  })

  return { undoMut, redoMut }
}
