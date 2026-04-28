// Sprint c26-2 (`docs/plan/25 §c26-2`) — CommitDiffModal / CommitDiffPanel 공통 로직.
//
// 두 컴포넌트가 데이터 fetching + AI Explain + commit actions + hunk navigation 을
// 동일하게 사용한다. composable 로 추출해 코드 중복 제거.

import { computed, type ComputedRef, ref, type Ref } from 'vue'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { aiExplainCommit, getCommitDiff, type ResetMode } from '@/api/git'
import { describeError } from '@/api/errors'
import { STALE_TIME } from '@/api/queryClient'
import { useAiCli, confirmAiSend, notifyAiDone } from '@/composables/useAiCli'
import { useCommitActions } from '@/composables/useCommitActions'
import { useDiffMode } from '@/composables/useDiffMode'
import { useShortcut } from '@/composables/useShortcuts'

export interface UseCommitDiffOptions {
  repoId: () => number | null
  sha: () => string | null
  /** Modal 의 경우 open=false 시 query 비활성. Panel 은 항상 true. */
  enabled?: () => boolean
}

export function useCommitDiff(options: UseCommitDiffOptions) {
  const diffMode = useDiffMode()
  const repoIdRef = computed(() => options.repoId())
  const shaRef = computed(() => options.sha())
  const enabledRef = computed(() => options.enabled?.() ?? true)

  // === Diff data fetching ===
  const { data, isFetching, error } = useQuery({
    queryKey: computed(
      () => ['commit-diff', repoIdRef.value, shaRef.value, diffMode.mode.value] as const,
    ),
    queryFn: () => {
      const id = repoIdRef.value
      const sha = shaRef.value
      if (id == null || sha == null) return Promise.resolve('')
      return getCommitDiff(id, sha, diffMode.contextLines.value)
    },
    enabled: computed(
      () =>
        enabledRef.value &&
        repoIdRef.value != null &&
        shaRef.value != null &&
        (shaRef.value?.length ?? 0) > 0,
    ),
    staleTime: STALE_TIME.STATIC,
  })

  // === AI Explain ===
  const ai = useAiCli()
  const explainOpen = ref(false)
  const explainContent = ref('')
  const explainError: Ref<string | null> = ref(null)

  const explainMut = useMutation({
    mutationFn: () => {
      const id = repoIdRef.value
      const sha = shaRef.value
      if (id == null || sha == null) return Promise.reject(new Error('레포/sha 미선택'))
      if (ai.available.value == null) {
        return Promise.reject(new Error('Claude/Codex CLI 미설치'))
      }
      if (!confirmAiSend()) return Promise.reject(new Error('cancelled'))
      return aiExplainCommit(id, ai.available.value, sha, true)
    },
    onSuccess: (out) => {
      if (out.success) {
        explainContent.value = out.text
        explainError.value = null
        notifyAiDone('AI commit 설명', shaRef.value?.slice(0, 7))
      } else {
        explainContent.value = ''
        explainError.value = out.stderr || out.text || '응답 실패'
      }
    },
    onError: (e) => {
      const m = describeError(e)
      if (m.includes('cancelled')) {
        explainOpen.value = false
        return
      }
      explainContent.value = ''
      explainError.value = m
    },
  })

  function explain() {
    explainOpen.value = true
    explainContent.value = ''
    explainError.value = null
    explainMut.mutate()
  }

  // === Commit actions (cherry-pick / revert / reset) ===
  const commitActions = useCommitActions(() => repoIdRef.value)
  const resetMode: Ref<ResetMode> = ref('mixed')

  function onCherryPick() {
    if (shaRef.value) void commitActions.cherryPick(shaRef.value)
  }
  function onRevert() {
    if (shaRef.value) void commitActions.revert(shaRef.value)
  }
  function onReset() {
    if (shaRef.value) void commitActions.reset(shaRef.value, resetMode.value)
  }

  // === Hunk navigation (patch text 기준 카운트, DiffViewer ref 는 호출자가 보유) ===
  // ARCH-012 fix — `^@@ -\d` 으로 hunk header signature 까지 매칭 (false positive 방지).
  const hunkCount: ComputedRef<number> = computed(() => {
    const patch = data.value
    if (!patch) return 0
    const m = patch.match(/^@@ -\d/gm)
    return m ? m.length : 0
  })
  const hunkNavDisabled = computed(() => hunkCount.value <= 1)

  /**
   * ARCH-002 fix — Modal/Panel 가 동시에 mount 된 상태에서 양쪽 hunk nav shortcut 가
   * 충돌하지 않도록 enabledRef 로 활성 여부를 캡슐화.
   *
   * 호출자가 DiffViewer ref + enabledRef 를 넘기면 Alt+↑/↓ 단축키 등록.
   * enabledRef false 시 핸들러는 no-op — 한 시점에 한 instance 만 작동 보장.
   */
  type DiffViewerExposeLike = {
    nextHunk: () => void
    prevHunk: () => void
  }
  function registerHunkNavShortcut(
    diffRef: Ref<DiffViewerExposeLike | null>,
    enabledRef: Ref<boolean> | ComputedRef<boolean>,
  ) {
    useShortcut('prevHunk', () => {
      if (!enabledRef.value) return
      if (hunkNavDisabled.value) return
      diffRef.value?.prevHunk()
    })
    useShortcut('nextHunk', () => {
      if (!enabledRef.value) return
      if (hunkNavDisabled.value) return
      diffRef.value?.nextHunk()
    })
  }

  return {
    // Diff
    diffMode,
    data,
    isFetching,
    error,
    // AI Explain
    ai,
    explainOpen,
    explainContent,
    explainError,
    explainMut,
    explain,
    // Commit actions
    resetMode,
    onCherryPick,
    onRevert,
    onReset,
    // Hunk
    hunkCount,
    hunkNavDisabled,
    registerHunkNavShortcut,
  }
}
