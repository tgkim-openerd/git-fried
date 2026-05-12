// Sprint c78-A — CommitGraph 202→<200 LOC 회귀 해소.
//
// CommitGraph 의 lifecycle (mount/watch/unmount) + window 글로벌 hook 등록을 단일 composable.
//   - onMounted: nextTick draw / window keydown / window.gitFriedSelectCommit 등록
//   - watch repoId: scrollTop reset (virtualizer cache reactive)
//   - onUnmounted: keydown 해제 / cleanupGraphWidth / window hook 정리
//
// caller 는 redraw / keydown handler / scroll container / select-and-scroll fn 만 주입.
// Pattern 9 caller-decision — composable 은 hook 등록만, business logic 은 caller.
import { onMounted, onUnmounted, type Ref, watch, nextTick } from 'vue'

interface UseCommitGraphLifecycleArgs {
  containerRef: Ref<HTMLElement | null>
  repoIdRef: Ref<number | null> | (() => number | null)
  draw: () => void
  onKeydown: (ev: KeyboardEvent) => void
  cleanup: () => void
  selectAndScrollToSha: (sha: string) => boolean | void
}

export function useCommitGraphLifecycle(args: UseCommitGraphLifecycleArgs): void {
  const { containerRef, repoIdRef, draw, onKeydown, cleanup, selectAndScrollToSha } = args

  onMounted(() => {
    nextTick(() => draw())
    window.addEventListener('keydown', onKeydown)
    window.gitFriedSelectCommit = selectAndScrollToSha
  })

  // Sprint c76 — repo 전환 시 scrollTop reset (virtualizer scroll cache reactive).
  watch(
    typeof repoIdRef === 'function' ? repoIdRef : () => repoIdRef.value,
    () => {
      if (containerRef.value) containerRef.value.scrollTop = 0
    },
  )

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown)
    cleanup()
    delete window.gitFriedSelectCommit
  })
}
