<script setup lang="ts">
// Sprint c54+++ Issue 2 — GitKraken parity Split (side-by-side) Diff Viewer.
//
// CodeMirror 6 `@codemirror/merge` MergeView 기반 좌우 2 column diff.
//   - 좌측 (a): base (이전 내용 — HEAD / index / parent commit)
//   - 우측 (b): current (현재 내용 — index / working dir / commit)
//   - changed chunks 자동 align + highlight + collapseUnchanged (3 line margin)
//   - editable: false (read-only)
//
// 기존 DiffViewer (unified) 는 단일 EditorView + plain text 데코레이션. 본 컴포넌트는 별도
// MergeView 인스턴스 — 부모 (FullscreenDiffView) 가 viewMode='split' 시 분기 mount.
//
// 입력: base / current 두 string (useFullscreenDiffSplitQuery 결과).
// 출력: 좌우 split DOM. revertControls 없음 (read-only viewer 컨텍스트).
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { MergeView } from '@codemirror/merge'
import { EditorView, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'

const props = defineProps<{ base: string; current: string }>()

const containerRef = ref<HTMLDivElement | null>(null)
let mergeView: MergeView | null = null

// Sprint c54+++ Issue 2 fix — MergeView default layout 이 a/b column 균등 분배 안함.
// flex layout + 50/50 width + height 100% 명시. changed line tinting 도 함께.
const baseTheme = EditorView.baseTheme({
  '&': { fontSize: '12px', height: '100%' },
  '.cm-content': { fontFamily: 'JetBrains Mono, D2Coding, Consolas, monospace' },
  // Root layout — flex row + 100% height.
  '.cm-mergeView': {
    height: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  '.cm-mergeViewEditors': {
    display: 'flex',
    flexDirection: 'row',
    flex: '1 1 auto',
    height: '100%',
    width: '100%',
    minHeight: 0,
  },
  // 좌(a) / 우(b) 동일 너비 — flex: 1 1 50%.
  '.cm-mergeViewEditor': {
    flex: '1 1 50%',
    width: '50%',
    minWidth: 0,
    height: '100%',
    overflow: 'auto',
  },
  '.cm-mergeViewEditor .cm-editor': { height: '100%' },
  // changed line tinting — diff add/del color (DiffViewer 와 동일 팔레트)
  '.cm-changedLine': { backgroundColor: 'rgba(244, 63, 94, 0.18)' },
  '.cm-deletedChunk': { backgroundColor: 'rgba(244, 63, 94, 0.10)' },
  '.cm-insertedLine': { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
})

function buildExtensions() {
  return [
    lineNumbers(),
    highlightActiveLine(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    oneDark,
    baseTheme,
    EditorView.editable.of(false),
    EditorView.lineWrapping,
  ]
}

function mountMergeView() {
  if (!containerRef.value) return
  mergeView?.destroy()
  // Sprint c54+++ Issue 2 fix — base='' (untracked / new file) 시 collapseUnchanged 활성 시
  // a editor 가 0 라인이라 chunk 계산 왜곡 + layout 깨짐 → 동적 disable.
  const isNewFile = props.base === ''
  mergeView = new MergeView({
    parent: containerRef.value,
    a: { doc: props.base, extensions: buildExtensions() },
    b: { doc: props.current, extensions: buildExtensions() },
    collapseUnchanged: isNewFile ? undefined : { margin: 3, minSize: 4 },
    highlightChanges: true,
    gutter: true,
  })
}

onMounted(() => {
  mountMergeView()
})

// base/current 변경 시 — MergeView 재mount (dispatch 로 두 doc 일괄 변경하면
// 가끔 chunk 계산이 stale, 깔끔한 방법은 destroy+recreate).
watch(
  () => [props.base, props.current],
  () => {
    mountMergeView()
  },
)

onUnmounted(() => {
  mergeView?.destroy()
  mergeView = null
})
</script>

<template>
  <!-- Sprint c54+++ Issue 2 fix — height/width 100% + flex column 으로 부모 영역 가득.
       overflow:hidden (overflow:auto 는 inner editor 의 자체 scroll 과 중복). -->
  <div
    ref="containerRef"
    class="flex h-full w-full flex-col overflow-hidden"
    data-testid="diff-viewer-merge"
  />
</template>
