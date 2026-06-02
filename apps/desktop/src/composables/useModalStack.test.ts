// plan #44 A1 — useModalStack 단위 테스트 (중첩 overlay focus/Esc/backdrop gate 의 핵심 로직).
import { afterEach, describe, expect, it } from 'vitest'
import { useModalStack } from './useModalStack'

const mgr = useModalStack()
const tracked: number[] = []

function reg(): number {
  const t = mgr.register()
  tracked.push(t)
  return t
}

afterEach(() => {
  // 모듈-스코프 singleton — 누수 토큰 drain (테스트 격리).
  while (tracked.length) mgr.release(tracked.pop()!)
})

describe('useModalStack', () => {
  it('빈 스택: size 0, 임의 토큰 isTop false / depth -1', () => {
    expect(mgr.size.value).toBe(0)
    expect(mgr.isTop(999)).toBe(false)
    expect(mgr.depth(999)).toBe(-1)
  })

  it('register 는 단조 증가 토큰 + size 증가', () => {
    const a = reg()
    const b = reg()
    expect(b).toBeGreaterThan(a)
    expect(mgr.size.value).toBe(2)
  })

  it('isTop 은 마지막 등록만 true (중첩 = 최상단)', () => {
    const a = reg()
    const b = reg()
    expect(mgr.isTop(a)).toBe(false)
    expect(mgr.isTop(b)).toBe(true)
  })

  it('depth 는 0-based bottom→top 순서', () => {
    const a = reg()
    const b = reg()
    const c = reg()
    expect(mgr.depth(a)).toBe(0)
    expect(mgr.depth(b)).toBe(1)
    expect(mgr.depth(c)).toBe(2)
  })

  it('top release 시 직전 항목이 새 top + size 감소', () => {
    const a = reg()
    const b = reg()
    mgr.release(b)
    tracked.pop()
    expect(mgr.isTop(a)).toBe(true)
    expect(mgr.size.value).toBe(1)
  })

  it('중간 release 시 depth 재계산 (gap 없음)', () => {
    const a = reg()
    const b = reg()
    const c = reg()
    mgr.release(b)
    expect(mgr.depth(a)).toBe(0)
    expect(mgr.depth(c)).toBe(1)
    expect(mgr.isTop(c)).toBe(true)
  })

  it('미등록 토큰 release 는 무해 (idempotent)', () => {
    const a = reg()
    mgr.release(424242)
    expect(mgr.size.value).toBe(1)
    expect(mgr.isTop(a)).toBe(true)
  })
})
