import { describe, expect, it } from 'vitest'
import {
  describeError,
  formatError,
  humanizeGitError,
  isAppErrorKind,
  isAuthExpiredError,
  isRateLimitError,
} from './errors'

describe('formatError', () => {
  it('null/undefined → 빈 문자열', () => {
    expect(formatError(null)).toBe('')
    expect(formatError(undefined)).toBe('')
  })
  it('string 그대로', () => {
    expect(formatError('plain error')).toBe('plain error')
  })
  it('Error → message', () => {
    expect(formatError(new Error('boom'))).toBe('boom')
  })
  it('AppError 객체 → "[kind] message"', () => {
    expect(formatError({ kind: 'git_cli', message: 'fetch failed' })).toBe('[git_cli] fetch failed')
  })
  it('AppError + stderr — 줄바꿈 후 stderr 추가', () => {
    const result = formatError({
      kind: 'git_cli',
      message: 'fetch failed',
      stderr: 'remote: 404',
    })
    expect(result).toBe('[git_cli] fetch failed\nremote: 404')
  })
  it('AppError 객체 — message 만 (kind 없음)', () => {
    expect(formatError({ message: 'plain' })).toBe('plain')
  })
  it('정체불명 객체 → JSON.stringify', () => {
    const result = formatError({ foo: 'bar' })
    expect(result).toContain('"foo"')
    expect(result).toContain('"bar"')
  })
  it('숫자 → String', () => {
    expect(formatError(42)).toBe('42')
  })
})

describe('humanizeGitError — 11 한글 힌트 패턴', () => {
  it("no such ref / couldn't find remote ref → 첫 push 안내", () => {
    const out = humanizeGitError("couldn't find remote ref refs/heads/foo")
    expect(out).toContain('⚠')
    expect(out).toContain('첫 push')
  })

  it('Repository not found → 404 안내', () => {
    expect(humanizeGitError('remote: Repository not found')).toContain('404')
  })

  it('Authentication failed → PAT/SSH 안내', () => {
    const out = humanizeGitError('Authentication failed')
    expect(out).toContain('인증 실패')
    expect(out).toContain('PAT')
  })

  it('Permission denied (publickey) → SSH 안내', () => {
    expect(humanizeGitError('Permission denied (publickey)')).toContain('SSH')
  })

  it('401 Unauthorized → Forge 인증 만료 (재발급 안내)', () => {
    const out = humanizeGitError('HTTP 401 Unauthorized')
    expect(out).toContain('Forge 인증 만료')
    expect(out).toContain('재발급')
  })

  it('Bad credentials → 401 패턴', () => {
    expect(humanizeGitError('Bad credentials')).toContain('Forge 인증 만료')
  })

  it('"status":401 JSON → 401 패턴', () => {
    expect(humanizeGitError('{"status":401}')).toContain('Forge 인증 만료')
  })

  it('403 Forbidden → 권한 부족 안내 (scope)', () => {
    const out = humanizeGitError('HTTP 403 Forbidden')
    expect(out).toContain('권한 부족')
    expect(out).toContain('scope')
  })

  it('CONFLICT → 머지 충돌 안내', () => {
    expect(humanizeGitError('CONFLICT (content): Merge conflict')).toContain('머지 충돌')
  })

  it('non-fast-forward → pull/rebase 안내', () => {
    expect(humanizeGitError('Updates were rejected')).toContain('non-fast-forward')
  })

  it('safe.directory → safe.directory 정책 안내', () => {
    expect(humanizeGitError('dubious ownership in repository')).toContain('safe.directory')
  })

  it('No such file or directory → 경로 안내', () => {
    expect(humanizeGitError('No such file or directory')).toContain('경로')
  })

  it('패턴 미매칭 시 원본 그대로', () => {
    expect(humanizeGitError('totally unknown error')).toBe('totally unknown error')
  })
})

describe('describeError — formatError + humanizeGitError 통합', () => {
  it('AppError + 한글 힌트 동시 적용', () => {
    const out = describeError({
      kind: 'git_cli',
      message: '401 Unauthorized',
    })
    expect(out).toContain('[git_cli]')
    expect(out).toContain('Forge 인증 만료')
  })
  it('null → 빈 문자열', () => {
    expect(describeError(null)).toBe('')
  })
})

// Sprint c30 / MED 2 — Forge 특화 kind 분기
describe('isAppErrorKind / Forge 특화 kind helper', () => {
  it('rate_limit kind 매칭', () => {
    expect(isRateLimitError({ kind: 'rate_limit', message: 'x', retryAfter: 60 })).toBe(true)
    expect(isRateLimitError({ kind: 'git_cli', message: 'x' })).toBe(false)
    expect(isRateLimitError(null)).toBe(false)
    expect(isRateLimitError('string')).toBe(false)
  })
  it('auth_expired kind 매칭', () => {
    expect(isAuthExpiredError({ kind: 'auth_expired', provider: 'GitHub' })).toBe(true)
    expect(isAuthExpiredError({ kind: 'rate_limit' })).toBe(false)
  })
  it('isAppErrorKind generic 분기', () => {
    expect(isAppErrorKind({ kind: 'validation' }, 'validation')).toBe(true)
    expect(isAppErrorKind({ kind: 'validation' }, 'rate_limit')).toBe(false)
    expect(isAppErrorKind(undefined, 'validation')).toBe(false)
  })
})

describe('humanizeGitError — Sprint c30 추가 패턴', () => {
  it('rate limit 키워드 → 한국어 힌트', () => {
    const out = humanizeGitError('GitHub: API rate limit exceeded')
    expect(out).toContain('rate limit')
    expect(out).toContain('PAT')
  })
  it('429 status → rate limit 힌트', () => {
    const out = humanizeGitError('HTTP 429 Too Many Requests')
    expect(out).toContain('rate limit')
  })
  it('한국어 메시지 (AppError::AuthExpired) → 토큰 재입력 힌트', () => {
    const out = humanizeGitError('GitHub 토큰이 만료되었거나 권한이 부족합니다.')
    expect(out).toContain('토큰 재입력')
  })
})
