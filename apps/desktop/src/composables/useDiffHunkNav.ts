// Sprint c80-5 — DiffViewer 175 → <100 LOC 추출.
//
// Hunk navigation API 6 fn (findHunkLines/jumpToLine/currentHunkIndex/nextHunk/prevHunk/hunkCount).
// 부모 (StatusPanel / CommitDiffModal / CommitDiffPanel) 가 useTemplateRef 통해 defineExpose 결과 호출.
//
// caller-decision: EditorView instance 는 caller (DiffViewer SFC) 보유, composable 은 view 를
// getter 로 받음 (lifecycle 중 null 가능 — onMounted 에서만 set).
import { EditorView } from '@codemirror/view'

export function useDiffHunkNav(getView: () => EditorView | null): {
  findHunkLines: () => number[]
  jumpToLine: (n: number) => void
  nextHunk: () => void
  prevHunk: () => void
  hunkCount: () => number
} {
  function findHunkLines(): number[] {
    const view = getView()
    if (!view) return []
    const doc = view.state.doc
    const lines: number[] = []
    for (let i = 1; i <= doc.lines; i++) {
      const text = doc.line(i).text
      if (text.startsWith('@@')) lines.push(i)
    }
    return lines
  }

  function jumpToLine(lineNum: number) {
    const view = getView()
    if (!view) return
    const line = view.state.doc.line(lineNum)
    view.dispatch({
      selection: { anchor: line.from, head: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 24 }),
    })
    view.focus()
  }

  function currentHunkIndex(hunks: number[]): number {
    const view = getView()
    if (!view || hunks.length === 0) return -1
    const cursor = view.state.selection.main.head
    const cursorLine = view.state.doc.lineAt(cursor).number
    let idx = -1
    for (let i = 0; i < hunks.length; i++) {
      if (hunks[i] <= cursorLine) idx = i
      else break
    }
    return idx
  }

  function nextHunk() {
    const hunks = findHunkLines()
    if (hunks.length === 0) return
    const cur = currentHunkIndex(hunks)
    const nextIdx = cur < 0 ? 0 : Math.min(cur + 1, hunks.length - 1)
    jumpToLine(hunks[nextIdx])
  }

  function prevHunk() {
    const hunks = findHunkLines()
    if (hunks.length === 0) return
    const cur = currentHunkIndex(hunks)
    const prevIdx = cur <= 0 ? 0 : cur - 1
    jumpToLine(hunks[prevIdx])
  }

  function hunkCount(): number {
    return findHunkLines().length
  }

  return { findHunkLines, jumpToLine, nextHunk, prevHunk, hunkCount }
}
