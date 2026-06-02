// plan #44 E3 — buildNewLineMap 단위 테스트.
import { describe, expect, it } from 'vitest'
import { buildNewLineMap } from './diffLineMap'

describe('buildNewLineMap', () => {
  it('단일 hunk: context/added 만 new-file line 보유, removed 제외', () => {
    // doc line:        1                2          3          4          5
    const patch = ['@@ -1,2 +1,3 @@', ' ctx1', '+added2', '-removed', ' ctx3'].join('\n')
    const m = buildNewLineMap(patch)
    expect(m.get(1)).toBeUndefined() // @@ 헤더 — commentable 아님
    expect(m.get(2)).toBe(1) // ' ctx1' → new line 1
    expect(m.get(3)).toBe(2) // '+added2' → new line 2
    expect(m.get(4)).toBeUndefined() // '-removed' → new-file line 없음
    expect(m.get(5)).toBe(3) // ' ctx3' → new line 3 (removed 가 카운트 안 올림)
  })

  it('@@ 헤더의 new-start(+c) 를 시작 라인으로 사용', () => {
    const patch = ['@@ -10,1 +20,2 @@', ' a', '+b'].join('\n')
    const m = buildNewLineMap(patch)
    expect(m.get(2)).toBe(20)
    expect(m.get(3)).toBe(21)
  })

  it('멀티 hunk: 두 번째 @@ 가 카운터 리셋', () => {
    const patch = ['@@ -1,1 +1,1 @@', ' a', '@@ -5,1 +8,2 @@', '+x', ' y'].join('\n')
    const m = buildNewLineMap(patch)
    expect(m.get(2)).toBe(1) // 첫 hunk
    expect(m.get(4)).toBe(8) // 둘째 hunk 시작
    expect(m.get(5)).toBe(9)
  })

  it('첫 @@ 이전 preamble(+++/---/diff)은 skip — +++ 의 + 오인 없음', () => {
    const patch = [
      'diff --git a/f b/f',
      'index 111..222 100644',
      '--- a/f',
      '+++ b/f',
      '@@ -1,1 +1,2 @@',
      ' a',
      '+b',
    ].join('\n')
    const m = buildNewLineMap(patch)
    expect(m.size).toBe(2) // ' a' + '+b' 만
    expect(m.get(6)).toBe(1)
    expect(m.get(7)).toBe(2)
  })

  it('빈 patch / 빈 문자열', () => {
    expect(buildNewLineMap('').size).toBe(0)
  })

  it('trailing newline 의 빈 줄은 phantom 매핑 안 함 (Codex MED)', () => {
    const patch = '@@ -1,1 +1,1 @@\n+a\n' // 끝 \n → split 시 trailing '' 아티팩트
    const m = buildNewLineMap(patch)
    expect(m.get(2)).toBe(1) // '+a'
    expect(m.get(3)).toBeUndefined() // trailing '' — 매핑 제외
    expect(m.size).toBe(1)
  })

  it('"\\ No newline at end of file" 은 라인 카운트 무영향', () => {
    const patch = ['@@ -1,1 +1,1 @@', '+a', '\\ No newline at end of file'].join('\n')
    const m = buildNewLineMap(patch)
    expect(m.get(2)).toBe(1)
    expect(m.get(3)).toBeUndefined()
  })
})
