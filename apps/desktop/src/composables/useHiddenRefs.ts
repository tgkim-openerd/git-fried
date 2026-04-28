// Hidden / Solo refs — `docs/plan/11 §5d` (Sprint A1).
//
// Hidden = SQLite 영속 (재시작 후 유지).
// Solo   = 세션 메모리 (앱 종료 시 reset). 한 번에 1 ref 만 solo.
//
// Frontend 가 BranchPanel / CommitGraph 렌더 전 `isVisibleRef(name)` 호출 →
// Hidden 셋 + Solo (있으면 그 ref 제외 모두 hidden) 결합 결과 반환.

import { computed, ref, type ComputedRef, type MaybeRefOrGetter, toRef } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import {
  hideRef as apiHideRef,
  hideRefsBulk,
  listHiddenRefs,
  unhideAllRefs,
  unhideRef as apiUnhideRef,
  unhideRefsByKind,
  type HiddenRef,
  type HiddenRefKind,
} from '@/api/git'
import { STALE_TIME } from '@/api/queryClient'
import { useToast } from '@/composables/useToast'
import { describeError } from '@/api/errors'

export function hiddenRefsKey(repoId: number | null): readonly unknown[] {
  return ['hiddenRefs', repoId] as const
}

export function useHiddenRefs(repoIdRef: MaybeRefOrGetter<number | null>) {
  const repoId = toRef(repoIdRef)
  return useQuery({
    queryKey: computed(() => hiddenRefsKey(repoId.value)),
    queryFn: () => {
      if (repoId.value == null) return Promise.resolve<HiddenRef[]>([])
      return listHiddenRefs(repoId.value)
    },
    enabled: computed(() => repoId.value != null),
    staleTime: STALE_TIME.STATIC, // hide 빈도 낮음
  })
}

export function useHiddenRefMutations(repoIdRef: MaybeRefOrGetter<number | null>) {
  const qc = useQueryClient()
  const toast = useToast()
  const repoId = toRef(repoIdRef)

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['hiddenRefs'] })
    qc.invalidateQueries({ queryKey: ['graph'] })
  }

  function onError(title: string) {
    return (e: unknown) => toast.error(title, describeError(e))
  }

  const hide = useMutation({
    mutationFn: ({ refName, refKind }: { refName: string; refKind: HiddenRefKind }) => {
      if (repoId.value == null) throw new Error('레포 미선택')
      return apiHideRef(repoId.value, refName, refKind)
    },
    onSuccess: () => invalidate(),
    onError: onError('Ref 숨김 실패'),
  })

  const unhide = useMutation({
    mutationFn: (refName: string) => {
      if (repoId.value == null) throw new Error('레포 미선택')
      return apiUnhideRef(repoId.value, refName)
    },
    onSuccess: () => invalidate(),
    onError: onError('Ref 표시 복원 실패'),
  })

  const bulkHide = useMutation({
    mutationFn: (refs: { refName: string; refKind: HiddenRefKind }[]) => {
      if (repoId.value == null) throw new Error('레포 미선택')
      return hideRefsBulk(repoId.value, refs)
    },
    onSuccess: () => invalidate(),
    onError: onError('Ref 일괄 숨김 실패'),
  })

  const unhideKind = useMutation({
    mutationFn: (kind: HiddenRefKind) => {
      if (repoId.value == null) throw new Error('레포 미선택')
      return unhideRefsByKind(repoId.value, kind)
    },
    onSuccess: () => invalidate(),
    onError: onError('종류별 표시 복원 실패'),
  })

  const unhideAll = useMutation({
    mutationFn: () => {
      if (repoId.value == null) throw new Error('레포 미선택')
      return unhideAllRefs(repoId.value)
    },
    onSuccess: () => invalidate(),
    onError: onError('전체 표시 복원 실패'),
  })

  return { hide, unhide, bulkHide, unhideKind, unhideAll }
}

// ---------------- Solo (세션 메모리, 1 ref) ----------------

interface SoloState {
  // 한 번에 1 ref 만 solo. (repoId, refName) 식별.
  byRepo: Map<number, string>
}

const soloState = ref<SoloState>({ byRepo: new Map() })

/**
 * Solo 활성 ref 를 reactive 로 노출.
 * 같은 ref 다시 호출 시 toggle off.
 */
export function useSoloRef(repoIdRef: MaybeRefOrGetter<number | null>) {
  const repoId = toRef(repoIdRef)

  const current = computed<string | null>(() => {
    if (repoId.value == null) return null
    return soloState.value.byRepo.get(repoId.value) ?? null
  })

  function setSolo(refName: string | null) {
    if (repoId.value == null) return
    const next = new Map(soloState.value.byRepo)
    if (refName == null) {
      next.delete(repoId.value)
    } else if (next.get(repoId.value) === refName) {
      // toggle off
      next.delete(repoId.value)
    } else {
      next.set(repoId.value, refName)
    }
    soloState.value = { byRepo: next }
  }

  function clear() {
    setSolo(null)
  }

  return { current, setSolo, clear }
}

/**
 * 그래프 / BranchPanel 렌더링 전 호출.
 * Hidden + Solo 결합 결과 — `(refName) => boolean` (true = visible).
 */
export function useRefVisibility(
  repoIdRef: MaybeRefOrGetter<number | null>,
): {
  visibleFn: ComputedRef<(refName: string) => boolean>
  hiddenSet: ComputedRef<Set<string>>
  soloRef: ComputedRef<string | null>
} {
  const { data: hiddenList } = useHiddenRefs(repoIdRef)
  const { current: soloRef } = useSoloRef(repoIdRef)

  const hiddenSet = computed<Set<string>>(() => {
    const s = new Set<string>()
    for (const h of hiddenList.value ?? []) s.add(h.refName)
    return s
  })

  const visibleFn = computed(() => {
    const hidden = hiddenSet.value
    const solo = soloRef.value
    return (refName: string) => {
      if (solo) return refName === solo
      return !hidden.has(refName)
    }
  })

  return { visibleFn, hiddenSet, soloRef }
}
