// Sprint c37 god comp 분리 21/N — GitKrakenToolbar.vue 의 stash / pop mutation 분리.
//
// 책임:
//   - stashMut (메시지 없이 즉시 stash, SEC-001 confirm)
//   - popMut (가장 최근 stash apply + drop, conflict 위험 confirm)
//   - onStash / onPop handler — repoId null / hasChanges / stashCount guard + confirm + mutate
//
// 사용:
//   const { stashMut, popMut, onStash, onPop } = useStashPopMutation({
//     repoId: () => props.repoId,
//     hasChanges,
//     stashCount,
//   })
//
// LOC 절감: GitKrakenToolbar 150-168 + 220-255 = 약 55 LOC.
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { popStash, pushStash } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { confirmDialog } from '@/composables/useConfirm'
import { useI18n } from 'vue-i18n'

export interface UseStashPopMutationOptions {
  repoId: () => number | null
  hasChanges: Ref<boolean>
  stashCount: Ref<number>
}

export function useStashPopMutation(options: UseStashPopMutationOptions) {
  const { repoId, hasChanges, stashCount } = options
  const toast = useToast()
  const invalidate = useInvalidateRepoQueries()
  const queryClient = useQueryClient()
  const { t } = useI18n()

  const stashMut = useMutation({
    mutationFn: (id: number) => pushStash(id, null, false),
    onSuccess: () => {
      const id = repoId()
      invalidate(id)
      queryClient.invalidateQueries({ queryKey: ['stash', id] })
      toast.success('Stash 완료', '메시지 없이 즉시 stash 됨')
    },
    onError: (e) => toast.error('Stash 실패', describeError(e)),
  })

  const popMut = useMutation({
    mutationFn: (id: number) => popStash(id, 0),
    onSuccess: () => {
      const id = repoId()
      invalidate(id)
      queryClient.invalidateQueries({ queryKey: ['stash', id] })
      toast.success('Pop 완료', '가장 최근 stash@{0} 적용')
    },
    onError: (e) => toast.error('Pop 실패', describeError(e)),
  })

  async function onStash() {
    const id = repoId()
    if (id == null) {
      toast.warning('레포 미선택', '먼저 레포를 선택하세요.')
      return
    }
    if (!hasChanges.value) {
      toast.info('Stash 할 변경사항 없음')
      return
    }
    // SEC-001 fix — destructive 액션 confirm (메시지 없이 즉시 stash).
    const ok = await confirmDialog({
      title: t('confirm.stashAllTitle'),
      message: t('confirm.stashAllMessage'),
      danger: true,
    })
    if (!ok) return
    stashMut.mutate(id)
  }

  async function onPop() {
    const id = repoId()
    if (id == null) {
      toast.warning('레포 미선택', '먼저 레포를 선택하세요.')
      return
    }
    if (stashCount.value === 0) {
      toast.info('Stash 없음', 'pop 할 stash 가 없습니다.')
      return
    }
    // SEC-001 fix — pop 은 apply + drop 자동, conflict 시 working tree 더러워짐.
    const ok = await confirmDialog({
      title: t('confirm.popStashTitle'),
      message: t('confirm.popLatestStashMessage', { remaining: stashCount.value }),
      danger: true,
    })
    if (!ok) return
    popMut.mutate(id)
  }

  return {
    stashMut,
    popMut,
    onStash,
    onPop,
  }
}
