// Sprint c103 (B-2) — usePrMutations 분할: PR 모달 footer 액션 mutation 부분.
//
// 책임: mergeMut / closeMut / reopenMut + onMerge / onClose(confirm dialog → mutate).
//   PrDetailModal.vue footer(merge/close/reopen 버튼)가 소유 — conversation 탭과 분리.
//
// useMutation 호출 순서는 #3=merge / #4=close / #5=reopen (usePrMutations wrapper 가
// conversation(#0~2) 다음에 본 composable 을 호출하므로 레거시 테스트 인덱스 보존).
import type { Ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { closePr, mergePr, reopenPr } from '@/api/git'
import type { MergeMethod } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useNotification } from '@/composables/useNotification'
import { useI18n } from 'vue-i18n'
import { confirmDialog } from '@/composables/useConfirm'

export interface UsePrActionMutationsOptions {
  repoId: () => number | null
  number: () => number | null
  mergeMethod: Ref<MergeMethod>
  onMergeClose: () => void
}

export function usePrActionMutations(opts: UsePrActionMutationsOptions) {
  const { t } = useI18n()
  const toast = useToast()
  const notification = useNotification()
  const qc = useQueryClient()

  // useMutation 호출 순서 #3.
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

  // useMutation 호출 순서 #4.
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

  // useMutation 호출 순서 #5.
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

  return { mergeMut, closeMut, reopenMut, onMerge, onClose }
}
