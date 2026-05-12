/**
 * Sprint c75-C — pages/index.vue commit selection state + handlers + auto-default watch 분리.
 *
 * Sprint c30 / GitKraken UX:
 *   selectedSha === WIP_SHA → 우측 staging UI (StatusPanel + CommitMessageInput)
 *   selectedSha 일반 sha → 우측 commit detail
 *   selectedSha === null → 우측 placeholder
 *
 * Auto-default 우선순위 (working dir dirty 면 WIP, clean 이면 latest commit):
 *   user 가 명시 선택 (row click / ESC) 했으면 재적용 안 함 (userChoseSha=true).
 *   status / graphData 둘 다 도착 후 결정 (race 회피).
 *   activeRepoId 변경 시 selectedSha + userChoseSha 모두 reset.
 *
 * ESC 키 + window.gitFriedShowDiff register lifecycle 도 함께 관리.
 */
import { onMounted, onUnmounted, ref, watch, type Ref } from 'vue'

export const WIP_SHA = '__WIP__'

interface StatusLike {
  isClean?: boolean
}
interface GraphLike {
  rows: ReadonlyArray<{ commit: { sha: string } }>
}

export function useCommitSelection(opts: {
  status: Readonly<Ref<StatusLike | undefined | null>>
  graphData: Readonly<Ref<GraphLike | undefined | null>>
  activeRepoId: () => number | null
}) {
  const selectedSha = ref<string | null>(null)
  const diffModalOpen = ref(false)
  // user 가 한 번이라도 row click / ESC 했으면 true → 이후 auto-default 비활성.
  const userChoseSha = ref(false)

  // commit row 단일 클릭: 같은 sha 면 toggle (해제), 다른 sha 면 set.
  function onSelectCommit(sha: string) {
    userChoseSha.value = true
    if (selectedSha.value === sha) {
      selectedSha.value = null
      return
    }
    selectedSha.value = sha
  }

  // WIP row 클릭: WIP_SHA toggle (staging UI ↔ placeholder).
  function onSelectWip() {
    userChoseSha.value = true
    if (selectedSha.value === WIP_SHA) {
      selectedSha.value = null
      return
    }
    selectedSha.value = WIP_SHA
  }

  // CommitDiffModal 진입 — WIP_SHA 는 commit diff 대상 아님 (sentinel).
  function onShowDiff(sha: string) {
    if (sha === WIP_SHA) return
    selectedSha.value = sha
    diffModalOpen.value = true
  }

  // ESC = commit 선택 해제 (모달/palette 가 열려있으면 skip).
  function onEscKey(e: KeyboardEvent) {
    if (e.key !== 'Escape') return
    const ae = document.activeElement
    if (
      ae &&
      (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.closest('[role="dialog"]'))
    ) {
      return
    }
    if (selectedSha.value != null) {
      userChoseSha.value = true
      selectedSha.value = null
    }
  }

  // activeRepoId 변경 시 selection reset.
  watch(opts.activeRepoId, () => {
    selectedSha.value = null
    userChoseSha.value = false
  })

  // Auto-default — status + graphData 둘 다 도착 후. user 명시 선택 시 skip.
  watch(
    [opts.status, opts.graphData],
    ([s, g]) => {
      if (userChoseSha.value || selectedSha.value != null) return
      if (!s || !g) return
      if (!s.isClean) {
        selectedSha.value = WIP_SHA
      } else if (g.rows.length > 0) {
        selectedSha.value = g.rows[0].commit.sha
      }
    },
    { immediate: true },
  )

  onMounted(() => {
    window.addEventListener('keydown', onEscKey)
    // Sprint 22-4 V-6 — ReflogModal / 외부 트리거 → CommitDiffModal 진입.
    window.gitFriedShowDiff = onShowDiff
  })
  onUnmounted(() => {
    window.removeEventListener('keydown', onEscKey)
    delete window.gitFriedShowDiff
  })

  return {
    selectedSha,
    diffModalOpen,
    userChoseSha,
    onSelectCommit,
    onSelectWip,
    onShowDiff,
  }
}
