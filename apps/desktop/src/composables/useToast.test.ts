// Sprint 22-21 — TDD-lite 시범 3: useToast composable 테스트.
//
// 검증 영역:
//   - push / dismiss / clearAll 기본 동작
//   - kind 별 default duration (success 3s / info 4s / warning 6s / error 8s)
//   - Sprint 22-12 Q-6: dedup window 1s — 같은 (kind, title) 1초 내 재호출 시
//     · 새 toast 생성 X (toasts.length 그대로)
//     · 기존 toast.count++
//     · message 갱신 (마지막 trigger 의 detail)
//     · duration timer reset
//   - dismiss 시 timer cleanup
//
// timer 검증을 위해 vitest fake timers 사용.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToast } from './useToast'

describe('useToast', () => {
  const { toasts, push, dismiss, clearAll, success, info, warning, error } =
    useToast()

  beforeEach(() => {
    vi.useFakeTimers()
    clearAll()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('push / dismiss 기본', () => {
    it('push → toasts.length 증가 + count=1', () => {
      const id = push({ kind: 'info', title: '안녕' })
      expect(toasts.value).toHaveLength(1)
      expect(toasts.value[0].id).toBe(id)
      expect(toasts.value[0].count).toBe(1)
      expect(toasts.value[0].kind).toBe('info')
      expect(toasts.value[0].title).toBe('안녕')
    })

    it('dismiss(id) → 해당 toast 제거', () => {
      const id = push({ kind: 'info', title: 'A' })
      push({ kind: 'success', title: 'B' })
      expect(toasts.value).toHaveLength(2)
      dismiss(id)
      expect(toasts.value).toHaveLength(1)
      expect(toasts.value[0].title).toBe('B')
    })

    it('clearAll → 모든 toast 제거', () => {
      push({ kind: 'info', title: 'A' })
      push({ kind: 'error', title: 'B' })
      expect(toasts.value).toHaveLength(2)
      clearAll()
      expect(toasts.value).toHaveLength(0)
    })
  })

  describe('default duration (kind 별)', () => {
    it('success 3s', () => {
      success('done')
      vi.advanceTimersByTime(2_999)
      expect(toasts.value).toHaveLength(1)
      vi.advanceTimersByTime(2)
      expect(toasts.value).toHaveLength(0)
    })

    it('info 4s', () => {
      info('hi')
      vi.advanceTimersByTime(3_999)
      expect(toasts.value).toHaveLength(1)
      vi.advanceTimersByTime(2)
      expect(toasts.value).toHaveLength(0)
    })

    it('warning 6s', () => {
      warning('careful')
      vi.advanceTimersByTime(5_999)
      expect(toasts.value).toHaveLength(1)
      vi.advanceTimersByTime(2)
      expect(toasts.value).toHaveLength(0)
    })

    it('error 8s', () => {
      error('boom')
      vi.advanceTimersByTime(7_999)
      expect(toasts.value).toHaveLength(1)
      vi.advanceTimersByTime(2)
      expect(toasts.value).toHaveLength(0)
    })

    it('durationMs=0 → 영구 (수동 dismiss 까지)', () => {
      const id = push({ kind: 'info', title: '영구', durationMs: 0 })
      vi.advanceTimersByTime(60_000)
      expect(toasts.value).toHaveLength(1)
      dismiss(id)
      expect(toasts.value).toHaveLength(0)
    })

    it('custom durationMs', () => {
      info('quick', undefined, 1_000)
      vi.advanceTimersByTime(999)
      expect(toasts.value).toHaveLength(1)
      vi.advanceTimersByTime(2)
      expect(toasts.value).toHaveLength(0)
    })
  })

  describe('Sprint 22-12 Q-6 dedup', () => {
    it('같은 (kind, title) 1초 내 재호출 → 새 toast 생성 X, count++', () => {
      const id1 = info('Push 실패', '첫 시도')
      expect(toasts.value).toHaveLength(1)
      expect(toasts.value[0].count).toBe(1)

      const id2 = info('Push 실패', '두 번째 시도')
      expect(toasts.value).toHaveLength(1) // 새 toast 생성 X
      expect(id2).toBe(id1) // 같은 id 반환
      expect(toasts.value[0].count).toBe(2)
    })

    it('count 누적 — 5번 dedup', () => {
      info('같은 에러')
      info('같은 에러')
      info('같은 에러')
      info('같은 에러')
      info('같은 에러')
      expect(toasts.value).toHaveLength(1)
      expect(toasts.value[0].count).toBe(5)
    })

    it('message 갱신 (마지막 trigger 의 detail)', () => {
      info('실패', '첫 detail')
      info('실패', '두 번째 detail')
      info('실패', '세 번째 detail')
      expect(toasts.value[0].message).toBe('세 번째 detail')
    })

    it('다른 kind 면 dedup 안 됨 (key=kind:title)', () => {
      info('알림')
      success('알림') // 같은 title, 다른 kind
      expect(toasts.value).toHaveLength(2)
      expect(toasts.value[0].count).toBe(1)
      expect(toasts.value[1].count).toBe(1)
    })

    it('다른 title 이면 dedup 안 됨', () => {
      info('A')
      info('B')
      expect(toasts.value).toHaveLength(2)
    })

    it('duration timer reset — 마지막 trigger 기준', () => {
      info('재발생', undefined, 2_000) // 2s duration
      vi.advanceTimersByTime(1_500)
      info('재발생', undefined, 2_000) // dedup, timer reset
      expect(toasts.value[0].count).toBe(2)

      // 첫 push 기준 2_500ms 경과지만 reset 됐으니 여전히 활성
      vi.advanceTimersByTime(1_500)
      expect(toasts.value).toHaveLength(1)

      // 두 번째 push 기준 2_500ms 경과 → 만료
      vi.advanceTimersByTime(1_000)
      expect(toasts.value).toHaveLength(0)
    })
  })

  describe('cleanup', () => {
    it('dismiss 시 setTimeout 정리 (memory leak 방지)', () => {
      const id = info('test', undefined, 5_000)
      dismiss(id)
      // dismiss 후 5s 경과해도 toasts 변화 없음 (이미 비어있음)
      vi.advanceTimersByTime(5_000)
      expect(toasts.value).toHaveLength(0)
    })

    it('clearAll 시 모든 timer 정리', () => {
      info('A', undefined, 5_000)
      info('B', undefined, 5_000)
      info('C', undefined, 5_000)
      clearAll()
      vi.advanceTimersByTime(10_000)
      expect(toasts.value).toHaveLength(0)
    })
  })
})
