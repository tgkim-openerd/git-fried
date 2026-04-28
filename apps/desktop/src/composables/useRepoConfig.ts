// Per-repo .git/config 키 read/write composable (`docs/plan/14 §3` Sprint B14-3).
//
// Vue Query: ['repo-config', repoId] (NORMAL staleTime). 변경 후 invalidate.
// 폼 컴포넌트가 reactive 로 받아서 v-model 바인딩.
import { computed, type MaybeRefOrGetter, toRef } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  applyRepoConfig,
  readRepoConfig,
  type RepoConfigSnapshot,
} from '@/api/git'
import { STALE_TIME } from '@/api/queryClient'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'

export const EMPTY_REPO_CONFIG: RepoConfigSnapshot = {
  hooksPath: null,
  commitEncoding: null,
  logOutputEncoding: null,
  gitflowBranchMaster: null,
  gitflowBranchDevelop: null,
  gitflowPrefixFeature: null,
  gitflowPrefixRelease: null,
  gitflowPrefixHotfix: null,
  commitGpgsign: null,
  userSigningkey: null,
  gpgFormat: null,
  userName: null,
  userEmail: null,
}

export function useRepoConfig(repoIdRef: MaybeRefOrGetter<number | null>) {
  const repoId = toRef(repoIdRef)
  const qc = useQueryClient()
  const toast = useToast()

  const query = useQuery({
    queryKey: computed(() => ['repo-config', repoId.value]),
    queryFn: () => {
      if (repoId.value == null) return Promise.resolve(EMPTY_REPO_CONFIG)
      return readRepoConfig(repoId.value)
    },
    enabled: computed(() => repoId.value != null),
    staleTime: STALE_TIME.NORMAL,
  })

  const applyMut = useMutation({
    mutationFn: (snap: RepoConfigSnapshot) => {
      if (repoId.value == null) throw new Error('레포 미선택')
      return applyRepoConfig(repoId.value, snap)
    },
    onSuccess: () => {
      toast.success('Repo 설정 저장', '')
      qc.invalidateQueries({ queryKey: ['repo-config', repoId.value] })
    },
    onError: (e) => toast.error('Repo 설정 저장 실패', describeError(e)),
  })

  return { query, applyMut }
}
