<script setup lang="ts">
// CodeMirror 6 기반 통합 diff 뷰어.
//
// 입력: git diff 의 plain text (unified format).
// 출력: + / - 라인 색상 + 헤더 강조 + 한글 안전 표시.
//
// v0.2 의 3-way merge editor 는 별도 컴포넌트 (`MergeEditor.vue`).
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { EditorState } from '@codemirror/state'
import { EditorView, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { Decoration, type DecorationSet, ViewPlugin, type ViewUpdate } from '@codemirror/view'

const props = defineProps<{ patch: string }>()
const containerRef = ref<HTMLDivElement | null>(null)
let view: EditorView | null = null

// + / - / @@ 라인 데코레이션
const diffDecorationsPlugin = ViewPlugin.fromClass(
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

const baseTheme = EditorView.baseTheme({
  '&': { fontSize: '12px', height: '100%' },
  '.cm-content': { fontFamily: 'JetBrains Mono, D2Coding, Consolas, monospace' },
  '.cm-diff-add': { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
  '.cm-diff-del': { backgroundColor: 'rgba(244, 63, 94, 0.18)' },
  '.cm-diff-hunk': { color: '#94a3b8', fontStyle: 'italic' },
  '.cm-diff-meta': { color: '#64748b' },
  '.cm-diff-file': { color: '#0ea5e9', fontWeight: 'bold' },
})

function buildState(doc: string) {
  return EditorState.create({
    doc,
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      oneDark,
      baseTheme,
      diffDecorationsPlugin,
      EditorView.editable.of(false),
      EditorView.lineWrapping,
    ],
  })
}

onMounted(() => {
  if (!containerRef.value) return
  view = new EditorView({
    state: buildState(props.patch || ''),
    parent: containerRef.value,
  })
})

watch(
  () => props.patch,
  (next) => {
    if (!view) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: next || '' },
    })
  },
)

onUnmounted(() => view?.destroy())

// === Sprint c25-4 (`docs/plan/25 §5`) — Hunk navigation API ===
// `@@ -... +... @@` 라인 위치를 모아 정/역방향 점프 + scrollIntoView.
// 부모 컴포넌트가 ref 로 받아 ↑/↓ 버튼에 와이어업.
function findHunkLines(): number[] {
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
  if (!view) return
  const line = view.state.doc.line(lineNum)
  view.dispatch({
    selection: { anchor: line.from, head: line.from },
    effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 24 }),
  })
  view.focus()
}

function currentHunkIndex(hunks: number[]): number {
  if (!view || hunks.length === 0) return -1
  const cursor = view.state.selection.main.head
  const cursorLine = view.state.doc.lineAt(cursor).number
  // 현재 커서가 속한 가장 가까운 (이하) hunk index.
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

// TYPE-003 / ARCH-004 fix — expose 타입 SoT.
// 호출자 (StatusPanel / CommitDiffModal / CommitDiffPanel) 가 import 해서 useTemplateRef 에 사용.
export type DiffViewerExpose = {
  nextHunk: () => void
  prevHunk: () => void
  hunkCount: () => number
}

defineExpose<DiffViewerExpose>({ nextHunk, prevHunk, hunkCount })
</script>

<template>
  <div ref="containerRef" class="h-full overflow-hidden" />
</template>
