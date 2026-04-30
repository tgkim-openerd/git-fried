// Sprint c33 — useCommitMutation 단위 테스트.
//
// hookKind / hasConflictHints helper 만 검증 (composable 자체는 vue-query 의존).
import { describe, expect, it } from 'vitest'
import { hasConflictHints, hookKind } from './useCommitMutation'

describe('hookKind', () => {
  it('husky 마커 감지', () => {
    expect(hookKind('husky > pre-commit hook failed')).toBe('husky')
    expect(hookKind('Husky verification failed')).toBe('husky')
  })

  it('lefthook 마커 감지', () => {
    expect(hookKind('lefthook: pre-commit ❯ eslint')).toBe('lefthook')
    expect(hookKind('Lefthook hook execution')).toBe('lefthook')
  })

  it('pre-commit fallback', () => {
    expect(hookKind('pre-commit script failed')).toBe('pre-commit')
  })

  it('미매치 시 null', () => {
    expect(hookKind('generic git error')).toBeNull()
    expect(hookKind('')).toBeNull()
  })

  it('우선순위: husky > lefthook > pre-commit', () => {
    // husky 가 들어있으면 husky 가 우선.
    expect(hookKind('husky > pre-commit failed')).toBe('husky')
    // lefthook + pre-commit → lefthook.
    expect(hookKind('lefthook pre-commit hook')).toBe('lefthook')
  })
})

describe('hasConflictHints', () => {
  it('<<<<<<< HEAD 마커 감지', () => {
    expect(hasConflictHints({ stdout: '<<<<<<< HEAD' })).toBe(true)
    expect(hasConflictHints({ stderr: '<<<<<< HEAD' })).toBe(true)
  })

  it('"needs merge" 메시지 감지', () => {
    expect(hasConflictHints({ stderr: 'error: foo.ts: needs merge' })).toBe(true)
  })

  it('"unmerged paths" 감지', () => {
    expect(hasConflictHints({ stderr: 'Unmerged paths:\n  both modified: foo.ts' })).toBe(true)
  })

  it('"conflicting files" 감지', () => {
    expect(hasConflictHints({ stderr: 'Found conflicting files in:' })).toBe(true)
  })

  it('"you have unmerged files" 감지', () => {
    expect(hasConflictHints({ stderr: 'You have unmerged files.' })).toBe(true)
  })

  it('일반 에러는 미매치', () => {
    expect(hasConflictHints({ stderr: 'fatal: not a git repository' })).toBe(false)
    expect(hasConflictHints({ stdout: '', stderr: '' })).toBe(false)
    expect(hasConflictHints({})).toBe(false)
  })

  it('stdout/stderr 둘 다 검사', () => {
    expect(hasConflictHints({ stdout: 'needs merge', stderr: 'ok' })).toBe(true)
    expect(hasConflictHints({ stdout: 'ok', stderr: '<<<<<<< HEAD' })).toBe(true)
  })
})
