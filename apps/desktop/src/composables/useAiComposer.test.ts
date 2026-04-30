// Sprint c34 — useAiComposer 단위 테스트.
//
// parseComposerPlan / applyComposerPlan 두 named export 만 검증.
// composable 본체는 vue-query 의존이라 통합 test (별도).
import { describe, expect, it } from 'vitest'
import { applyComposerPlan, parseComposerPlan } from './useAiComposer'
import type { RebaseTodoEntry } from '@/api/git'

function entry(sha: string, subject: string): RebaseTodoEntry {
  return {
    sha,
    subject,
    action: 'pick',
    newMessage: null,
  } as RebaseTodoEntry
}

describe('parseComposerPlan', () => {
  it('빈 입력 → 빈 배열', () => {
    expect(parseComposerPlan('')).toEqual([])
  })

  it('JSON 배열 없음 → 빈 배열', () => {
    expect(parseComposerPlan('Just plain text')).toEqual([])
  })

  it('단순 JSON 배열 파싱', () => {
    const text = '[{"sha":"abc","action":"pick","newMessage":null}]'
    expect(parseComposerPlan(text)).toEqual([{ sha: 'abc', action: 'pick', newMessage: null }])
  })

  it('마크다운 코드블록 안의 JSON 추출', () => {
    const text = '```json\n[{"sha":"abc","action":"reword","newMessage":"new msg"}]\n```'
    expect(parseComposerPlan(text)).toEqual([
      { sha: 'abc', action: 'reword', newMessage: 'new msg' },
    ])
  })

  it('허용되지 않은 action 은 skip', () => {
    const text = '[{"sha":"a","action":"pick"},{"sha":"b","action":"INVALID"}]'
    const plan = parseComposerPlan(text)
    expect(plan).toHaveLength(1)
    expect(plan[0].sha).toBe('a')
  })

  it('sha / action 누락 시 skip', () => {
    const text = '[{"sha":"a","action":"pick"},{"action":"pick"},{"sha":"c"}]'
    const plan = parseComposerPlan(text)
    expect(plan).toHaveLength(1)
  })

  it('JSON parse 실패 → 빈 배열', () => {
    const text = '[{invalid json'
    expect(parseComposerPlan(text)).toEqual([])
  })

  it('Array 가 아님 → 빈 배열', () => {
    const text = '{"sha":"abc"}'
    expect(parseComposerPlan(text)).toEqual([])
  })

  it('newMessage 없으면 null 로 채움', () => {
    const text = '[{"sha":"a","action":"squash"}]'
    expect(parseComposerPlan(text)[0].newMessage).toBeNull()
  })

  it('5 허용 action 모두 통과 (pick/reword/squash/fixup/drop)', () => {
    const text = JSON.stringify([
      { sha: '1', action: 'pick' },
      { sha: '2', action: 'reword', newMessage: 'msg' },
      { sha: '3', action: 'squash' },
      { sha: '4', action: 'fixup' },
      { sha: '5', action: 'drop' },
    ])
    expect(parseComposerPlan(text)).toHaveLength(5)
  })
})

describe('applyComposerPlan', () => {
  it('빈 plan → 원본 그대로', () => {
    const todo = [entry('a', 'first'), entry('b', 'second')]
    const result = applyComposerPlan(todo, [])
    expect(result).toEqual(todo)
  })

  it('sha 매칭 시 action 갱신', () => {
    const todo = [entry('a', 'first'), entry('b', 'second')]
    const plan = [{ sha: 'a', action: 'squash' as const, newMessage: null }]
    const result = applyComposerPlan(todo, plan)
    expect(result[0].action).toBe('squash')
    expect(result[1].action).toBe('pick') // 미매치는 유지
  })

  it('reword 면 newMessage 적용', () => {
    const todo = [entry('a', 'first')]
    const plan = [{ sha: 'a', action: 'reword' as const, newMessage: 'new msg' }]
    expect(applyComposerPlan(todo, plan)[0].newMessage).toBe('new msg')
  })

  it('reword + newMessage 없음 → subject fallback', () => {
    const todo = [entry('a', 'original subject')]
    const plan = [{ sha: 'a', action: 'reword' as const, newMessage: null }]
    expect(applyComposerPlan(todo, plan)[0].newMessage).toBe('original subject')
  })

  it('reword 외 action 은 newMessage 강제 null', () => {
    const todo = [entry('a', 'first')]
    const plan = [{ sha: 'a', action: 'pick' as const, newMessage: 'should be ignored' }]
    expect(applyComposerPlan(todo, plan)[0].newMessage).toBeNull()
  })

  it('미매치 sha 는 plan 무시', () => {
    const todo = [entry('a', 'first')]
    const plan = [{ sha: 'NOT-IN-TODO', action: 'drop' as const, newMessage: null }]
    expect(applyComposerPlan(todo, plan)).toEqual(todo)
  })
})
