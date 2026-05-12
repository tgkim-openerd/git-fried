// Sprint c79-D — StashPanel 187 → <140 LOC 잠복 god comp 추출.
//
// 6 simple action (apply/pop/drop/show/stashToBranch/editMessage/applyFile) + AI stash
// mutation 통합. caller-decision: 모든 입력 ref / preview ref 는 caller (SFC) 보유.
//
// 책임:
//   - applyStash / popStash / dropStash / showStash IPC + invalidate + toast
//   - stashToBranch + editMessage 의 promptDialog 흐름
//   - applyStashFile (preview 안 단일 파일 apply)
//   - aiStashMessage mutation (confirm + IPC + onSuccess/onError)
//
// caller (StashPanel.vue) 는 previewText/previewIndex/newMessage/includeUntracked ref 유지.
import { type Ref, type MaybeRefOrGetter, toRef } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import {
  aiStashMessage,
  applyStash,
  applyStashFile,
  dropStash,
  editStashMessage,
  popStash,
  showStash,
  stashToBranch,
} from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { confirmDialog, promptDialog } from '@/composables/useConfirm'
import { useAiCli, confirmAiSend, notifyAiDone } from '@/composables/useAiCli'
import { useI18n } from 'vue-i18n'

interface UseStashPanelActionsOpts {
  repoId: MaybeRefOrGetter<number | null>
  /** preview 결과 set — onShow 에서 갱신, 텍스트 또는 에러 메시지 */
  previewText: Ref<string | null>
  previewIndex: Ref<number | null>
  /** AI 결과 onSuccess 시 prefill */
  newMessage: Ref<string>
  /** AI stash message 요청 시 untracked 포함 여부 */
  includeUntracked: Ref<boolean>
}

export function useStashPanelActions(opts: UseStashPanelActionsOpts) {
  const { t } = useI18n()
  const toast = useToast()
  const invalidate = useInvalidateRepoQueries()
  const repoId = toRef(opts.repoId)
  const ai = useAiCli()

  async function onApply(idx: number) {
    if (repoId.value == null) return
    await applyStash(repoId.value, idx).catch((e) => toast.error('Apply 실패', describeError(e)))
    invalidate(repoId.value)
  }

  async function onPop(idx: number) {
    if (repoId.value == null) return
    await popStash(repoId.value, idx).catch((e) => toast.error('Pop 실패', describeError(e)))
    invalidate(repoId.value)
  }

  async function onDrop(idx: number) {
    if (repoId.value == null) return
    const ok = await confirmDialog({
      title: t('confirm.deleteStashTitle'),
      message: t('confirm.deleteStashMessage', { idx }),
      danger: true,
    })
    if (!ok) return
    await dropStash(repoId.value, idx).catch((e) => toast.error('Drop 실패', describeError(e)))
    invalidate(repoId.value)
  }

  async function onShow(idx: number) {
    if (repoId.value == null) return
    opts.previewIndex.value = idx
    opts.previewText.value = await showStash(repoId.value, idx).catch((e) => describeError(e))
  }

  // c38 / plan/29 E3 + fix MED-1 — stash → 새 브랜치 (promptDialog).
  async function onStashToBranch(idx: number) {
    if (repoId.value == null) return
    const name = await promptDialog({
      title: t('stash.branchPromptTitle'),
      message: t('stash.branchPromptMessage'),
      defaultValue: `stash-${idx}-recover`,
    })
    if (name === null) return
    const trimmed = name.trim()
    if (!trimmed) return
    await stashToBranch(repoId.value, idx, trimmed)
      .then(() => {
        toast.success(t('stash.branchSuccess'), trimmed)
        invalidate(repoId.value)
      })
      .catch((e) => toast.error(t('stash.branchFailed'), describeError(e)))
  }

  // C14 D2 + c38 fix MED-1 — stash 메시지 수정 (promptDialog + i18n).
  async function onEditMessage(idx: number, current: string) {
    if (repoId.value == null) return
    const next = await promptDialog({
      title: t('stash.editMessageTitle', { idx }),
      message: t('stash.editMessageMessage'),
      defaultValue: current,
    })
    if (next === null) return
    const trimmed = next.trim()
    if (!trimmed || trimmed === current) return
    await editStashMessage(repoId.value, idx, trimmed)
      .then(() => {
        toast.success(t('stash.editMessageSuccess'), t('stash.editMessageSuccessDetail'))
        invalidate(repoId.value)
      })
      .catch((e) => toast.error(t('stash.editMessageFailed'), describeError(e)))
  }

  // C2 (plan/14 §5 D1) — stash 안 단일 파일 apply.
  async function onApplyFile(path: string) {
    if (repoId.value == null || opts.previewIndex.value == null) return
    await applyStashFile(repoId.value, opts.previewIndex.value, path)
      .then(() => {
        toast.success(t('toast.fileApply'), `${path} 만 working tree 에 적용됨`)
        invalidate(repoId.value)
      })
      .catch((e) => toast.error(t('errors.fileApplyFailed'), describeError(e)))
  }

  // B7 — AI stash message generate (confirm + IPC + parse first line).
  const aiMut = useMutation({
    mutationFn: async () => {
      if (repoId.value == null || ai.available.value == null) {
        throw new Error('AI 사용 불가 — Claude/Codex CLI 미설치')
      }
      if (!(await confirmAiSend())) throw new Error('cancelled')
      return aiStashMessage(repoId.value, ai.available.value, opts.includeUntracked.value, true)
    },
    onSuccess: (out) => {
      if (out.success) {
        opts.newMessage.value = out.text.trim().split(/\r?\n/)[0] ?? ''
        notifyAiDone('AI stash 메시지', opts.newMessage.value)
      } else {
        toast.error('AI 응답 실패', out.stderr || out.text)
      }
    },
    onError: (e) => {
      const m = describeError(e)
      if (m.includes('cancelled')) return
      toast.error('AI 호출 실패', m)
    },
  })

  return {
    ai,
    aiMut,
    onApply,
    onPop,
    onDrop,
    onShow,
    onStashToBranch,
    onEditMessage,
    onApplyFile,
  }
}
