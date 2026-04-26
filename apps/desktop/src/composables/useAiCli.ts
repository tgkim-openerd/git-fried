// AI CLI 감지 공용 composable — Sprint B7 의 Explain / Stash 진입점에서 재사용.
//
// 현재 CommitMessageInput 이 자체 useQuery 로 detect 하고 있는데, 진입점 늘면서
// 통일된 1회 cache + 모든 컴포넌트 재사용 패턴이 더 깔끔.
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { aiDetectClis, type AiCli, type AiProbe } from '@/api/git'

export function useAiCli() {
  const { data: probes, isFetching, refetch } = useQuery<AiProbe[]>({
    queryKey: ['aiProbes'],
    queryFn: aiDetectClis,
    staleTime: 60_000,
  })

  const available = computed<AiCli | null>(() => {
    const p = probes.value
    if (!p) return null
    if (p.find((x) => x.cli === 'claude' && x.installed)) return 'claude'
    if (p.find((x) => x.cli === 'codex' && x.installed)) return 'codex'
    return null
  })

  const installedClis = computed<AiCli[]>(() => {
    return (probes.value ?? [])
      .filter((p) => p.installed)
      .map((p) => p.cli)
  })

  return { probes, available, installedClis, isFetching, refetch }
}

/**
 * 회사 보안정책 강제 공통 confirm — true 면 송출 동의.
 */
export function confirmAiSend(): boolean {
  return confirm(
    '⚠ 변경 내용 / diff 가 외부 LLM 으로 송출됩니다.\n회사 보안정책을 확인하셨나요?',
  )
}
