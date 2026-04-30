// Sprint c37 — useGraphWidth 단위 테스트.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useGraphWidth, ROW_H, LANE_W_MIN, LANE_W_MAX } from './useGraphWidth'

const STORAGE_KEY = 'git-fried.commit-graph-width'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('useGraphWidth — 초기값', () => {
  it('localStorage 비어있으면 default 200', () => {
    const w = useGraphWidth(ref(1))
    expect(w.graphWidth.value).toBe(200)
  })

  it('localStorage 에 유효 값 있으면 로드', () => {
    localStorage.setItem(STORAGE_KEY, '300')
    const w = useGraphWidth(ref(1))
    expect(w.graphWidth.value).toBe(300)
  })

  it('localStorage 값이 MIN(80) 미만이면 clamp', () => {
    localStorage.setItem(STORAGE_KEY, '40')
    const w = useGraphWidth(ref(1))
    expect(w.graphWidth.value).toBe(80)
  })

  it('localStorage 값이 MAX(400) 초과면 clamp', () => {
    localStorage.setItem(STORAGE_KEY, '999')
    const w = useGraphWidth(ref(1))
    expect(w.graphWidth.value).toBe(400)
  })

  it('localStorage 값이 NaN 이면 default', () => {
    localStorage.setItem(STORAGE_KEY, 'not-a-number')
    const w = useGraphWidth(ref(1))
    expect(w.graphWidth.value).toBe(200)
  })
})

describe('useGraphWidth — laneW 자동 계산', () => {
  it('maxLane=1, graphWidth=200 → laneW=clamp 36 (max)', () => {
    const w = useGraphWidth(ref(1))
    // (200-16)/1 = 184 → clamp to LANE_W_MAX(36)
    expect(w.laneW.value).toBe(LANE_W_MAX)
  })

  it('maxLane=10, graphWidth=200 → laneW=18', () => {
    const maxLane = ref(10)
    const w = useGraphWidth(maxLane)
    // (200-16)/10 = 18.4 → floor 18
    expect(w.laneW.value).toBe(18)
  })

  it('maxLane=100, graphWidth=200 → laneW=clamp 8 (min)', () => {
    const maxLane = ref(100)
    const w = useGraphWidth(maxLane)
    // (200-16)/100 = 1.84 → clamp to LANE_W_MIN(8)
    expect(w.laneW.value).toBe(LANE_W_MIN)
  })

  it('maxLane=0 도 NaN 안 발생 (1로 clamp)', () => {
    const maxLane = ref(0)
    const w = useGraphWidth(maxLane)
    // ml = max(1, 0) = 1, (200-16)/1 = 184 → clamp 36
    expect(w.laneW.value).toBe(LANE_W_MAX)
  })
})

describe('useGraphWidth — zoom + disabled', () => {
  it('zoomIn 은 +20px', () => {
    const w = useGraphWidth(ref(1))
    w.graphWidth.value = 200
    w.zoomIn()
    expect(w.graphWidth.value).toBe(220)
  })

  it('zoomOut 은 -20px', () => {
    const w = useGraphWidth(ref(1))
    w.graphWidth.value = 200
    w.zoomOut()
    expect(w.graphWidth.value).toBe(180)
  })

  it('zoomIn 은 MAX(400) clamp', () => {
    const w = useGraphWidth(ref(1))
    w.graphWidth.value = 395
    w.zoomIn()
    expect(w.graphWidth.value).toBe(400)
    w.zoomIn()
    expect(w.graphWidth.value).toBe(400) // 그대로
  })

  it('zoomOut 은 MIN(80) clamp', () => {
    const w = useGraphWidth(ref(1))
    w.graphWidth.value = 90
    w.zoomOut()
    expect(w.graphWidth.value).toBe(80)
    w.zoomOut()
    expect(w.graphWidth.value).toBe(80) // 그대로
  })

  it('zoomOutDisabled — graphWidth=80 (MIN) 이면 true', () => {
    const w = useGraphWidth(ref(1))
    w.graphWidth.value = 80
    expect(w.zoomOutDisabled.value).toBe(true)
    expect(w.zoomInDisabled.value).toBe(false)
  })

  it('zoomInDisabled — graphWidth=400 (MAX) 이면 true', () => {
    const w = useGraphWidth(ref(1))
    w.graphWidth.value = 400
    expect(w.zoomInDisabled.value).toBe(true)
    expect(w.zoomOutDisabled.value).toBe(false)
  })
})

describe('useGraphWidth — localStorage 영속', () => {
  it('graphWidth 변경 시 localStorage 업데이트', async () => {
    const w = useGraphWidth(ref(1))
    w.graphWidth.value = 280
    // watch 비동기 — flush 대기.
    await Promise.resolve()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('280')
  })
})

describe('useGraphWidth — 상수 export', () => {
  it('ROW_H = 28', () => {
    expect(ROW_H).toBe(28)
  })

  it('LANE_W_MIN = 8 / LANE_W_MAX = 36', () => {
    expect(LANE_W_MIN).toBe(8)
    expect(LANE_W_MAX).toBe(36)
  })
})
