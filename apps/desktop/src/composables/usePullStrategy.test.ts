// Sprint c31 — usePullStrategy 단위 테스트.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  pullStrategyLabel,
  setPullStrategy,
  usePullStrategy,
  type PullStrategy,
} from './usePullStrategy'

const KEY = 'git-fried.pull-strategy'

beforeEach(() => {
  localStorage.clear()
  // 모듈-스코프 ref 는 import 시점 초기화이므로 명시 reset.
  setPullStrategy('default')
})

afterEach(() => {
  localStorage.clear()
})

describe('pullStrategyLabel', () => {
  it.each<[PullStrategy, string]>([
    ['default', 'merge'],
    ['rebase', '--rebase'],
    ['ff-only', '--ff-only'],
    ['no-rebase', '--no-rebase'],
  ])('label("%s") = "%s"', (s, label) => {
    expect(pullStrategyLabel(s)).toBe(label)
  })
})

describe('usePullStrategy — setter / persistence', () => {
  it('setPullStrategy 는 ref 와 localStorage 동시 갱신', () => {
    const { pullStrategy } = usePullStrategy()
    setPullStrategy('rebase')
    expect(pullStrategy.value).toBe('rebase')
    expect(localStorage.getItem(KEY)).toBe('rebase')
  })

  it('여러 호출 시 같은 singleton 공유 (모듈-스코프 ref)', () => {
    const a = usePullStrategy()
    const b = usePullStrategy()
    setPullStrategy('ff-only')
    expect(a.pullStrategy.value).toBe('ff-only')
    expect(b.pullStrategy.value).toBe('ff-only')
  })

  it('잘못된 value 는 setPullStrategy 시그니처에서 type 차단 (런타임은 그대로 저장)', () => {
    setPullStrategy('no-rebase')
    expect(localStorage.getItem(KEY)).toBe('no-rebase')
  })
})
