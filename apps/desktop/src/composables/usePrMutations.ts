// Sprint c40 god comp 분리 — PrDetailModal.vue (589 LOC) 의 6 mutation +
// 2 confirm handler + suggestion form state 분리 (/analyze 후속).
//
// 책임:
//   - addCommentMut / reviewMut / mergeMut / closeMut / reopenMut + suggestionMut
//   - onMerge / onClose (confirm dialog → mutate)
//   - suggestion form state (open / path / line / newCode / context + reset)
//
// 사용:
//   const {
//     addCommentMut, reviewMut, mergeMut, closeMut, reopenMut,
//     suggestion, onMerge, onClose, resetForm,
//   } = usePrMutations({
//     repoId: () => props.repoId,
//     number: () => props.number,
//     newComment, reviewBody, verdict, mergeMethod,
//     onMergeClose: () => emit('close'),
//   })
//
// LOC 절감: PrDetailModal 96-202 + 228-248 (~ 125 LOC) → ~30 LOC.
import { ref, type Ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import {
  addPrComment,
  addReviewComment,
  closePr,
  mergePr,
  reopenPr,
  submitPrReview,
} from '@/api/git'
import type { MergeMethod, ReviewVerdict } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useNotification } from '@/composables/useNotification'
import { useI18n } from 'vue-i18n'
import { confirmDialog } from '@/composables/useConfirm'

export interface UsePrMutationsOptions {
  repoId: () => number | null
  number: () => number | null
  newComment: Ref<string>
  reviewBody: Ref<string>
  verdict: Ref<ReviewVerdict>
  mergeMethod: Ref<MergeMethod>
  onMergeClose: () => void
}

export function usePrMutations(opts: UsePrMutationsOptions) {
  const { t } = useI18n()
  const toast = useToast()
  const notification = useNotification()
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

  const mergeMut = useMutation({
    mutationFn: () => {
      const id = opts.repoId()
      const num = opts.number()
      if (id == null || num == null) return Promise.reject(new Error('no selection'))
      return mergePr(id, num, opts.mergeMethod.value)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pr'] })
      qc.invalidateQueries({ queryKey: ['prs'] })
      qc.invalidateQueries({ queryKey: ['launchpad-prs'] })
      const num = opts.number() ?? ''
      toast.success(t('pr.mergeSuccess'), `#${num}`)
      void notification.notify(t('pr.mergeSuccess'), `#${num}`)
      opts.onMergeClose()
    },
    onError: (e) => toast.error(t('pr.mergeFailed'), describeError(e)),
  })

  const closeMut = useMutation({
    mutationFn: () => {
      const id = opts.repoId()
      const num = opts.number()
      if (id == null || num == null) return Promise.reject(new Error('no selection'))
      return closePr(id, num)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pr'] })
      qc.invalidateQueries({ queryKey: ['prs'] })
    },
    onError: (e) => toast.error(t('pr.closeFailed'), describeError(e)),
  })

  const reopenMut = useMutation({
    mutationFn: () => {
      const id = opts.repoId()
      const num = opts.number()
      if (id == null || num == null) return Promise.reject(new Error('no selection'))
      return reopenPr(id, num)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pr'] })
      qc.invalidateQueries({ queryKey: ['prs'] })
    },
    onError: (e) => toast.error(t('pr.reopenFailed'), describeError(e)),
  })

  async function onMerge() {
    const ok = await confirmDialog({
      title: t('confirm.mergePrTitle'),
      message: t('confirm.mergePrMessage', {
        method: opts.mergeMethod.value,
        number: opts.number(),
      }),
      danger: true,
    })
    if (!ok) return
    mergeMut.mutate()
  }

  async function onClose() {
    const ok = await confirmDialog({
      title: t('confirm.closePrTitle'),
      message: t('confirm.closePrMessage', { number: opts.number() }),
      danger: true,
    })
    if (!ok) return
    closeMut.mutate()
  }

  return {
    addCommentMut,
    reviewMut,
    mergeMut,
    closeMut,
    reopenMut,
    suggestion: {
      open: suggestionOpen,
      path: sugPath,
      line: sugLine,
      newCode: sugNewCode,
      context: sugContext,
      mut: suggestionMut,
      reset: resetSuggestion,
    },
    onMerge,
    onClose,
  }
}
