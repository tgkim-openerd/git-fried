// Long-running operation progress tracker (Sprint E-4 / docs/plan/24 §7-1).
//
// 5분 IPC 작업 (clone / fetch / push / bulk_* / ai_* / maintenance_* 등) 진행 시
// 사용자에게 단계별 진행 상태 표시:
//
//   - 0~30s: idle (banner 숨김 — 짧은 작업은 spinner 만으로 충분)
//   - 30s~1m: over30s ("작업이 평소보다 오래 걸립니다")
//   - 1m~4m: over1m  ("장시간 작업 진행 중")
//   - 4m+  : over4m  ("매우 오래 걸리고 있습니다 — 네트워크/디스크 확인 권장")
//
// invokeWithTimeout 가 long-running prefix 자동 감지 → registerOperation 호출.
// LongRunningBanner.vue 가 activeOperations 노출.

import { computed, readonly, ref } from 'vue'

export type ProgressStage = 'idle' | 'over30s' | 'over1m' | 'over4m'

export interface OperationState {
  readonly id: number
  readonly label: string
  readonly startedAt: number
  readonly elapsedMs: number
  readonly stage: ProgressStage
}

const STAGE_THRESHOLDS = {
  over30s: 30_000,
  over1m: 60_000,
  over4m: 4 * 60_000,
} as const

function computeStage(elapsedMs: number): ProgressStage {
  if (elapsedMs >= STAGE_THRESHOLDS.over4m) return 'over4m'
  if (elapsedMs >= STAGE_THRESHOLDS.over1m) return 'over1m'
  if (elapsedMs >= STAGE_THRESHOLDS.over30s) return 'over30s'
  return 'idle'
}

interface InternalOp {
  id: number
  label: string
  startedAt: number
}

let nextId = 1
const operations = ref<Map<number, InternalOp>>(new Map())
const now = ref<number>(Date.now())

let tickHandle: ReturnType<typeof setInterval> | null = null

function startTickIfNeeded(): void {
  if (tickHandle != null) return
  tickHandle = setInterval(() => {
    now.value = Date.now()
    if (operations.value.size === 0) {
      stopTick()
    }
  }, 1000)
}

function stopTick(): void {
  if (tickHandle != null) {
    clearInterval(tickHandle)
    tickHandle = null
  }
}

export function registerOperation(label: string): number {
  const id = nextId++
  operations.value.set(id, { id, label, startedAt: Date.now() })
  // 새 Map 으로 reactive trigger 보장 (ref<Map> + .set 만으로는 deep 트리거 미보장)
  operations.value = new Map(operations.value)
  startTickIfNeeded()
  return id
}

export function completeOperation(id: number): void {
  if (!operations.value.has(id)) return
  const next = new Map(operations.value)
  next.delete(id)
  operations.value = next
  if (next.size === 0) stopTick()
}

const activeOperations = computed<readonly OperationState[]>(() => {
  const t = now.value
  return Array.from(operations.value.values())
    .map((op) => {
      const elapsedMs = t - op.startedAt
      return {
        id: op.id,
        label: op.label,
        startedAt: op.startedAt,
        elapsedMs,
        stage: computeStage(elapsedMs),
      }
    })
    .sort((a, b) => a.startedAt - b.startedAt)
})

const visibleOperations = computed<readonly OperationState[]>(() =>
  activeOperations.value.filter((op) => op.stage !== 'idle'),
)

export function useLongRunningProgress() {
  return {
    activeOperations: readonly(activeOperations),
    visibleOperations: readonly(visibleOperations),
    register: registerOperation,
    complete: completeOperation,
  }
}

// 테스트 전용 — 모듈 상태 초기화. production 코드에서는 호출 금지.
export function __resetForTest(): void {
  stopTick()
  operations.value = new Map()
  now.value = Date.now()
  nextId = 1
}
