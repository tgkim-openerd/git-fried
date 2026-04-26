// types/git.ts 의 buildConventional 단위 테스트.
import { describe, expect, it } from 'vitest'
import { buildConventional } from './git'

describe('buildConventional', () => {
  it('기본 feat: subject', () => {
    expect(
      buildConventional({
        type: 'feat',
        scope: '',
        breaking: false,
        subject: '결제 모듈 통합',
        body: '',
        footer: '',
      }),
    ).toBe('feat: 결제 모듈 통합')
  })

  it('scope + breaking', () => {
    expect(
      buildConventional({
        type: 'fix',
        scope: 'auth',
        breaking: true,
        subject: 'JWT 만료 처리',
        body: '',
        footer: '',
      }),
    ).toBe('fix(auth)!: JWT 만료 처리')
  })

  it('body + footer 가 빈 줄로 구분된다', () => {
    const out = buildConventional({
      type: 'chore',
      scope: 'deps',
      breaking: false,
      subject: 'Tauri 2.1 업데이트',
      body: '브레이킹 변경 없음.\nNitro 호환.',
      footer: 'Refs: #42',
    })
    expect(out).toBe(
      'chore(deps): Tauri 2.1 업데이트\n\n브레이킹 변경 없음.\nNitro 호환.\n\nRefs: #42',
    )
  })

  it('한글 subject + 영문 mixed scope', () => {
    expect(
      buildConventional({
        type: 'docs',
        scope: 'README',
        breaking: false,
        subject: '한글 사용 안내 추가 ✓',
        body: '',
        footer: '',
      }),
    ).toBe('docs(README): 한글 사용 안내 추가 ✓')
  })

  it('subject 양 끝 공백은 trim 되지만 중간은 보존', () => {
    expect(
      buildConventional({
        type: 'feat',
        scope: '  ',
        breaking: false,
        subject: '  중간   공백 보존  ',
        body: '',
        footer: '',
      }),
    ).toBe('feat: 중간   공백 보존')
  })
})
