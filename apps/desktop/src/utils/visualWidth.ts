// Visual width — 터미널/모노스페이스 cell 기준 길이 계산.
// `docs/plan/22 §2 C2 + §5 Q-3` — 한글/CJK/emoji = 2-cell, ASCII = 1-cell.
//
// 사용 사례:
//   1) commit message 길이 (한글 36자 ≈ 영문 72자) — CommitMessageInput
//   2) BranchPanel / CommitTable 의 truncate 시각 보정 (한글 비중 높을 때 max-w 확장)
//   3) PrPanel title 의 한글 콘텐츠 dense 표시
//
// 정밀 East Asian Width 표 (Unicode UAX #11) 까지는 over-engineering.
// 간단 heuristic: codePoint > 255 → 2-cell (Hangul / Hanzi / Kana / fullwidth / emoji 모두 cover).

/** 문자열의 visual width (cell 단위). ASCII=1, CJK/Hangul/emoji=2. */
export function visualWidth(s: string): number {
  let w = 0
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0
    w += code > 255 ? 2 : 1
  }
  return w
}

/** visual width 기준 prefix N cell 만 잘라서 반환 (한글 1자 = 2 cell 가정). */
export function visualTruncate(s: string, maxCells: number): string {
  if (visualWidth(s) <= maxCells) return s
  let cells = 0
  let out = ''
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0
    const cellW = code > 255 ? 2 : 1
    if (cells + cellW > maxCells - 1) {
      // 마지막 1 cell 은 '…' 자리
      return out + '…'
    }
    out += ch
    cells += cellW
  }
  return out
}

/** 한글/CJK 비중 (0~1). 0.4+ 면 dense — UI 가 truncate 더 보수적으로 동작. */
export function cjkRatio(s: string): number {
  if (s.length === 0) return 0
  let cjk = 0
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0
    if (code > 255) cjk++
  }
  return cjk / s.length
}
