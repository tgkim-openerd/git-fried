// Sprint H + N — buildHunkPatch / buildLinePatch round-trip 검증.
//
// patch math 는 git apply 가 strict 하므로 보수적 테스트 — 핵심 케이스만.
import { describe, expect, it } from 'vitest'
import {
  buildHunkPatch,
  buildLinePatch,
  parseDiffAllFiles,
  parseDiffWithHunks,
} from './parseDiff'

// Source 4 라인 (a, b, c, g) → Target 5 라인 (a, d, e, f, g).
const SAMPLE = `diff --git a/foo.txt b/foo.txt
index abc..def 100644
--- a/foo.txt
+++ b/foo.txt
@@ -1,4 +1,5 @@
 line a
-line b
-line c
+line d
+line e
+line f
 line g
`

describe('parseDiffAllFiles', () => {
  it('단일 파일 + hunks 정확히 분리', () => {
    const files = parseDiffAllFiles(SAMPLE)
    expect(files).toHaveLength(1)
    expect(files[0].fileName).toBe('foo.txt')
    // 끝 빈 줄 (trailing newline) 은 제거하고 비교.
    const beforeLines = files[0].before.split('\n').filter((x) => x !== '')
    const afterLines = files[0].after.split('\n').filter((x) => x !== '')
    expect(beforeLines).toEqual(['line a', 'line b', 'line c', 'line g'])
    expect(afterLines).toEqual(['line a', 'line d', 'line e', 'line f', 'line g'])
  })
})

describe('parseDiffWithHunks', () => {
  it('fileHeader + hunks 분리', () => {
    const files = parseDiffWithHunks(SAMPLE)
    expect(files).toHaveLength(1)
    const f = files[0]
    expect(f.fileName).toBe('foo.txt')
    expect(f.fileHeader).toContain('diff --git a/foo.txt b/foo.txt')
    expect(f.fileHeader).toContain('+++ b/foo.txt')
    expect(f.hunks).toHaveLength(1)
    const h = f.hunks[0]
    expect(h.header).toBe('@@ -1,4 +1,5 @@')
    // 끝 빈 줄 (trailing newline) 제거 후 비교.
    expect(h.bodyLines.filter((x) => x !== '')).toEqual([
      ' line a',
      '-line b',
      '-line c',
      '+line d',
      '+line e',
      '+line f',
      ' line g',
    ])
  })
})

describe('buildHunkPatch', () => {
  it('hunk 전체 그대로 재조립 시 원본과 거의 동일 (끝 newline 까지)', () => {
    const f = parseDiffWithHunks(SAMPLE)[0]
    const out = buildHunkPatch(f, f.hunks[0])
    expect(out).toContain('@@ -1,4 +1,5 @@')
    expect(out).toContain('-line b')
    expect(out).toContain('+line d')
    expect(out.endsWith('\n')).toBe(true)
  })
})

describe('buildLinePatch', () => {
  it('선택 0 → null', () => {
    const f = parseDiffWithHunks(SAMPLE)[0]
    expect(buildLinePatch(f, f.hunks[0], new Set())).toBeNull()
  })

  it('선택 0 (context 만 선택) → null', () => {
    const f = parseDiffWithHunks(SAMPLE)[0]
    // bodyLines[0] = ' line a' (context). 선택해도 변경 없음.
    expect(buildLinePatch(f, f.hunks[0], new Set([0]))).toBeNull()
  })

  it('첫 + 라인만 선택 — 나머지 - 는 context 로, 나머지 + 는 drop', () => {
    const f = parseDiffWithHunks(SAMPLE)[0]
    // bodyLines = [' line a', '-line b', '-line c', '+line d', '+line e', '+line f', ' line g']
    //  index   =     0           1          2          3          4          5          6
    const out = buildLinePatch(f, f.hunks[0], new Set([3]))
    expect(out).not.toBeNull()
    const text = out!
    // - 라인 두 개는 context 로 변환 (앞에 ' ' 붙음).
    expect(text).toContain(' line b')
    expect(text).toContain(' line c')
    // 선택 + 라인은 그대로.
    expect(text).toContain('+line d')
    // 미선택 + 라인 (e/f) 은 drop.
    expect(text).not.toMatch(/^\+line e$/m)
    expect(text).not.toMatch(/^\+line f$/m)
    // 카운트 재계산:
    //   oldCount = context(a) + 미선택-(b,c → context) + context(g) = 4
    //              + 선택-(0) = 4
    //   newCount = context(a) + 미선택-(b,c → context) + 선택+(d) + context(g) = 5
    expect(text).toMatch(/@@ -1,4 \+1,5 @@/)
  })

  it('선택 - 1개만 — 해당 deletion 만 stage, 나머지 + drop', () => {
    const f = parseDiffWithHunks(SAMPLE)[0]
    // bodyLines[1] = '-line b' 만 선택.
    const out = buildLinePatch(f, f.hunks[0], new Set([1]))
    expect(out).not.toBeNull()
    const text = out!
    // line b 는 - 그대로.
    expect(text).toMatch(/^-line b$/m)
    // line c 는 ' ' context 로.
    expect(text).toMatch(/^ line c$/m)
    // 모든 + 라인 drop.
    expect(text).not.toContain('+line d')
    expect(text).not.toContain('+line e')
    expect(text).not.toContain('+line f')
    // oldCount = a + b + c(미선택→context) + g = 4
    // newCount = a + c(미선택-→context) + g = 3
    expect(text).toMatch(/@@ -1,4 \+1,3 @@/)
  })

  it('전체 선택 = buildHunkPatch 와 동일한 변경 (header counts 일치)', () => {
    const f = parseDiffWithHunks(SAMPLE)[0]
    const all = new Set<number>()
    for (let i = 0; i < f.hunks[0].bodyLines.length; i++) {
      const ch = f.hunks[0].bodyLines[i].charAt(0)
      if (ch === '+' || ch === '-') all.add(i)
    }
    const linePatch = buildLinePatch(f, f.hunks[0], all)
    expect(linePatch).not.toBeNull()
    expect(linePatch!).toMatch(/@@ -1,4 \+1,5 @@/)
    expect(linePatch!).toContain('-line b')
    expect(linePatch!).toContain('+line d')
  })
})
