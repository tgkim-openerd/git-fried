// c64-A — buildUntrackedPatch 단위 테스트.
//
// useFullscreenDiffQuery 의 export helper. untracked 파일 fake unified patch 생성 검증.
// 3 분기: empty content / binary (null byte) / text content.
import { describe, expect, it } from 'vitest'
import { buildUntrackedPatch } from './useFullscreenDiffQuery'

describe('buildUntrackedPatch — empty content', () => {
  it('빈 string → "(empty file)" placeholder', () => {
    const out = buildUntrackedPatch('foo.txt', '')
    expect(out).toContain('diff --git a/foo.txt b/foo.txt')
    expect(out).toContain('new file mode 100644')
    expect(out).toContain('(empty file)')
  })

  it('path 가 정확히 두 군데 (a/, b/) 들어감', () => {
    const out = buildUntrackedPatch('src/foo/bar.ts', '')
    expect(out.match(/src\/foo\/bar\.ts/g)?.length).toBe(2)
  })
})

describe('buildUntrackedPatch — binary content (null byte)', () => {
  it('null byte 포함 → "Binary file (untracked) <path>" placeholder', () => {
    const out = buildUntrackedPatch('img.png', 'AB\0CD')
    expect(out).toContain('Binary file (untracked) img.png')
    expect(out).toContain('new file mode 100644')
    // text diff body 가 없어야 함
    expect(out).not.toContain('+A')
  })

  it('null byte 가 맨 앞 — 여전히 binary 로 감지', () => {
    const out = buildUntrackedPatch('img.png', '\0magic')
    expect(out).toContain('Binary file (untracked) img.png')
  })

  it('null byte 가 맨 뒤 — 여전히 binary 로 감지', () => {
    const out = buildUntrackedPatch('lock.bin', 'data\0')
    expect(out).toContain('Binary file (untracked)')
  })
})

describe('buildUntrackedPatch — text content', () => {
  it('1라인 text → @@ -0,0 +1,1 @@ + + prefix line', () => {
    const out = buildUntrackedPatch('greeting.txt', 'hello world')
    expect(out).toContain('--- /dev/null')
    expect(out).toContain('+++ b/greeting.txt')
    expect(out).toContain('@@ -0,0 +1,1 @@')
    expect(out).toContain('+hello world')
  })

  it('3라인 text — @@ -0,0 +1,3 @@ + 모든 라인 + prefix', () => {
    const out = buildUntrackedPatch(
      'a.ts',
      ['export const a = 1', 'export const b = 2', 'export const c = 3'].join('\n'),
    )
    expect(out).toContain('@@ -0,0 +1,3 @@')
    expect(out).toContain('+export const a = 1')
    expect(out).toContain('+export const b = 2')
    expect(out).toContain('+export const c = 3')
  })

  it('파일 끝 newline → 마지막 빈 라인 제거 (line count 정확)', () => {
    const out = buildUntrackedPatch('x.txt', 'one\ntwo\n')
    expect(out).toContain('@@ -0,0 +1,2 @@')
    // 빈 라인 후 더 이상 + 추가 prefix 라인 없음
    const plusLines = out.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'))
    expect(plusLines).toEqual(['+one', '+two'])
  })

  it('파일 끝 newline 없음 — 동일하게 정상', () => {
    const out = buildUntrackedPatch('x.txt', 'one\ntwo')
    expect(out).toContain('@@ -0,0 +1,2 @@')
  })

  it('한글 라인 — UTF-8 safe', () => {
    const out = buildUntrackedPatch('한글.txt', '안녕\n세계')
    expect(out).toContain('+안녕')
    expect(out).toContain('+세계')
    expect(out).toContain('@@ -0,0 +1,2 @@')
  })
})

describe('buildUntrackedPatch — unified diff 형식 무결성', () => {
  it('header 4 라인 — diff/new file mode/--- ///dev/null/+++ b/path', () => {
    const out = buildUntrackedPatch('a.ts', 'x')
    const lines = out.split('\n')
    expect(lines[0]).toBe('diff --git a/a.ts b/a.ts')
    expect(lines[1]).toBe('new file mode 100644')
    expect(lines[2]).toBe('--- /dev/null')
    expect(lines[3]).toBe('+++ b/a.ts')
  })

  it('hunk header @@ pattern 검증', () => {
    const out = buildUntrackedPatch('a.ts', 'x\ny\nz')
    expect(out).toMatch(/@@ -0,0 \+1,3 @@/)
  })
})
