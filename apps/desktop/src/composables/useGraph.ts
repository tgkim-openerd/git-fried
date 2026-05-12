import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { getGraph } from '@/api/git'
import { useRepositoryQuery } from './useRepositoryQuery'

// Sprint c48 Wave C-3 — useRepositoryQuery factory 위임. extraKey 로 limit 추가.
// Sprint c74 — limit 을 reactive (MaybeRefOrGetter) 로 받아 무한 스크롤 (dynamic limit 증가) 지원.
// 호출처가 number / Ref<number> / () => number 어떤 형태든 toValue 가 처리. extraKey 가 limit 변경
// 추적하므로 queryKey 가 자동 변경되어 vue-query 가 자동 refetch.
export function useGraph(
  repoIdRef: MaybeRefOrGetter<number | null>,
  limitRef: MaybeRefOrGetter<number> = 500,
) {
  return useRepositoryQuery({
    name: 'graph',
    repoIdRef,
    fetchFn: (repoId) => getGraph(repoId, toValue(limitRef)),
    emptyValue: { rows: [], maxLane: 0 },
    extraKey: computed(() => [toValue(limitRef)] as const),
  })
}
