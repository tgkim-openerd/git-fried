// Sprint c44 W4 — BranchPanel god comp 추가 추출 (218 → ~168 LOC).
// Hide/Solo 통합 + bulk hide / toggle action 제공.
//
// useHiddenRefs (state) + useHiddenRefMutations (mutations) + useSoloRef (session)
// 를 한 곳에서 묶어 BranchPanel 의 inline 50 LOC 를 5 LOC import 로 축약.

import { computed, type ComputedRef, type MaybeRefOrGetter, toRef } from 'vue'
import { useToast } from '@/composables/useToast'
import { describeError } from '@/api/errors'
import { useHiddenRefs, useHiddenRefMutations, useSoloRef } from '@/composables/useHiddenRefs'
import type { BranchInfo, HiddenRefKind } from '@/api/git'
import { i18n } from '@/i18n'

const t = i18n.global.t

function refKindOf(b: BranchInfo): HiddenRefKind {
  return b.kind === 'remote' ? 'remote' : 'branch'
}

export interface BranchVisibilityActions {
  hiddenSet: ComputedRef<Set<string>>
  soloRef: ComputedRef<string | null>
  isHidden: (name: string) => boolean
  toggleHide: (b: BranchInfo) => void
  toggleSolo: (b: BranchInfo) => void
  setSolo: (refName: string | null) => void
  bulkHideKind: (kind: HiddenRefKind, branches: BranchInfo[] | undefined) => void
  unhideAll: () => void
}

export function useBranchVisibilityActions(
  repoIdRef: MaybeRefOrGetter<number | null>,
): BranchVisibilityActions {
  const toast = useToast()
  const repoId = toRef(repoIdRef)

  const { data: hiddenList } = useHiddenRefs(repoIdRef)
  const hiddenMut = useHiddenRefMutations(repoIdRef)
  const { current: soloRef, setSolo } = useSoloRef(repoIdRef)

  const hiddenSet = computed<Set<string>>(() => {
    const s = new Set<string>()
    for (const h of hiddenList.value ?? []) s.add(h.refName)
    return s
  })

  function isHidden(name: string): boolean {
    return hiddenSet.value.has(name)
  }

  function toggleHide(b: BranchInfo) {
    if (repoId.value == null) return
    if (isHidden(b.name)) {
      hiddenMut.unhide.mutate(b.name)
    } else {
      hiddenMut.hide.mutate({ refName: b.name, refKind: refKindOf(b) })
    }
  }

  function toggleSolo(b: BranchInfo) {
    setSolo(b.name)
  }

  function bulkHideKind(kind: HiddenRefKind, branches: BranchInfo[] | undefined) {
    if (!branches) return
    const targets = branches
      .filter((b) => refKindOf(b) === kind && !isHidden(b.name))
      .map((b) => ({ refName: b.name, refKind: kind }))
    if (targets.length === 0) {
      toast.success(t('branch.toastBulkHideAlready'), '')
      return
    }
    hiddenMut.bulkHide.mutate(targets, {
      onSuccess: (n) => toast.success(`${n}개 hidden`, kind),
      onError: (e) => toast.error(t('branch.toastBulkHideFailed'), describeError(e)),
    })
  }

  function unhideAll() {
    if (repoId.value == null) return
    hiddenMut.unhideAll.mutate()
  }

  return { hiddenSet, soloRef, isHidden, toggleHide, toggleSolo, setSolo, bulkHideKind, unhideAll }
}
