// plan #44 E3 — unified patch 의 각 doc-line(1-based, CodeMirror) → RIGHT(new file) line 번호 매핑.
//
// PR diff line-comment 의 `line` 인자는 new-file 1-based line (addReviewComment 시맨틱).
// context(' ')/added('+') 라인만 commentable(new-file line 보유), removed('-')/header 는 제외.
// `@@ -a,b +c,d @@` 헤더에서 new-file 시작 라인(c)을 읽어 이후 라인을 카운트.
//
// PrFile.patch 는 파일 단위 unified diff(hunk 들). diff/index/---/+++ preamble 이 있어도
// 첫 @@ 이전이라 inHunk=false 로 skip → +++ b/file 의 '+' 오인 없음.

const HUNK_RE = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/

/** patch → Map<docLine(1-based), newFileLine(1-based)>. commentable 라인만 포함. */
export function buildNewLineMap(patch: string): Map<number, number> {
  const map = new Map<number, number>()
  if (!patch) return map
  const lines = patch.split('\n')
  let newLine = 0
  let inHunk = false
  for (let i = 0; i < lines.length; i++) {
    const docLine = i + 1
    const l = lines[i]
    const hunk = HUNK_RE.exec(l)
    if (hunk) {
      newLine = parseInt(hunk[1], 10)
      inHunk = true
      continue
    }
    if (!inHunk) continue
    const c = l[0]
    if (c === '+') {
      map.set(docLine, newLine)
      newLine++
    } else if (c === ' ') {
      // context. unified diff 의 빈 줄도 ' ' prefix 보유. 진짜 '' (l === '') 는 trailing-newline
      // split 아티팩트이므로 context 로 취급 안 함 — else 로 떨어져 매핑 제외 (Codex MED: phantom 방지).
      map.set(docLine, newLine)
      newLine++
    } else if (c === '-') {
      // removed — new-file line 없음 (commentable 아님)
    } else if (c === '\\') {
      // "\ No newline at end of file" — skip (라인 카운트 영향 없음)
    } else {
      // 그 외(다음 파일 diff/index 등) — hunk 종료
      inHunk = false
    }
  }
  return map
}
