// Sprint c33 god comp 분리 12/N — CreatePrModal.vue 의 AI PR body 생성 영역 추출.
//
// useAiCommitMessage 패턴 mirror — aiProbes / availableCli / generate (confirm + IPC) 통합.
//
// 책임:
//   - aiDetectClis 1회 query (STATIC staleTime, 모듈 공용 'aiProbes' key)
//   - availableCli computed (Claude > Codex 우선)
//   - generate(): confirm + aiPrBody IPC 호출 + onResult 콜백 (text)
//   - onError 콜백 (cancelled 자동 무시)
//
// 부모 (CreatePrModal) 는 결과 text 받아 body ref 갱신.
import { computed } from 'vue'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { aiDetectClis, aiPrBody, type AiCli } from '@/api/git'
import { describeError } from '@/api/errors'
import { STALE_TIME } from '@/api/queryClient'
import { notifyAiDone } from '@/composables/useAiCli'
import { confirmDialog } from '@/composables/useConfirm'
import { i18n } from '@/i18n'

const t = i18n.global.t

export interface UseAiPrBodyOptions {
  repoId: () => number | null
  head: () => string
  base: () => string
  /** 성공 시 trim 된 text 받음. */
  onResult: (text: string) => void
  /** cancelled 외 에러. (cancelled 는 자동 무시) */
  onError?: (e: unknown) => void
}

export function useAiPrBody(opts: UseAiPrBodyOptions) {
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
    mutationFn: () => {
      const id = opts.repoId()
      const h = opts.head()
      const b = opts.base()
      if (id == null || !h || !b || availableCli.value == null) {
        return Promise.reject(new Error('AI 사용 불가'))
      }
      return aiPrBody(id, availableCli.value, h, b, true)
    },
    onSuccess: (out) => {
      if (out.success) {
        const text = out.text.trim()
        opts.onResult(text)
        notifyAiDone('AI PR body 생성', text.split(/\r?\n/)[0] ?? '')
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

  /** confirm dialog 띄우고 OK 시 mutation 실행. */
  async function run(): Promise<void> {
    const id = opts.repoId()
    if (id == null || !opts.head() || !opts.base() || availableCli.value == null) return
    const ok = await confirmDialog({
      title: t('confirm.aiSendTitle'),
      message: t('confirm.aiPrBodyMessage'),
      danger: true,
    })
    if (!ok) return
    generate.mutate()
  }

  return { availableCli, generate, run }
}
