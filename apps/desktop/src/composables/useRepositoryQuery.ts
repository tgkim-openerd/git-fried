// Sprint c48 Wave C-3 — 7 마이크로 useQuery wrapper 통합 factory.
//
// 동일 패턴 반복: queryKey([name, repoId]) + repoId null guard + enabled.
//   - useBranches / useStash / useSubmodules / useWorktrees: Promise<T[]>, empty []
//   - useGraph: Promise<{rows, maxLane}>, empty {rows: [], maxLane: 0}
//   - usePullRequests: extraKey (state)
//
// /analyze 에이전트가 미사용 dead 로 오인했던 queryWrappers.test.ts 의 7 wrapper 테스트는
// 본 factory 도입 후에도 동일 contract 유지 (queryKey[0] = name / [1] = repoId / null → enabled=false).
import { computed, type ComputedRef, type MaybeRefOrGetter, toRef } from 'vue'
import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query'

interface UseRepositoryQueryArgs<T> {
  /** queryKey 첫 segment — debug + cache 분리. */
  name: string
  /** 활성 레포 ID (null 시 disabled). */
  repoIdRef: MaybeRefOrGetter<number | null>
  /** repoId 가 유효할 때 호출되는 fetcher. */
  fetchFn: (repoId: number) => Promise<T>
  /** repoId null 시 즉시 resolve 할 fallback 값 (배열 wrapper 는 []). */
  emptyValue: T
  /** queryKey 에 추가될 segment (state/limit 등). */
  extraKey?: ComputedRef<readonly unknown[]>
}

/**
 * repoId 기반 useQuery wrapper factory. 7개 micro composable 의 공통 패턴 추출.
 */
export function useRepositoryQuery<T>(
  args: UseRepositoryQueryArgs<T>,
): UseQueryReturnType<T, Error> {
  const repoId = toRef(args.repoIdRef)
  return useQuery({
    queryKey: computed(() => {
      const base: unknown[] = [args.name, repoId.value]
      if (args.extraKey) base.push(...args.extraKey.value)
      return base as readonly unknown[]
    }),
    queryFn: () => {
      if (repoId.value == null) return Promise.resolve(args.emptyValue)
      return args.fetchFn(repoId.value)
    },
    enabled: computed(() => repoId.value != null),
  })
}
