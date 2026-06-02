<script setup lang="ts">
// CodeMirror 6 기반 통합 diff 뷰어.
//
// 입력: git diff 의 plain text (unified format).
// 출력: + / - 라인 색상 + 헤더 강조 + 한글 안전 표시.
//
// v0.2 의 3-way merge editor 는 별도 컴포넌트 (`MergeEditor.vue`).
// Sprint c80-5 — diff decorations + Hunk navigation 분리 (utils/diffDecorations + useDiffHunkNav).
//
// plan #44 E3 — `commentable` prop 시 좌측 comment gutter("+") 추가. 클릭 시 해당 라인의
// RIGHT(new-file) line 번호를 `comment-line` 으로 emit (PR diff line-comment 진입). 기본 off →
// 기존 usage(StatusPanel/CommitDiff 등) 불변.
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  lineNumbers,
  highlightActiveLine,
  gutter,
  GutterMarker,
} from '@codemirror/view'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { diffDecorationsPlugin, diffBaseTheme } from '@/utils/diffDecorations'
import { useDiffHunkNav } from '@/composables/useDiffHunkNav'
import { buildNewLineMap } from '@/utils/diffLineMap'

const props = defineProps<{ patch: string; commentable?: boolean }>()
const emit = defineEmits<{ 'comment-line': [line: number] }>()
const containerRef = ref<HTMLDivElement | null>(null)
let view: EditorView | null = null

// E3 — docLine(1-based) → new-file line. patch 변경 시 갱신, gutter 가 closure 로 읽음.
let lineMap = new Map<number, number>()

class CommentPlusMarker extends GutterMarker {
  toDOM(): HTMLElement {
    const s = document.createElement('span')
    s.className = 'cm-comment-plus'
    s.textContent = '+'
    s.title = '이 라인에 PR 코멘트'
    return s
  }
}
const commentMarker = new CommentPlusMarker()

function commentGutter() {
  return gutter({
    class: 'cm-comment-gutter',
    lineMarker(v, block) {
      const docLine = v.state.doc.lineAt(block.from).number
      return lineMap.has(docLine) ? commentMarker : null
    },
    domEventHandlers: {
      mousedown(v, block) {
        const docLine = v.state.doc.lineAt(block.from).number
        const nl = lineMap.get(docLine)
        if (nl != null) {
          emit('comment-line', nl)
          return true
        }
        return false
      },
    },
  })
}

function buildState(doc: string) {
  const extensions = [
    // E3 — comment gutter 는 최좌단 (line number 보다 왼쪽).
    ...(props.commentable ? [commentGutter()] : []),
    lineNumbers(),
    highlightActiveLine(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    oneDark,
    diffBaseTheme,
    diffDecorationsPlugin,
    EditorView.editable.of(false),
    EditorView.lineWrapping,
  ]
  return EditorState.create({ doc, extensions })
}

onMounted(() => {
  if (!containerRef.value) return
  lineMap = buildNewLineMap(props.patch || '')
  view = new EditorView({
    state: buildState(props.patch || ''),
    parent: containerRef.value,
  })
})

watch(
  () => props.patch,
  (next) => {
    if (!view) return
    lineMap = buildNewLineMap(next || '')
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

<style scoped>
/* E3 — comment gutter "+" (PR diff line-comment 진입). 평소 흐리게, gutter hover 시 강조. */
:deep(.cm-comment-gutter) {
  width: 1.4em;
  cursor: pointer;
}
:deep(.cm-comment-plus) {
  display: block;
  text-align: center;
  color: hsl(var(--muted-foreground));
  opacity: 0.3;
  font-weight: 700;
}
:deep(.cm-comment-gutter:hover .cm-comment-plus) {
  opacity: 0.95;
  color: hsl(var(--primary));
}
</style>
