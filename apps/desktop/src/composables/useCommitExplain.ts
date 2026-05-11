// Sprint c67 — CommitDetailSidebar 의 Explain (✨ AI) mutation + dialog state 추출.
// Pattern 9 sister small variant (composable + mutation + dialog 통합).
//
// 책임:
//   - explainOpen / explainContent / explainError (3 ref dialog state)
//   - explainMut (vue-query mutation — AI CLI 확인 + IPC 호출 + result 분기)
//   - onExplainCommit handler (AI 가용 검증 + dialog open + mutate)
//
// 호출:
//   const { explainOpen, explainContent, explainError, explainMut, onExplainCommit }
//     = useCommitExplain({ repoId: () => props.repoId, sha: () => props.sha })
import { ref } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { aiExplainCommit } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useAiCli, confirmAiSend, notifyAiDone } from '@/composables/useAiCli'
import { useI18n } from 'vue-i18n'

export interface UseCommitExplainOptions {
  repoId: () => number | null
  sha: () => string | null
}

export function useCommitExplain(opts: UseCommitExplainOptions) {
  const { t } = useI18n()
  const toast = useToast()
  const ai = useAiCli()

  const explainOpen = ref(false)
  const explainContent = ref('')
  const explainError = ref<string | null>(null)

  const explainMut = useMutation({
    mutationFn: async () => {
      const id = opts.repoId()
      const sha = opts.sha()
      if (id == null || !sha) {
        throw new Error(t('commitDetail.errNoRepoCommit'))
      }
      if (ai.available.value == null) {
        throw new Error(t('commitDetail.errNoCli'))
      }
      if (!(await confirmAiSend())) throw new Error('cancelled')
      return aiExplainCommit(id, ai.available.value, sha, true)
    },
    onSuccess: (out) => {
      const sha = opts.sha()
      if (out.success) {
        explainContent.value = out.text
        explainError.value = null
        notifyAiDone(t('commitDetail.toastAiCli'), sha?.slice(0, 7) ?? '')
      } else {
        explainContent.value = ''
        explainError.value = out.stderr || out.text || t('commitDetail.errEmptyResponse')
      }
    },
    onError: (e) => {
      const m = describeError(e)
      if (m.includes('cancelled')) {
        explainOpen.value = false
        return
      }
      explainContent.value = ''
      explainError.value = m
    },
  })

  function onExplainCommit() {
    const sha = opts.sha()
    if (!sha) return
    if (ai.available.value == null) {
      toast.warning(t('commitDetail.toastAiUnavailable'), t('commitDetail.toastAiUnavailableBody'))
      return
    }
    explainOpen.value = true
    explainContent.value = ''
    explainError.value = null
    explainMut.mutate()
  }

  return {
    ai,
    explainOpen,
    explainContent,
    explainError,
    explainMut,
    onExplainCommit,
  }
}
