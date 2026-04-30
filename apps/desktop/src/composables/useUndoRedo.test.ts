// Sprint c36 — useUndoRedo helper 단위 테스트 (sanitizeReflogPreview only).
import { describe, expect, it } from 'vitest'
import { sanitizeReflogPreview } from './useUndoRedo'

describe('sanitizeReflogPreview', () => {
  it('빈 문자열 → 빈 문자열', () => {
    expect(sanitizeReflogPreview('')).toBe('')
  })

  it('단일 라인 ASCII 통과', () => {
    expect(sanitizeReflogPreview('feat: add login')).toBe('feat: add login')
  })

  it('한글 메시지 통과', () => {
    expect(sanitizeReflogPreview('한글 commit 메시지')).toBe('한글 commit 메시지')
  })

  it('첫 라인만 사용 (\\n 으로 절단)', () => {
    expect(sanitizeReflogPreview('first line\nsecond line\nthird')).toBe('first line')
  })

  it('CRLF 도 처리', () => {
    expect(sanitizeReflogPreview('first\r\nsecond')).toBe('first')
  })

  it('50 자 절단', () => {
    const long = 'a'.repeat(100)
    expect(sanitizeReflogPreview(long).length).toBe(50)
  })

  it('control char (ANSI escape) 제거 — SEC-005', () => {
    expect(sanitizeReflogPreview('\x1b[31mred\x1b[0m text')).toBe('[31mred[0m text')
    // \x1b 자체는 0x1b → 제거됨.
  })

  it('NUL byte 제거', () => {
    expect(sanitizeReflogPreview('a\x00b\x01c')).toBe('abc')
  })

  it('실제 reflog 시뮬: ANSI + 한글 + 절단', () => {
    const raw = '\x1b[1;32mfeat\x1b[0m: 한글 commit'
    expect(sanitizeReflogPreview(raw)).toBe('[1;32mfeat[0m: 한글 commit')
  })
})
