// Sprint c40 후속 review ARCH-004 — CommitGraph.vue 의 ref hide / solo
// (useRefVisibility / useHiddenRefMutations / useSoloRef 통합 + helper) 외부화.
//
// 책임:
//   - useRefVisibility / useHiddenRefMutations / useSoloRef 3 composable 통합
//   - toggleSoloRef(name) — HEAD prefix trim + solo 토글
//   - hideRefByName(name) — refKindOf 자동 + hide mutate
//   - refKindOf(name) — branch / remote / tag / stash 판정
//
// 사용:
//   const { visibleRef, soloRef, toggleSoloRef, hideRefByName, refKindOf } =
//     useGraphRefVisibility(() => props.repoId)
//
// LOC 절감: CommitGraph 65-89 (~25 LOC) → 5 LOC destructure.
import { useHiddenRefMutations, useRefVisibility, useSoloRef } from '@/composables/useHiddenRefs'
import type { HiddenRefKind } from '@/api/git'

export function useGraphRefVisibility(repoId: () => number | null) {
  const { visibleFn: visibleRef, soloRef } = useRefVisibility(repoId)
  const { hide: hideMut } = useHiddenRefMutations(repoId)
  const { setSolo } = useSoloRef(repoId)

  function toggleSoloRef(name: string) {
    const trimmed = name.replace(/^HEAD ->\s*/, '').trim()
    setSolo(soloRef.value === trimmed ? null : trimmed)
  }

  /// branch / remote / tag / stash 자동 판정.
  function refKindOf(name: string): HiddenRefKind {
    if (name.startsWith('refs/tags/') || name.startsWith('tag: ')) return 'tag'
    if (name.startsWith('stash@') || name === 'stash') return 'stash'
    // origin/main, upstream/feature 등 = remote
    if (name.includes('/') && !name.startsWith('refs/heads/')) return 'remote'
    return 'branch'
  }

  function hideRefByName(name: string) {
    // "HEAD -> main" 같이 표시 prefix 가 있을 수 있음 → tail 만 추출.
    const trimmed = name.replace(/^HEAD ->\s*/, '').trim()
    hideMut.mutate({ refName: trimmed, refKind: refKindOf(trimmed) })
  }

  return {
    visibleRef,
    soloRef,
    toggleSoloRef,
    refKindOf,
    hideRefByName,
  }
}
