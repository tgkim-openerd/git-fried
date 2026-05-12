// Sprint c80-5 — DiffViewer 추출. CodeMirror diff 라인 데코레이션 (+, -, @@, file header).
//
// 분리 이유: pure CodeMirror plugin (Vue lifecycle 무관) → utils/.
// 재사용: 향후 inline diff / merge editor 에서도 동일 클래스 매핑 가능.
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'

function build(view: EditorView): DecorationSet {
  const builder: { from: number; to: number; deco: Decoration }[] = []
  for (const { from, to } of view.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos)
      const text = line.text
      let cls: string | null = null
      if (text.startsWith('+++') || text.startsWith('---')) cls = 'cm-diff-meta'
      else if (text.startsWith('@@')) cls = 'cm-diff-hunk'
      else if (text.startsWith('+')) cls = 'cm-diff-add'
      else if (text.startsWith('-')) cls = 'cm-diff-del'
      else if (text.startsWith('diff ')) cls = 'cm-diff-file'
      if (cls) {
        builder.push({
          from: line.from,
          to: line.from,
          deco: Decoration.line({ attributes: { class: cls } }),
        })
      }
      pos = line.to + 1
      if (line.from === line.to && line.from === view.state.doc.length) break
    }
  }
  return Decoration.set(
    builder.map((b) => b.deco.range(b.from)),
    true,
  )
}

export const diffDecorationsPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = build(view)
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) this.decorations = build(u.view)
    }
  },
  { decorations: (v) => v.decorations },
)

export const diffBaseTheme = EditorView.baseTheme({
  '&': { fontSize: '12px', height: '100%' },
  '.cm-content': { fontFamily: 'JetBrains Mono, D2Coding, Consolas, monospace' },
  '.cm-diff-add': { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
  '.cm-diff-del': { backgroundColor: 'rgba(244, 63, 94, 0.18)' },
  '.cm-diff-hunk': { color: '#94a3b8', fontStyle: 'italic' },
  '.cm-diff-meta': { color: '#64748b' },
  '.cm-diff-file': { color: '#0ea5e9', fontWeight: 'bold' },
})
