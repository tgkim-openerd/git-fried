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
