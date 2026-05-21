// Sprint c40 god comp 분리 — GitKrakenToolbar.vue 의 fetch/pull/push 3 mutation 분리
// (/analyze MEDIUM 3, GitKrakenToolbar 495 → 412 LOC).
//
// 책임:
//   - fetchMut (fetch_all + invalidate)
//   - pullMut (pull strategy + autoUpdateSubmodules 분기)
//   - pushMut (setUpstream 자동 결정)
//   - usePullStrategy 영속 + dropdown 가시성 ref 통합
//
// 사용:
//   const { fetchMut, pullMut, pushMut, pullStrategy, setPullStrategy,
//           pullStrategyLabel, pullDropdownOpen } = useToolbarSyncMutations({
//     repoId: () => props.repoId,
//     upstream: () => props.upstream,
//   })
//
// LOC 절감: GitKrakenToolbar 86-149 + import 5줄 = 약 70 LOC 절감 효과.
import { ref } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { fetchAll, pull, push, updateSubmodules } from '@/api/git'
import { describeError, humanizeGitError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { useGeneralSettings } from '@/composables/useUserSettings'
import { usePullStrategy, type PullStrategy } from '@/composables/usePullStrategy'

export interface UseToolbarSyncMutationsOptions {
  repoId: () => number | null
  upstream: () => string | null
}

export function useToolbarSyncMutations(opts: UseToolbarSyncMutationsOptions) {
  const { t } = useI18n()
  const toast = useToast()
  const invalidate = useInvalidateRepoQueries()
  const general = useGeneralSettings()

  const fetchMut = useMutation({
    mutationFn: (id: number) => fetchAll(id),
    onSuccess: (res) => {
      invalidate(opts.repoId())
      if (res.success) {
        toast.success(t('toolbar.fetchSuccess'))
      } else {
        toast.error(
          t('toolbar.fetchFailedExit', { code: res.exitCode }),
          humanizeGitError(res.stderr),
        )
      }
    },
    onError: (e) => toast.error(t('toolbar.fetchInvokeFailed'), describeError(e)),
  })

  const pullMut = useMutation({
    mutationFn: ({ id, strategy }: { id: number; strategy: PullStrategy }) =>
      pull({
        repoId: id,
        rebase: strategy === 'rebase',
        ffOnly: strategy === 'ff-only',
        noRebase: strategy === 'no-rebase',
      }),
    onSuccess: async (res) => {
      const id = opts.repoId()
      invalidate(id)
      if (res.success) {
        toast.success(t('toolbar.pullSuccess'))
        if (general.value.autoUpdateSubmodules && id != null) {
          try {
            await updateSubmodules(id, false)
            toast.success(t('toolbar.submoduleUpdateSuccess'), '')
          } catch (e) {
            toast.error(t('toolbar.submoduleUpdateFailed'), describeError(e))
          }
        }
      } else {
        toast.error(
          t('toolbar.pullFailedExit', { code: res.exitCode }),
          humanizeGitError(res.stderr),
        )
      }
    },
    onError: (e) => toast.error(t('toolbar.pullInvokeFailed'), describeError(e)),
  })

  // B4-04 — push 옵션 (force-with-lease / tags) 노출.
  const pushMut = useMutation({
    mutationFn: (arg: number | { id: number; forceWithLease?: boolean; tags?: boolean }) => {
      const id = typeof arg === 'number' ? arg : arg.id
      const o: { forceWithLease?: boolean; tags?: boolean } = typeof arg === 'number' ? {} : arg
      return push({
        repoId: id,
        setUpstream: !opts.upstream(),
        forceWithLease: o.forceWithLease,
        tags: o.tags,
      })
    },
    onSuccess: (res) => {
      invalidate(opts.repoId())
      if (res.success) {
        toast.success(t('toolbar.pushSuccess'))
      } else {
        toast.error(
          t('toolbar.pushFailedExit', { code: res.exitCode }),
          humanizeGitError(res.stderr),
        )
      }
    },
    onError: (e) => toast.error(t('toolbar.pushInvokeFailed'), describeError(e)),
  })

  const { pullStrategy, setPullStrategy, pullStrategyLabel } = usePullStrategy()
  const pullDropdownOpen = ref(false)
  // B4-04 — push 옵션 dropdown 가시성.
  const pushDropdownOpen = ref(false)

  return {
    fetchMut,
    pullMut,
    pushMut,
    pullStrategy,
    setPullStrategy,
    pullStrategyLabel,
    pullDropdownOpen,
    pushDropdownOpen,
  }
}
