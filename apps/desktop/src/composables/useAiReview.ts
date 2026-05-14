// Sprint c35 — AI 코드 리뷰 composable (5번째 AI composable).
//
// useAiCommitMessage / useAiPrBody / useAiResolveConflict / useAiComposer 패턴 mirror.
//
// 책임:
//   - aiProbes 1회 query (STATIC, 모듈 공용 'aiProbes' key)
//   - availableCli computed (Claude > Codex)
//   - generate useMutation (aiCodeReview IPC + onResult 콜백)
//   - run() — confirm + generate.mutate (i18n.global.t — confirm.aiSendMessage)
//
// 부모 (PrDetailModal) 는 PR detail (head/base/title/body) getter + reviewBody 콜백 제공.
import { computed } from 'vue'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { aiCodeReview, aiDetectClis, type AiCli, type PullRequest } from '@/api/git'
import { describeError } from '@/api/errors'
import { STALE_TIME } from '@/api/queryClient'
import { notifyAiDone } from '@/composables/useAiCli'
import { confirmDialog } from '@/composables/useConfirm'
import { i18n } from '@/i18n'

const t = i18n.global.t

export interface UseAiReviewOptions {
  repoId: () => number | null
  number: () => number | null
  /** PR detail getter — head/base/title/body 추출용. */
  detail: () => PullRequest | null
  /** 성공 시 trim 된 리뷰 본문 받음. 부모는 textarea 채움. */
  onResult: (text: string) => void
  /** cancelled 외 에러. (cancelled 는 자동 무시) */
  onError?: (e: unknown) => void
}

export function useAiReview(opts: UseAiReviewOptions) {
  const { data: aiProbes } = useQuery({
    queryKey: ['aiProbes'],
    queryFn: aiDetectClis,
    staleTime: STALE_TIME.STATIC,
  })

  const availableCli = computed<AiCli | null>(() => {
    const p = aiProbes.value
    if (!p) return null
    if (p.find((x) => x.cli === 'claude' && x.installed)) return 'claude'
    if (p.find((x) => x.cli === 'codex' && x.installed)) return 'codex'
    return null
  })

  const generate = useMutation({
    mutationFn: async () => {
      const id = opts.repoId()
      const num = opts.number()
      const d = opts.detail()
      if (id == null || num == null || !d || availableCli.value == null) {
        throw new Error('AI 사용 불가')
      }
      // D-AI-001 (Codex R5) — 시작 시점 PR# snapshot. 응답 도착 시 사용자가 다른 PR detail
      // modal 로 전환 시 stale review 가 새 PR textarea 덮어씌우기 방지.
      const snapshot = { repoId: id, number: num }
      const out = await aiCodeReview({
        repoId: id,
        cli: availableCli.value,
        headBranch: d.headBranch,
        baseBranch: d.baseBranch,
        prTitle: d.title,
        prBody: d.bodyMd,
        userApproved: true,
      })
      return { out, snapshot }
    },
    onSuccess: ({ out, snapshot }) => {
      // D-AI-001 — snapshot mismatch silent drop.
      if (opts.repoId() !== snapshot.repoId || opts.number() !== snapshot.number) {
        if (import.meta.env.DEV) {
          console.warn('[useAiReview] snapshot mismatch — silent drop', {
            snapshot,
            current: { repoId: opts.repoId(), number: opts.number() },
          })
        }
        return
      }
      if (out.success) {
        const text = out.text.trim()
        opts.onResult(text)
        notifyAiDone('AI 코드 리뷰', `#${snapshot.number}`)
      } else {
        opts.onError?.(new Error(out.stderr || out.text || 'AI 응답 실패'))
      }
    },
    onError: (e) => {
      const msg = describeError(e)
      if (msg.includes('cancelled')) return
      opts.onError?.(e)
    },
  })

  /** confirm dialog 후 mutation 실행. */
  async function run(): Promise<void> {
    const d = opts.detail()
    if (opts.repoId() == null || opts.number() == null || !d || availableCli.value == null) return
    const ok = await confirmDialog({
      title: t('confirm.aiSendTitle'),
      message: t('confirm.aiSendMessage'),
      danger: true,
    })
    if (!ok) return
    generate.mutate()
  }

  return { availableCli, generate, run }
}
