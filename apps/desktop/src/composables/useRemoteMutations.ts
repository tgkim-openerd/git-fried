// v0.4 #5 (UltraPlan plan/31) god comp wave A — RemoteManageModal mutation 추출.
//
// 5 mutation (add / remove / rename / setUrl / fetchAll) + form state +
// invalidate helper 를 단일 composable 로 통합. component 는 caller-decision UI 만.
//
// useRemoteInteraction (c53 Pattern 9 sister) 와 별도:
//   - useRemoteInteraction = ContextMenu items builder (caller-decision)
//   - useRemoteMutations   = 5 mutation + form state (본 composable)

import { ref, toRef, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import {
  addRemote,
  fetchAll,
  removeRemote,
  renameRemote,
  setRemoteUrl,
  type RemoteInfo,
} from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'

export function useRemoteMutations(opts: { repoId: MaybeRefOrGetter<number | null> }) {
  const { t } = useI18n()
  const toast = useToast()
  const qc = useQueryClient()
  const repoIdRef = toRef(opts.repoId)

  function invalidate() {
    if (repoIdRef.value == null) return
    qc.invalidateQueries({ queryKey: ['remotes', repoIdRef.value] })
    qc.invalidateQueries({ queryKey: ['branches', repoIdRef.value] })
  }

  // === Form state ===
  const addName = ref('')
  const addUrl = ref('')
  const renameTarget = ref<string | null>(null)
  const renameNew = ref('')
  const urlTarget = ref<string | null>(null)
  const urlNew = ref('')

  function startRename(name: string) {
    renameTarget.value = name
    renameNew.value = name
  }
  function startUrlChange(r: RemoteInfo) {
    urlTarget.value = r.name
    urlNew.value = r.fetchUrl ?? r.pushUrl ?? ''
  }
  function resetFormState() {
    renameTarget.value = null
    renameNew.value = ''
    urlTarget.value = null
    urlNew.value = ''
  }

  // === add ===
  const addMut = useMutation({
    mutationFn: () => {
      if (repoIdRef.value == null) throw new Error(t('remote.errRepoNotSelected'))
      return addRemote(repoIdRef.value, addName.value.trim(), addUrl.value.trim())
    },
    onSuccess: () => {
      toast.success(t('remote.addedTitle'), addName.value)
      addName.value = ''
      addUrl.value = ''
      invalidate()
    },
    onError: (e) => toast.error(t('remote.addFailed'), describeError(e)),
  })

  // === remove ===
  const removeMut = useMutation({
    mutationFn: (name: string) => {
      if (repoIdRef.value == null) throw new Error(t('remote.errRepoNotSelected'))
      return removeRemote(repoIdRef.value, name)
    },
    onSuccess: (_v, name) => {
      toast.success(t('remote.removedTitle'), name)
      invalidate()
    },
    onError: (e) => toast.error(t('remote.removeFailed'), describeError(e)),
  })

  // === rename ===
  const renameMut = useMutation({
    mutationFn: () => {
      if (repoIdRef.value == null || !renameTarget.value)
        throw new Error(t('remote.errTargetNotSelected'))
      return renameRemote(repoIdRef.value, renameTarget.value, renameNew.value.trim())
    },
    onSuccess: () => {
      toast.success(
        t('remote.renamedTitle'),
        t('remote.renamedMessage', { from: renameTarget.value ?? '', to: renameNew.value }),
      )
      renameTarget.value = null
      renameNew.value = ''
      invalidate()
    },
    onError: (e) => toast.error(t('remote.renameFailed'), describeError(e)),
  })

  // === set URL ===
  const urlMut = useMutation({
    mutationFn: () => {
      if (repoIdRef.value == null || !urlTarget.value)
        throw new Error(t('remote.errTargetNotSelected'))
      return setRemoteUrl(repoIdRef.value, urlTarget.value, urlNew.value.trim())
    },
    onSuccess: () => {
      toast.success(t('remote.urlChangedTitle'), urlTarget.value ?? '')
      urlTarget.value = null
      urlNew.value = ''
      invalidate()
    },
    onError: (e) => toast.error(t('remote.urlChangeFailed'), describeError(e)),
  })

  // === Sprint 22-10 CM-12 — fetch all (단일 remote fetch IPC 미존재 → fetchAll 매핑). ===
  const fetchAllMut = useMutation({
    mutationFn: () => {
      if (repoIdRef.value == null) throw new Error(t('remote.errRepoNotSelected'))
      return fetchAll(repoIdRef.value)
    },
    onSuccess: () => {
      toast.success(t('remote.fetchAllSuccess'), t('remote.fetchAllSuccessMessage'))
      invalidate()
      if (repoIdRef.value != null) {
        qc.invalidateQueries({ queryKey: ['status', repoIdRef.value] })
        qc.invalidateQueries({ queryKey: ['log', repoIdRef.value] })
        qc.invalidateQueries({ queryKey: ['graph', repoIdRef.value] })
      }
    },
    onError: (e) => toast.error(t('remote.fetchAllFailed'), describeError(e)),
  })

  return {
    // form state
    addName,
    addUrl,
    renameTarget,
    renameNew,
    urlTarget,
    urlNew,
    // mutations
    addMut,
    removeMut,
    renameMut,
    urlMut,
    fetchAllMut,
    // helpers
    startRename,
    startUrlChange,
    resetFormState,
  }
}
