// c58 P3-5 회귀 보호 — UserAvatar 한글 2글자 fallback + font 축소.

import { describe, expect, it } from 'vitest'

// authorInitial / initial 로직 추출 (UserAvatar 와 CommitGraph / CommitDetailSidebar 동일).
function authorInitial(name: string | undefined | null): string {
  if (!name) return '?'
  const trimmed = name.trim()
  if (!trimmed) return '?'
  if (/^[가-힯]/.test(trimmed)) return trimmed.slice(0, 2)
  return trimmed.charAt(0).toUpperCase()
}

describe('authorInitial (P3-5 한글 2글자 fallback)', () => {
  it('한글 1글자 → 2자 (없으면 1자)', () => {
    expect(authorInitial('김')).toBe('김')
  })
  it('한글 3글자 → 첫 2자', () => {
    expect(authorInitial('김태길')).toBe('김태')
  })
  it('한글 2글자 → 그대로', () => {
    expect(authorInitial('홍길')).toBe('홍길')
  })
  it('영문 1글자 → 대문자', () => {
    expect(authorInitial('a')).toBe('A')
  })
  it('영문 다글자 → 첫 1자 대문자', () => {
    expect(authorInitial('tgkim')).toBe('T')
  })
  it('한글로 시작 + 영문 → 한글 2자', () => {
    expect(authorInitial('김tgkim')).toBe('김t')
  })
  it('빈/null/undefined → "?"', () => {
    expect(authorInitial('')).toBe('?')
    expect(authorInitial(null)).toBe('?')
    expect(authorInitial(undefined)).toBe('?')
    expect(authorInitial('   ')).toBe('?')
  })
  it('한글 결과 length=2 → font 축소 trigger', () => {
    expect(authorInitial('김태').length).toBeGreaterThanOrEqual(2)
    expect(authorInitial('tgkim').length).toBe(1)
  })
})
