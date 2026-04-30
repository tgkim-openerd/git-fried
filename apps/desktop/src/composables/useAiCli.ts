// AI CLI 감지 공용 composable — Sprint B7 의 Explain / Stash 진입점에서 재사용.
//
// 현재 CommitMessageInput 이 자체 useQuery 로 detect 하고 있는데, 진입점 늘면서
// 통일된 1회 cache + 모든 컴포넌트 재사용 패턴이 더 깔끔.
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { aiDetectClis, type AiCli, type AiProbe } from '@/api/git'
import { STALE_TIME } from '@/api/queryClient'
import { useNotification } from '@/composables/useNotification'
import { confirmDialog } from '@/composables/useConfirm'
import { i18n } from '@/i18n'

export function useAiCli() {
  const {
    data: probes,
    isFetching,
    refetch,
  } = useQuery<AiProbe[]>({
    queryKey: ['aiProbes'],
    queryFn: aiDetectClis,
    staleTime: STALE_TIME.STATIC,
  })

  const available = computed<AiCli | null>(() => {
    const p = probes.value
    if (!p) return null
    if (p.find((x) => x.cli === 'claude' && x.installed)) return 'claude'
    if (p.find((x) => x.cli === 'codex' && x.installed)) return 'codex'
    return null
  })

  const installedClis = computed<AiCli[]>(() => {
    return (probes.value ?? []).filter((p) => p.installed).map((p) => p.cli)
  })

  return { probes, available, installedClis, isFetching, refetch }
}

/**
 * 회사 보안정책 강제 공통 confirm — Promise<boolean> resolve.
 *  - true: 송출 동의
 *  - false: 취소 / Esc / backdrop
 *
 * Sprint c33 — window.confirm() 의 OS 다이얼로그 → 커스텀 ConfirmDialog 마이그레이션.
 * vue setup context 외부에서도 호출되므로 i18n.global.t 사용 (useI18n() 안 됨).
 */
export function confirmAiSend(): Promise<boolean> {
  const t = i18n.global.t
  return confirmDialog({
    title: t('confirm.aiSendTitle'),
    message: t('confirm.aiSendMessage'),
    danger: true,
  })
}

/**
 * AI 응답 완료 시 OS notification (window 미focus 시).
 * Sprint D7 — 모든 AI 진입점 공용.
 */
export function notifyAiDone(title: string, body?: string) {
  const { notify } = useNotification()
  void notify(`✨ ${title}`, body)
}
