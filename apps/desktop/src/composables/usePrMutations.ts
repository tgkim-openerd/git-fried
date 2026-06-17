// Sprint c40 god comp 분리 — PrDetailModal.vue 의 6 mutation + 2 confirm handler +
// suggestion form state 분리. Sprint c103(B-2)에서 conversation/action 두 축으로
// 추가 분할 — 본 파일은 둘을 compose 하는 thin wrapper (레거시 통합 API + 테스트 호환).
//
// PrConversationTab.vue 는 usePrConversationMutations 를, PrDetailModal footer 는
// usePrActionMutations 를 직접 사용. 본 wrapper 는 통합 shape 가 필요한 호출부(및
// usePrMutations.test 의 mutateMockFns 호출 순서 0~5)를 위해 유지한다.
//
// **호출 순서 계약**: conversation(#0 suggestion / #1 addComment / #2 review) 다음에
// action(#3 merge / #4 close / #5 reopen) — usePrMutations.test 의 mutateMockFns 인덱스.
import type { Ref } from 'vue'
import type { MergeMethod, ReviewVerdict } from '@/api/git'
import { usePrConversationMutations } from '@/composables/usePrConversationMutations'
import { usePrActionMutations } from '@/composables/usePrActionMutations'

export interface UsePrMutationsOptions {
  repoId: () => number | null
  number: () => number | null
  newComment: Ref<string>
  reviewBody: Ref<string>
  verdict: Ref<ReviewVerdict>
  mergeMethod: Ref<MergeMethod>
  onMergeClose: () => void
}

export function usePrMutations(opts: UsePrMutationsOptions) {
  // 순서 보존: conversation 먼저(#0~2) → action(#3~5).
  const conversation = usePrConversationMutations(opts)
  const action = usePrActionMutations(opts)
  return {
    addCommentMut: conversation.addCommentMut,
    reviewMut: conversation.reviewMut,
    suggestion: conversation.suggestion,
    mergeMut: action.mergeMut,
    closeMut: action.closeMut,
    reopenMut: action.reopenMut,
    onMerge: action.onMerge,
    onClose: action.onClose,
  }
}
