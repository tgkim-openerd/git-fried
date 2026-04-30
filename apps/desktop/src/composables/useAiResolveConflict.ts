// Sprint c33 god comp 분리 13/N — MergeEditorModal.vue 의 AI 충돌 해결 영역 추출.
//
// useAiCommitMessage / useAiPrBody 패턴 mirror.
//
// 책임:
//   - aiDetectClis 1회 query (STATIC, 모듈 공용 'aiProbes' key)
//   - availableCli computed (Claude > Codex 우선)
//   - run(): confirm + aiResolveConflict IPC + onResult 콜백
//
// 부모 (MergeEditorModal) 는 result text 를 textarea 에 자동 채움.
import { computed } from 'vue'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { aiDetectClis, aiResolveConflict, type AiCli } from '@/api/git'
import { describeError } from '@/api/errors'
import { STALE_TIME } from '@/api/queryClient'
import { notifyAiDone } from '@/composables/useAiCli'
import { confirmDialog } from '@/composables/useConfirm'
import { i18n } from '@/i18n'

const t = i18n.global.t

export interface UseAiResolveConflictOptions {
  repoId: () => number | null
  path: () => string | null
  /** 성공 시 trim 된 result text 받음. */
  onResult: (text: string) => void
  /** cancelled 외 에러. (cancelled 는 자동 무시) */
  onError?: (e: unknown) => void
}

export function useAiResolveConflict(opts: UseAiResolveConflictOptions) {
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
      const p = opts.path()
      if (id == null || !p || availableCli.value == null) {
        return Promise.reject(new Error('AI 사용 불가'))
      }
      return aiResolveConflict(id, availableCli.value, p, true)
    },
    onSuccess: (out) => {
      if (out.success) {
        const text = out.text.trim()
        opts.onResult(text)
        notifyAiDone('AI 충돌 해결 제안', opts.path() ?? undefined)
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
    const id = opts.repoId()
    if (id == null || !opts.path() || availableCli.value == null) return
    const ok = await confirmDialog({
      title: t('confirm.aiSendTitle'),
      message: t('confirm.aiResolveConflictMessage'),
      danger: true,
    })
    if (!ok) return
    generate.mutate()
  }

  return { availableCli, generate, run }
}
