// Unified diff → before/after blob 재구성 (Sprint E3 + F3, Diff Split 모드 용).
//
// git diff 의 unified format 만 가지고 양쪽 파일을 textual 추정.
// 한계:
//   - hunk 사이 unchanged 영역은 모름 → MergeView 가 hunk 만 비교 가능.
//   - binary / rename / mode change 는 fallback (단일 파일).
// → 정확한 split 은 별도 endpoint 가 두 blob (HEAD vs HEAD~) 직접 fetch 해야.

export interface DiffFile {
  /** `+++ b/<path>` 의 path. */
  fileName: string
  before: string
  after: string
}

/**
 * patch 의 모든 파일을 파싱 (Sprint F3).
 * 빈 patch → 빈 배열.
 */
export function parseDiffAllFiles(patch: string): DiffFile[] {
  if (!patch.trim()) return []
  const lines = patch.split(/\r?\n/)
  const out: DiffFile[] = []

  let i = 0
  while (i < lines.length) {
    // 다음 `diff --git ` 헤더 찾기.
    while (i < lines.length && !lines[i].startsWith('diff --git ')) i++
    if (i >= lines.length) break

    // 파일명 추출.
    let fileName = '?'
    for (let j = i; j < Math.min(i + 8, lines.length); j++) {
      if (lines[j].startsWith('+++ b/')) {
        fileName = lines[j].slice(6).trim()
        break
      }
    }

    // 다음 `diff --git ` 또는 EOF 까지 hunk 누적.
    const beforeLines: string[] = []
    const afterLines: string[] = []
    let inHunk = false
    let k = i + 1

    while (k < lines.length) {
      const line = lines[k]
      if (line.startsWith('diff --git ')) break
      if (line.startsWith('@@')) {
        inHunk = true
        if (beforeLines.length) beforeLines.push('')
        if (afterLines.length) afterLines.push('')
        k++
        continue
      }
      if (!inHunk) {
        k++
        continue
      }
      if (
        line.startsWith('+++') ||
        line.startsWith('---') ||
        line.startsWith('index ')
      ) {
        k++
        continue
      }
      if (line.startsWith('-')) {
        beforeLines.push(line.slice(1))
      } else if (line.startsWith('+')) {
        afterLines.push(line.slice(1))
      } else if (line.startsWith(' ')) {
        beforeLines.push(line.slice(1))
        afterLines.push(line.slice(1))
      } else if (line === '\\ No newline at end of file') {
        // 무시.
      } else {
        beforeLines.push(line)
        afterLines.push(line)
      }
      k++
    }

    out.push({
      fileName,
      before: beforeLines.join('\n'),
      after: afterLines.join('\n'),
    })
    i = k
  }

  return out
}

/**
 * patch 의 첫 파일을 파싱.
 * 다중 파일은 `parseDiffAllFiles` 사용.
 */
export function parseDiffFirstFile(patch: string): DiffFile | null {
  return parseDiffAllFiles(patch)[0] ?? null
}

// ===== Hunk-level 단위 (Sprint H, line-level stage) =====

export interface DiffHunk {
  /** "@@ -10,5 +10,7 @@" 헤더 (function context 포함). */
  header: string
  /** hunk body 라인들 (각 line 은 +/-/공백 prefix 유지). */
  bodyLines: string[]
}

export interface DiffFileWithHunks {
  /** "diff --git a/<path> b/<path>" 의 path. */
  fileName: string
  /** "diff --git ..." 부터 "+++ b/..." 까지의 헤더 (hunk patch 재조립 시 prefix). */
  fileHeader: string
  hunks: DiffHunk[]
}

/**
 * patch 에서 모든 파일 + 각 파일의 hunks 분리.
 * 라인/hunk 단위 stage 용 (Sprint H).
 */
export function parseDiffWithHunks(patch: string): DiffFileWithHunks[] {
  if (!patch.trim()) return []
  const lines = patch.split(/\r?\n/)
  const files: DiffFileWithHunks[] = []

  let i = 0
  while (i < lines.length) {
    while (i < lines.length && !lines[i].startsWith('diff --git ')) i++
    if (i >= lines.length) break

    // file header 수집: "diff --git " 부터 "+++ b/..." 까지.
    const headerStart = i
    let plusFound = false
    let fileName = '?'
    let k = i
    while (k < lines.length) {
      const l = lines[k]
      if (l.startsWith('+++ b/')) {
        fileName = l.slice(6).trim()
        plusFound = true
        k++
        break
      }
      if (l.startsWith('@@')) break
      k++
    }
    const fileHeader = lines.slice(headerStart, k).join('\n')

    // hunks 누적: "@@" 만나면 새 hunk, "diff --git " 또는 EOF 시 종료.
    const hunks: DiffHunk[] = []
    let cur: DiffHunk | null = null
    while (k < lines.length) {
      const l = lines[k]
      if (l.startsWith('diff --git ')) break
      if (l.startsWith('@@')) {
        if (cur) hunks.push(cur)
        cur = { header: l, bodyLines: [] }
        k++
        continue
      }
      if (cur) cur.bodyLines.push(l)
      k++
    }
    if (cur) hunks.push(cur)

    if (plusFound && hunks.length > 0) {
      files.push({ fileName, fileHeader, hunks })
    }
    i = k
  }

  return files
}

/**
 * 단일 hunk 를 적용 가능한 minimal patch 텍스트로 재조립.
 * `git apply --cached -` 입력으로 사용.
 */
export function buildHunkPatch(
  file: Pick<DiffFileWithHunks, 'fileHeader'>,
  hunk: DiffHunk,
): string {
  const tail = hunk.bodyLines.join('\n')
  // file header + hunk header + body. 끝 newline 보장 (git apply 요구).
  return `${file.fileHeader}\n${hunk.header}\n${tail}${tail.endsWith('\n') ? '' : '\n'}`
}

/**
 * 라인 단위 partial stage / unstage patch — Sprint N (`docs/plan/11 §7`).
 *
 * 알고리즘:
 *   - 선택 `-` 라인: 그대로 `-` (해당 deletion 만 stage)
 *   - 미선택 `-` 라인: ` ` context 로 변환 (deletion 안 함, source 에 그대로 존재)
 *   - 선택 `+` 라인: 그대로 `+` (해당 addition 만 stage)
 *   - 미선택 `+` 라인: drop (addition 발생 안 함)
 *   - context (` `) / `\ No newline ...`: 보존
 *   - 빈 줄 (parseDiffWithHunks 가 hunk 사이 분리용 삽입): drop
 *
 * hunk header `@@ -A,B +C,D @@ ctx` 의 B (oldCount) / D (newCount) 재계산:
 *   - oldCount = context + `-` (선택/미선택 모두 source 에 존재)
 *   - newCount = context + 선택 `+` + 미선택 `-` (context 로 변환되어 target 에 존재)
 *
 * 라인 변경이 0 (선택된 ± 라인 없음) → null 반환 → UI 가 안내.
 *
 * @param selectedSet hunk.bodyLines index 기준의 선택 인덱스 집합. context 인덱스는 무시됨.
 */
export function buildLinePatch(
  file: Pick<DiffFileWithHunks, 'fileHeader'>,
  hunk: DiffHunk,
  selectedSet: Set<number>,
): string | null {
  const newBody: string[] = []
  let oldCount = 0
  let newCount = 0
  let containsChange = false

  for (let i = 0; i < hunk.bodyLines.length; i++) {
    const line = hunk.bodyLines[i]
    if (line === '') continue // hunk 사이 시각적 분리 라인 — drop
    if (line === '\\ No newline at end of file') {
      newBody.push(line)
      continue
    }
    const ch = line.charAt(0)
    const rest = line.slice(1)
    if (ch === ' ') {
      newBody.push(line)
      oldCount++
      newCount++
    } else if (ch === '-') {
      if (selectedSet.has(i)) {
        newBody.push(line)
        oldCount++
        containsChange = true
      } else {
        // 미선택 deletion → context 로 보존.
        newBody.push(' ' + rest)
        oldCount++
        newCount++
      }
    } else if (ch === '+') {
      if (selectedSet.has(i)) {
        newBody.push(line)
        newCount++
        containsChange = true
      }
      // 미선택 addition → drop.
    } else {
      // 기타 prefix — 안전하게 context 로 처리.
      newBody.push(' ' + line)
      oldCount++
      newCount++
    }
  }

  if (!containsChange) return null

  const m = hunk.header.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/)
  if (!m) return null
  const oldStart = m[1]
  const newStart = m[2]
  const tail = m[3] ?? ''
  const newHeader = `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@${tail}`
  const body = newBody.join('\n')
  return `${file.fileHeader}\n${newHeader}\n${body}${body.endsWith('\n') ? '' : '\n'}`
}

/**
 * hunk body 의 한 라인이 "변경 가능" (= +/- 로 시작하는 stage 후보) 인지.
 * UI 에서 checkbox 노출 결정용.
 */
export function isStageableLine(line: string): boolean {
  const ch = line.charAt(0)
  return ch === '+' || ch === '-'
}
