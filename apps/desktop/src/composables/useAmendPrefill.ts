// Sprint c79-C — CommitMessageInput 193 → <150 LOC 잠복 god comp 추출.
//
// Amend 토글 ON 시 마지막 commit 메시지를 prefill. SFC 의 watch 50 LOC 통째로 흡수.
//
// 책임:
//   - amend ref watch (immediate=false, repoId 도 trigger)
//   - SEC-006: 이미 push 된 commit 의 amend 는 force-push 필요 → confirmDialog
//   - 입력 보호: 사용자가 이미 입력 중이면 prefill 안 함
//   - Conventional 패턴 (`type(scope)!: subject`) 매치 → builder 모드 갱신
//   - Conventional 미매치 → free 모드 + 메시지 통째
//
// caller-decision: 모든 ref (mode/type/scope/breaking/subject/body/freeMessage) 는 caller 보유.
import { type Ref, watch } from 'vue'
import { lastCommitMessage } from '@/api/git'
import { describeError } from '@/api/errors'
import { isConventionalType, type ConventionalType } from '@/types/git'
import { confirmDialog } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useI18n } from 'vue-i18n'

interface UseAmendPrefillOpts {
  amend: Ref<boolean>
  /** repoId getter (props.repoId reactive) */
  repoId: () => number | null
  /** ahead getter — 0 시 push 된 amend → confirm 필요 */
  ahead: () => number
  mode: Ref<'conventional' | 'free'>
  type: Ref<ConventionalType>
  scope: Ref<string>
  breaking: Ref<boolean>
  subject: Ref<string>
  body: Ref<string>
  freeMessage: Ref<string>
}

export function useAmendPrefill(opts: UseAmendPrefillOpts): void {
  const { t } = useI18n()
  const toast = useToast()

  watch(
    [opts.amend, opts.repoId],
    async ([on, id]) => {
      if (!on || id == null) return

      // SEC-006 — 이미 push 된 commit (ahead === 0 + upstream) 의 amend 는 force-push 필요.
      if (opts.ahead() === 0) {
        const ok = await confirmDialog({
          title: t('confirm.amendPushedTitle'),
          message: t('confirm.amendPushedMessage'),
          danger: true,
        })
        if (!ok) {
          opts.amend.value = false
          return
        }
      }

      // 사용자가 이미 입력 중이면 보호.
      const hasInput =
        opts.mode.value === 'free'
          ? opts.freeMessage.value.trim().length > 0
          : opts.subject.value.trim().length > 0
      if (hasInput) return

      try {
        const last = await lastCommitMessage(id)
        if (!last) return
        applyParsed(opts, last)
      } catch (e) {
        toast.error(t('commitInput.errFetchLastFailed'), describeError(e))
      }
    },
    { immediate: false },
  )
}

function applyParsed(opts: UseAmendPrefillOpts, last: string): void {
  const lines = last.split(/\r?\n/)
  const m = lines[0].match(/^(\w+)(?:\(([^)]+)\))?(!?):\s*(.+)$/)
  if (m && isConventionalType(m[1])) {
    opts.type.value = m[1]
    opts.scope.value = m[2] || ''
    opts.breaking.value = m[3] === '!'
    opts.subject.value = m[4]
    const bodyStart = lines.findIndex((l, i) => i > 0 && l.trim() === '')
    if (bodyStart > 0) {
      opts.body.value = lines
        .slice(bodyStart + 1)
        .join('\n')
        .trim()
    }
    opts.mode.value = 'conventional'
  } else {
    opts.mode.value = 'free'
    opts.freeMessage.value = last
  }
}
