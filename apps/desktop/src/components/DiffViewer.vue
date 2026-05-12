<script setup lang="ts">
// CodeMirror 6 기반 통합 diff 뷰어.
//
// 입력: git diff 의 plain text (unified format).
// 출력: + / - 라인 색상 + 헤더 강조 + 한글 안전 표시.
//
// v0.2 의 3-way merge editor 는 별도 컴포넌트 (`MergeEditor.vue`).
// Sprint c80-5 — diff decorations + Hunk navigation 분리 (utils/diffDecorations + useDiffHunkNav).
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { EditorState } from '@codemirror/state'
import { EditorView, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { diffDecorationsPlugin, diffBaseTheme } from '@/utils/diffDecorations'
import { useDiffHunkNav } from '@/composables/useDiffHunkNav'

const props = defineProps<{ patch: string }>()
const containerRef = ref<HTMLDivElement | null>(null)
let view: EditorView | null = null

function buildState(doc: string) {
  return EditorState.create({
    doc,
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      oneDark,
      diffBaseTheme,
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

// c25-4 — Hunk navigation API. 부모 (StatusPanel/CommitDiffModal/CommitDiffPanel) 가
// useTemplateRef 통해 expose 결과 호출.
// c80-5 — useDiffHunkNav 분리, view 는 getter 로 주입.
const { nextHunk, prevHunk, hunkCount } = useDiffHunkNav(() => view)

// TYPE-003 / ARCH-004 fix — expose 타입 SoT.
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
