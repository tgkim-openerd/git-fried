// Sprint c34 — AI Commit Composer composable (4번째 AI composable).
//
// useAiCommitMessage / useAiPrBody / useAiResolveConflict 패턴 mirror.
//
// 책임:
//   - confirmAiSend (Claude/Codex CLI 송출 confirm)
//   - aiComposerPlan IPC 호출 (count + userApproved=true)
//   - parseComposerPlan: JSON array 파싱 (마크다운 코드블록 [ ] 추출 + 허용된 action filter)
//   - applyComposerPlan: 기존 todo 의 sha 매칭하여 action / newMessage 병합
//
// 부모 (InteractiveRebaseModal) 는 todo ref + 결과 콜백 (onPlanApplied) 만 제공.
// AI 가 만든 plan 의 변경 카운트는 콜백 인자로 전달.
import type { Ref } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { aiComposerPlan, type RebaseAction, type RebaseTodoEntry } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useAiCli, confirmAiSend, notifyAiDone } from '@/composables/useAiCli'

export interface ComposerPlanEntry {
  sha: string
  action: RebaseAction
  newMessage: string | null
}

const ALLOWED_ACTIONS: readonly RebaseAction[] = [
  'pick',
  'reword',
  'squash',
  'fixup',
  'drop',
] as const

/**
 * AI 응답 텍스트에서 ComposerPlanEntry 배열 파싱.
 *
 * 마크다운 코드블록이 끼어 있을 가능성 → 첫/마지막 `[` `]` 추출 후 JSON.parse.
 * 허용되지 않은 action 또는 sha/action 누락은 skip. 파싱 실패 시 빈 배열.
 *
 * Named export — 단위 테스트 가능.
 */
export function parseComposerPlan(text: string): ComposerPlanEntry[] {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start < 0 || end <= start) return []
  const json = text.slice(start, end + 1)
  try {
    const arr = JSON.parse(json) as unknown
    if (!Array.isArray(arr)) return []
    const out: ComposerPlanEntry[] = []
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue
      const obj = item as Record<string, unknown>
      const sha = typeof obj.sha === 'string' ? obj.sha : null
      const action = typeof obj.action === 'string' ? obj.action : null
      const newMessage = typeof obj.newMessage === 'string' ? obj.newMessage : null
      if (!sha || !action) continue
      if (!ALLOWED_ACTIONS.includes(action as RebaseAction)) continue
      out.push({ sha, action: action as RebaseAction, newMessage })
    }
    return out
  } catch {
    return []
  }
}

/**
 * todo 배열에 plan 을 병합 — sha 매칭하여 action / newMessage 갱신.
 * reword 가 아니면 newMessage 는 null 로 강제.
 *
 * Named export — 단위 테스트 가능.
 */
export function applyComposerPlan(
  todo: RebaseTodoEntry[],
  plan: ComposerPlanEntry[],
): RebaseTodoEntry[] {
  const bySha = new Map<string, ComposerPlanEntry>()
  for (const p of plan) bySha.set(p.sha, p)
  return todo.map((e) => {
    const p = bySha.get(e.sha)
    if (!p) return e
    return {
      ...e,
      action: p.action,
      newMessage: p.action === 'reword' ? (p.newMessage ?? e.subject) : null,
    }
  })
}

export interface UseAiComposerOptions {
  repoId: () => number | null
  todo: Ref<RebaseTodoEntry[]>
  /** plan 적용 후 호출 — changed 카운트 인자. */
  onPlanApplied?: (changed: number) => void
}

export function useAiComposer(opts: UseAiComposerOptions) {
  const ai = useAiCli()
  const toast = useToast()

  const generate = useMutation({
    mutationFn: async () => {
      const id = opts.repoId()
      if (id == null || ai.available.value == null) {
        throw new Error('AI 사용 불가 — Claude/Codex CLI 미설치')
      }
      if (!(await confirmAiSend())) throw new Error('cancelled')
      return aiComposerPlan(id, ai.available.value, opts.todo.value.length, true)
    },
    onSuccess: (out) => {
      if (!out.success) {
        toast.error('AI 응답 실패', out.stderr || out.text || '')
        return
      }
      const plan = parseComposerPlan(out.text)
      if (plan.length === 0) {
        toast.error('AI 응답 파싱 실패', '응답이 JSON array 가 아니거나 비어있음.')
        return
      }
      // todo ref 갱신 + 변경 카운트 콜백.
      opts.todo.value = applyComposerPlan(opts.todo.value, plan)
      const changed = plan.filter((p) => p.action !== 'pick').length
      toast.success(`✨ AI 제안 적용 (${changed}건 변경)`, 'pick 외 액션 검토 후 Run rebase.')
      notifyAiDone('AI Commit Composer', `${changed}건 변경 제안`)
      opts.onPlanApplied?.(changed)
    },
    onError: (e) => {
      const m = describeError(e)
      if (m.includes('cancelled')) return
      toast.error('AI 호출 실패', m)
    },
  })

  return {
    availableCli: ai.available,
    generate,
    /** template @click 직접 mutate 호출용 alias. */
    run: () => generate.mutate(),
  }
}
