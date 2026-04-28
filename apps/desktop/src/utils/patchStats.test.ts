import { describe, expect, it } from 'vitest'
import { parsePatchStats } from './patchStats'

describe('parsePatchStats', () => {
  it('null / undefined / 빈 string → 0 stats', () => {
    expect(parsePatchStats(null)).toEqual({ adds: 0, dels: 0, files: 0 })
    expect(parsePatchStats(undefined)).toEqual({ adds: 0, dels: 0, files: 0 })
    expect(parsePatchStats('')).toEqual({ adds: 0, dels: 0, files: 0 })
  })

  it('단일 파일 추가 3 / 삭제 1 / 1 file', () => {
    const patch = [
      'diff --git a/foo.ts b/foo.ts',
      'index 1234567..abcdefg 100644',
      '--- a/foo.ts',
      '+++ b/foo.ts',
      '@@ -1,3 +1,5 @@',
      ' const a = 1',
      '-const b = 2',
      '+const b = 3',
      '+const c = 4',
      '+const d = 5',
    ].join('\n')
    expect(parsePatchStats(patch)).toEqual({ adds: 3, dels: 1, files: 1 })
  })

  it('두 파일 — files 카운트 2', () => {
    const patch = [
      'diff --git a/a.ts b/a.ts',
      '--- a/a.ts',
      '+++ b/a.ts',
      '@@ -1 +1 @@',
      '-old',
      '+new',
      'diff --git a/b.ts b/b.ts',
      '--- a/b.ts',
      '+++ b/b.ts',
      '@@ -1 +1 @@',
      '-old2',
      '+new2',
    ].join('\n')
    const s = parsePatchStats(patch)
    expect(s.files).toBe(2)
    expect(s.adds).toBe(2)
    expect(s.dels).toBe(2)
  })

  it('header 의 `---` / `+++` 라인은 dels/adds 에서 제외', () => {
    // ^-[^-] 정규식은 `---` 의 두번째 `-` 가 [^-] 매칭 실패 → 제외.
    // ^\+[^+] 동일.
    const patch = [
      'diff --git a/foo.ts b/foo.ts',
      '--- a/foo.ts',
      '+++ b/foo.ts',
      '@@ -1 +1 @@',
      '-only-removed',
      '+only-added',
    ].join('\n')
    const s = parsePatchStats(patch)
    expect(s.adds).toBe(1) // '+only-added' 만
    expect(s.dels).toBe(1) // '-only-removed' 만
  })

  it('한글 patch 라인 안전 — 한글 자체는 +/- 매칭 안 됨', () => {
    const patch = [
      'diff --git a/한글.md b/한글.md',
      '--- a/한글.md',
      '+++ b/한글.md',
      '@@ -1 +1 @@',
      '-기존 한글 라인',
      '+새 한글 라인 (수정)',
    ].join('\n')
    const s = parsePatchStats(patch)
    expect(s.files).toBe(1)
    expect(s.adds).toBe(1)
    expect(s.dels).toBe(1)
  })

  it('hunk 없이 mode change 만 — adds/dels 0, files 1', () => {
    const patch = ['diff --git a/script.sh b/script.sh', 'old mode 100644', 'new mode 100755'].join(
      '\n',
    )
    const s = parsePatchStats(patch)
    expect(s.files).toBe(1)
    expect(s.adds).toBe(0)
    expect(s.dels).toBe(0)
  })
})
