// Sprint c31 — Pull strategy composable. GitKrakenToolbar.vue 에서 분리.
//
// pull command 의 전략 (default / rebase / ff-only / no-rebase) 을 localStorage
// 에 영속하고, label 변환 + 변경 헬퍼를 제공.
//
// 다른 컴포넌트 (Settings / Sidebar / Pull dropdown 분리 후 등) 도 동일 SoT 사용.
import { ref } from 'vue'

export type PullStrategy = 'default' | 'rebase' | 'ff-only' | 'no-rebase'

const PULL_STRATEGY_KEY = 'git-fried.pull-strategy'

function readInitial(): PullStrategy {
  if (typeof localStorage === 'undefined') return 'default'
  const v = localStorage.getItem(PULL_STRATEGY_KEY) as PullStrategy | null
  if (v === 'rebase' || v === 'ff-only' || v === 'no-rebase' || v === 'default') return v
  return 'default'
}

// 모듈-스코프 ref singleton — 모든 호출자가 동일 인스턴스 공유 (createGlobalState 미사용 정책 정합).
const pullStrategy = ref<PullStrategy>(readInitial())

export function pullStrategyLabel(s: PullStrategy): string {
  switch (s) {
    case 'rebase':
      return '--rebase'
    case 'ff-only':
      return '--ff-only'
    case 'no-rebase':
      return '--no-rebase'
    default:
      return 'merge'
  }
}

export function setPullStrategy(s: PullStrategy): void {
  pullStrategy.value = s
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PULL_STRATEGY_KEY, s)
  } catch {
    /* localStorage 비활성 / quota 초과 — 메모리만 유지 */
  }
}

export function usePullStrategy() {
  return {
    pullStrategy,
    setPullStrategy,
    pullStrategyLabel,
  }
}
