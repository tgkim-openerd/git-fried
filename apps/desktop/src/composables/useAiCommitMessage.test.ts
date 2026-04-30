// Sprint c32 — useAiCommitMessage parseAiResult 단위 테스트.
// composable 자체 (useQuery / useMutation) 는 Vue context 필요 — 본 test 는 parser
// 만 격리 검증.
import { describe, expect, it } from 'vitest'
import { parseAiResult } from './useAiCommitMessage'

describe('parseAiResult — Conventional 매칭', () => {
  it('feat: subject only — type/subject 만 매치, body 없음', () => {
    const r = parseAiResult('feat: add new button')
    expect(r.freeMessage).toBe('feat: add new button')
    expect(r.conventional).toBeDefined()
    expect(r.conventional!.type).toBe('feat')
    expect(r.conventional!.scope).toBe('')
    expect(r.conventional!.breaking).toBe(false)
    expect(r.conventional!.subject).toBe('add new button')
    expect(r.conventional!.body).toBe('')
  })

  it('fix(scope): subject — scope 매치', () => {
    const r = parseAiResult('fix(auth): handle expired token')
    expect(r.conventional!.type).toBe('fix')
    expect(r.conventional!.scope).toBe('auth')
    expect(r.conventional!.breaking).toBe(false)
    expect(r.conventional!.subject).toBe('handle expired token')
  })

  it('feat!: breaking change — breaking flag', () => {
    const r = parseAiResult('feat!: rename API')
    expect(r.conventional!.breaking).toBe(true)
    expect(r.conventional!.subject).toBe('rename API')
  })

  it('feat(api)!: scope + breaking 동시', () => {
    const r = parseAiResult('feat(api)!: drop v1 endpoints')
    expect(r.conventional!.scope).toBe('api')
    expect(r.conventional!.breaking).toBe(true)
  })

  it('subject + 빈 줄 + body — body 추출', () => {
    const r = parseAiResult('feat: add X\n\nThis adds X to the system.\nMore details here.')
    expect(r.conventional!.subject).toBe('add X')
    expect(r.conventional!.body).toBe('This adds X to the system.\nMore details here.')
  })

  it('subject + body 빈 줄 없음 — body 빈 문자열', () => {
    const r = parseAiResult('feat: add X\nno blank separator line')
    expect(r.conventional!.subject).toBe('add X')
    expect(r.conventional!.body).toBe('')
  })

  it('한글 subject + 한글 body', () => {
    const r = parseAiResult('feat: 새 버튼 추가\n\n사용자 요청 반영.')
    expect(r.conventional!.type).toBe('feat')
    expect(r.conventional!.subject).toBe('새 버튼 추가')
    expect(r.conventional!.body).toBe('사용자 요청 반영.')
  })
})

describe('parseAiResult — Conventional 미매치 (free 모드 fallback)', () => {
  it('Unknown type prefix — conventional undefined, freeMessage 만', () => {
    const r = parseAiResult('random: not a conventional type')
    expect(r.conventional).toBeUndefined()
    expect(r.freeMessage).toBe('random: not a conventional type')
  })

  it('Plain prose — conventional undefined', () => {
    const r = parseAiResult('Just plain commit message without prefix.')
    expect(r.conventional).toBeUndefined()
    expect(r.freeMessage).toBe('Just plain commit message without prefix.')
  })

  it('빈 문자열 — freeMessage 빈, conventional undefined', () => {
    const r = parseAiResult('')
    expect(r.freeMessage).toBe('')
    expect(r.conventional).toBeUndefined()
  })

  it('whitespace 만 — trim 후 빈 freeMessage', () => {
    const r = parseAiResult('   \n   \n   ')
    expect(r.freeMessage).toBe('')
    expect(r.conventional).toBeUndefined()
  })
})

describe('parseAiResult — edge case', () => {
  it('CRLF (Windows) line ending — body parsing 정상', () => {
    const r = parseAiResult('feat: add X\r\n\r\nbody line')
    expect(r.conventional!.subject).toBe('add X')
    expect(r.conventional!.body).toBe('body line')
  })

  it('subject trailing whitespace — match 정상', () => {
    const r = parseAiResult('feat: subject  ')
    // trim 은 전체에 적용되지만 subject 는 regex match 그룹 — trailing space 포함
    expect(r.conventional!.subject).toContain('subject')
  })
})
