// Sprint c80-1 — repositories.vue 184 → <140 LOC 추출.
//
// 3 mutation (addRepoMut / pinMut / bulkFetchMut) + bulkFetch 결과 toast 흐름 통합.
// caller-decision: bulkResultStore 는 caller (page) 보유, composable 은 mutation 결과 set 만 담당.
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { addRepo, bulkFetch, removeRepo, setRepoPinned } from '@/api/git'
import { describeError, humanizeGitError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useReposStore } from '@/stores/repos'
import { useI18n } from 'vue-i18n'
import type { useBulkFetchResult } from '@/composables/useBulkFetchResult'

interface UseRepoManagementMutationsOpts {
  /** bulk fetch 결과 set — caller 의 useBulkFetchResult store */
  bulkResultStore: ReturnType<typeof useBulkFetchResult>
}

export function useRepoManagementMutations(opts: UseRepoManagementMutationsOpts) {
  const qc = useQueryClient()
  const toast = useToast()
  const { t } = useI18n()
  const store = useReposStore()

  const addRepoMut = useMutation({
    mutationFn: addRepo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['repos-all-for-management'] }),
  })

  // R2-R1 — 저장소 추적 해제 (DB 항목 제거, 디스크 파일은 보존).
  const removeRepoMut = useMutation({
    mutationFn: (id: number) => removeRepo(id),
    onSuccess: (_r, id) => {
      // 제거된 repo 의 탭 / active 정리.
      store.closeTab(id)
      qc.invalidateQueries({ queryKey: ['repos-all-for-management'] })
      qc.invalidateQueries({ queryKey: ['repos'] })
      toast.success(t('repos.removeSuccess'), '')
    },
    onError: (e) => toast.error(t('repos.removeFailed'), describeError(e)),
  })

  const pinMut = useMutation({
    mutationFn: ({ id, pinned }: { id: number; pinned: boolean }) => setRepoPinned(id, pinned),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['repos-all-for-management'] }),
  })

  const bulkFetchMut = useMutation({
    mutationFn: () => bulkFetch(null),
    onSuccess: (results) => {
      qc.invalidateQueries({ queryKey: ['status'] })
      qc.invalidateQueries({ queryKey: ['log'] })
      qc.invalidateQueries({ queryKey: ['graph'] })
      qc.invalidateQueries({ queryKey: ['branches'] })
      opts.bulkResultStore.set(results)
      const failed = results.filter((r) => !r.success)
      const ok = results.length - failed.length
      if (failed.length > 0) {
        const PREVIEW = 5
        const lines = failed
          .slice(0, PREVIEW)
          .map((f) => `- ${f.repoName}: ${humanizeGitError((f.error || '').split('\n')[0] || '')}`)
        if (failed.length > PREVIEW) {
          lines.push(t('repos.bulkResultMore', { n: failed.length - PREVIEW }))
        }
        toast.warning(
          t('repos.bulkFetchResult', { ok, total: results.length, failed: failed.length }),
          lines.join('\n'),
        )
      } else if (results.length > 0) {
        toast.success(t('repos.bulkFetchSuccess', { n: ok }))
      }
    },
    onError: (e) => toast.error(t('errors.bulkFetchFailed'), describeError(e)),
  })

  return { addRepoMut, pinMut, bulkFetchMut, removeRepoMut }
}
