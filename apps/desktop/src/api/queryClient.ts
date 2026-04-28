import { QueryClient } from '@tanstack/vue-query'

// staleTime 3-tier 정책 (`docs/plan/15 §3-1`).
// invalidateQueries 가 모든 mutation 후 explicit 하게 불리므로,
// stale window 는 "동일 view 내 인접 fetch 의 중복 호출 방지" 목적.
// - REALTIME: working tree (status) — 폴링/포커스 시 즉시 재검증 가능
// - NORMAL  : 일반 list (branches / stash / log graph / PR / issue / etc.)
// - STATIC  : 잘 안 바뀌는 메타 (profiles / hidden refs / aliases / launchpad meta / AI probe)
export const STALE_TIME = {
  REALTIME: 2_000,
  NORMAL: 30_000,
  STATIC: 60_000,
} as const

// Tauri 데스크탑 컨텍스트: refetch 정책을 IDE 사용 패턴에 맞게.
// - retry: 1 (네트워크 fetch 실패는 사용자에게 명확히 노출)
// - staleTime: 기본 NORMAL (개별 useQuery 가 더 짧/길게 지정 가능)
// - gcTime: 5분 (오래 보지 않는 데이터는 정리)
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: 500,
      staleTime: STALE_TIME.NORMAL,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
