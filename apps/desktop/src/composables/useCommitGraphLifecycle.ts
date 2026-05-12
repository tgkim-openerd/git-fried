// Sprint c78-A — CommitGraph 202→<200 LOC 회귀 해소.
// Sprint c79 ARCH-002/003 fix:
//   - repoIdRef: Ref|getter union → MaybeRefOrGetter 통일 (Pattern 11 family, sister Sticky 와 정합)
//   - window.gitFriedSelectCommit register 책임 caller 위임 → useGlobalCommitJumpHook 별도 composable
//
// 본 composable 책임:
//   - onMounted: nextTick draw / window keydown 등록
//   - watch repoId: scrollTop reset (virtualizer scroll cache reactive)
//   - onUnmounted: keydown 해제 / cleanupGraphWidth
//
// caller-decision: composable 은 lifecycle hook 등록만, business logic / global namespace 는 caller.
import {
  onMounted,
  onUnmounted,
  type MaybeRefOrGetter,
  type Ref,
  toRef,
  watch,
  nextTick,
} from 'vue'

interface UseCommitGraphLifecycleArgs {
  containerRef: Ref<HTMLElement | null>
  repoIdRef: MaybeRefOrGetter<number | null>
  draw: () => void
  onKeydown: (ev: KeyboardEvent) => void
  cleanup: () => void
}

export function useCommitGraphLifecycle(args: UseCommitGraphLifecycleArgs): void {
  const { containerRef, draw, onKeydown, cleanup } = args
  const repoId = toRef(args.repoIdRef)

  onMounted(() => {
    nextTick(() => draw())
    window.addEventListener('keydown', onKeydown)
  })

  // Sprint c76 — repo 전환 시 scrollTop reset (virtualizer scroll cache reactive).
  watch(repoId, () => {
    if (containerRef.value) containerRef.value.scrollTop = 0
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown)
    cleanup()
  })
}

// Sprint c79 ARCH-003 — window.gitFriedSelectCommit 등록 단일책임 composable (Pattern 9 sister small).
// Mini sidebar (StashList 등) 의 commit jump 진입점. 본 composable 자체는 lifecycle 만 — 등록 함수는 caller 가 주입.
export function useGlobalCommitJumpHook(fn: (sha: string) => boolean): void {
  onMounted(() => {
    window.gitFriedSelectCommit = fn
  })
  onUnmounted(() => {
    delete window.gitFriedSelectCommit
  })
}
