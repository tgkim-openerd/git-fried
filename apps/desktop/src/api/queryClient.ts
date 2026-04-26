import { QueryClient } from '@tanstack/vue-query'

// Tauri 데스크탑 컨텍스트: refetch 정책을 IDE 사용 패턴에 맞게.
// - retry: 1 (네트워크 fetch 실패는 사용자에게 명확히 노출)
// - staleTime: 5초 (자주 바뀌는 working tree status)
// - gcTime: 5분 (오래 보지 않는 데이터는 정리)
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: 500,
      staleTime: 5_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
