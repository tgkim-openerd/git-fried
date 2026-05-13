// v0.5 #16 (UltraPlan plan/31) god comp wave B — StatusBar conflict explain 분리.
//
// 5 reactive state (explainOpen / explainContent / explainError / explainMut)
// + suggestResolution() handler 를 단일 composable 로 추출. StatusBar 167→<120 LOC.
//
// caller-decision (Pattern 9):
//   - repoId / head branch / target branch 를 getter 로 주입
//   - aiAvailable getter 도 caller 제공 (useAiCli 별도 호출 회피)

import { ref, type MaybeRefOrGetter, toRef } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { aiExplainBranch, type AiCli } from '@/api/git'
import { describeError } from '@/api/errors'
import { confirmAiSend, notifyAiDone } from '@/composables/useAiCli'

export interface UseConflictExplainOpts {
  repoId: MaybeRefOrGetter<number | null>
  head: MaybeRefOrGetter<string | null>
  target: MaybeRefOrGetter<string | null>
  aiAvailable: MaybeRefOrGetter<AiCli | null>
}

export function useConflictExplain(opts: UseConflictExplainOpts) {
  const repoIdRef = toRef(opts.repoId)
  const headRef = toRef(opts.head)
  const targetRef = toRef(opts.target)
  const aiAvailableRef = toRef(opts.aiAvailable)

  const explainOpen = ref(false)
  const explainContent = ref('')
  const explainError = ref<string | null>(null)

  const explainMut = useMutation({
    mutationFn: async () => {
      const repoId = repoIdRef.value
      const head = headRef.value
      const target = targetRef.value
      if (repoId == null || !head || !target) {
        throw new Error('레포/브랜치/target 미확정')
      }
      const ai = aiAvailableRef.value
      if (ai == null) {
        throw new Error('Claude/Codex CLI 미설치')
      }
      if (!(await confirmAiSend())) throw new Error('cancelled')
      return aiExplainBranch(repoId, ai, head, target, true)
    },
    onSuccess: (out) => {
      if (out.success) {
        explainContent.value = out.text
        explainError.value = null
        notifyAiDone('AI 충돌 미리보기', `${headRef.value ?? '?'} vs ${targetRef.value ?? '?'}`)
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

  function suggestResolution() {
    explainOpen.value = true
    explainContent.value = ''
    explainError.value = null
    explainMut.mutate()
  }

  return {
    explainOpen,
    explainContent,
    explainError,
    explainMut,
    suggestResolution,
  }
}
