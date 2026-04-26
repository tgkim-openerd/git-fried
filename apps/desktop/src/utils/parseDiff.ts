// Unified diff → before/after blob 재구성 (Sprint E3, Diff Split 모드 용).
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
 * patch 의 첫 파일을 파싱.
 * 더 많은 파일은 v1.x — 현재는 sample / proof-of-concept.
 */
export function parseDiffFirstFile(patch: string): DiffFile | null {
  if (!patch.trim()) return null

  const lines = patch.split(/\r?\n/)
  let fileName = '?'
  let i = 0

  // 첫 file 헤더 찾기.
  for (; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('diff --git ')) {
      // 다음 줄 중에 +++ b/<path> 또는 --- a/<path> 찾음.
      for (let j = i; j < Math.min(i + 8, lines.length); j++) {
        if (lines[j].startsWith('+++ b/')) {
          fileName = lines[j].slice(6).trim()
          break
        }
      }
      break
    }
  }
  if (i >= lines.length) return null

  // 다음 file 시작 또는 EOF 까지 hunk 들 누적.
  const beforeLines: string[] = []
  const afterLines: string[] = []
  let inHunk = false

  for (; i < lines.length; i++) {
    const line = lines[i]

    // 다음 file 시작 → 종료.
    if (line.startsWith('diff --git ') && (beforeLines.length || afterLines.length)) {
      break
    }
    if (line.startsWith('@@')) {
      inHunk = true
      // hunk 사이 시각적 분리.
      if (beforeLines.length) beforeLines.push('')
      if (afterLines.length) afterLines.push('')
      // hunk 헤더 자체는 표시 안 함.
      continue
    }
    if (!inHunk) continue
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('index ')) {
      continue
    }
    if (line.startsWith('-')) {
      beforeLines.push(line.slice(1))
    } else if (line.startsWith('+')) {
      afterLines.push(line.slice(1))
    } else if (line.startsWith(' ')) {
      // context — 양쪽 모두.
      beforeLines.push(line.slice(1))
      afterLines.push(line.slice(1))
    } else if (line === '\\ No newline at end of file') {
      // 무시.
    } else {
      // 빈 줄 등 — context 로 처리.
      beforeLines.push(line)
      afterLines.push(line)
    }
  }

  return {
    fileName,
    before: beforeLines.join('\n'),
    after: afterLines.join('\n'),
  }
}
