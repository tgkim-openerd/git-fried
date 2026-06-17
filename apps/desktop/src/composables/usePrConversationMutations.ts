// Sprint c103 (B-2) — usePrMutations 분할: PR conversation 탭 mutation 부분.
//
// 책임: addCommentMut / reviewMut + suggestion form state(open/path/line/newCode/
//   context + reset) + suggestionMut. PrConversationTab.vue 가 자체 소유.
//
// usePrMutations(레거시 통합)는 본 composable + usePrActionMutations 를 compose 하는
// thin wrapper 로 유지(테스트 호환 — useMutation 호출 순서 0=suggestion,1=addComment,
// 2=review 를 보존하려면 wrapper 가 conversation→action 순서로 호출해야 함).
import { ref, type Ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { addPrComment, addReviewComment, submitPrReview } from '@/api/git'
import type { ReviewVerdict } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useI18n } from 'vue-i18n'

export interface UsePrConversationMutationsOptions {
  repoId: () => number | null
  number: () => number | null
  newComment: Ref<string>
  reviewBody: Ref<string>
  verdict: Ref<ReviewVerdict>
}

export function usePrConversationMutations(opts: UsePrConversationMutationsOptions) {
  const { t } = useI18n()
  const toast = useToast()
  const qc = useQueryClient()

  // Suggestion form state.
  const suggestionOpen = ref(false)
  const sugPath = ref('')
  const sugLine = ref<number | null>(null)
  const sugNewCode = ref('')
  const sugContext = ref('')

  function resetSuggestion() {
    suggestionOpen.value = false
    sugPath.value = ''
    sugLine.value = null
    sugNewCode.value = ''
    sugContext.value = ''
  }

  // useMutation 호출 순서 #0 (usePrMutations.test mutateMockFns[0]).
  const suggestionMut = useMutation({
    mutationFn: () => {
      const id = opts.repoId()
      const num = opts.number()
      if (id == null || num == null) return Promise.reject(new Error('no selection'))
      if (!sugPath.value.trim() || sugLine.value == null || sugLine.value < 1) {
        return Promise.reject(new Error(t('pr.errPathLineRequired')))
      }
      if (!sugNewCode.value.trim()) {
        return Promise.reject(new Error(t('pr.errNewCodeRequired')))
      }
      const ctx = sugContext.value.trim()
      const body =
        (ctx ? `${ctx}\n\n` : '') +
        '```suggestion\n' +
        sugNewCode.value.replace(/\n+$/, '') +
        '\n```'
      return addReviewComment(id, num, sugPath.value.trim(), sugLine.value, body)
    },
    onSuccess: () => {
      toast.success(t('pr.suggestionAdded'), `${sugPath.value}:${sugLine.value}`)
      resetSuggestion()
      qc.invalidateQueries({ queryKey: ['pr-comments', opts.repoId(), opts.number()] })
    },
    onError: (e) => toast.error(t('pr.suggestionAddFailed'), describeError(e)),
  })

  // useMutation 호출 순서 #1.
  const addCommentMut = useMutation({
    mutationFn: () => {
      const id = opts.repoId()
      const num = opts.number()
      if (id == null || num == null) return Promise.reject(new Error('no selection'))
      return addPrComment(id, num, opts.newComment.value)
    },
    onSuccess: () => {
      opts.newComment.value = ''
      qc.invalidateQueries({ queryKey: ['pr-comments', opts.repoId(), opts.number()] })
    },
    onError: (e) => toast.error(t('pr.commentAddFailed'), describeError(e)),
  })

  // useMutation 호출 순서 #2.
  const reviewMut = useMutation({
    mutationFn: () => {
      const id = opts.repoId()
      const num = opts.number()
      if (id == null || num == null) return Promise.reject(new Error('no selection'))
      return submitPrReview(id, num, opts.verdict.value, opts.reviewBody.value)
    },
    onSuccess: () => {
      opts.reviewBody.value = ''
      opts.verdict.value = 'comment'
      qc.invalidateQueries({ queryKey: ['pr-comments'] })
      qc.invalidateQueries({ queryKey: ['pr'] })
      qc.invalidateQueries({ queryKey: ['prs'] })
      qc.invalidateQueries({ queryKey: ['launchpad-prs'] })
    },
    onError: (e) => toast.error(t('pr.reviewSubmitFailed'), describeError(e)),
  })

  return {
    addCommentMut,
    reviewMut,
    suggestion: {
      open: suggestionOpen,
      path: sugPath,
      line: sugLine,
      newCode: sugNewCode,
      context: sugContext,
      mut: suggestionMut,
      reset: resetSuggestion,
    },
  }
}
