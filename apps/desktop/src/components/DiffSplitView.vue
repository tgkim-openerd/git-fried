<script setup lang="ts">
// Diff Split (side-by-side) view — Sprint E3.
//
// CodeMirror 6 의 @codemirror/merge MergeView 사용. patch 의 첫 file 만 v1.
// 다중 파일은 v1.x — 별도 file picker.
//
// 한계 (parseDiffFirstFile 참조):
//   - hunk 사이 unchanged 영역은 모름 → MergeView 가 hunk 만 비교 가능.
//   - 정확한 split 은 backend 가 두 blob 직접 fetch 해야 (별 endpoint).
import { onBeforeUnmount, ref, watch, useTemplateRef } from 'vue'
import { MergeView } from '@codemirror/merge'
import { EditorState } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { parseDiffFirstFile } from '@/utils/parseDiff'

const props = defineProps<{ patch: string }>()

const containerRef = useTemplateRef<HTMLDivElement>('container')
const fileName = ref<string>('')
let mergeView: MergeView | null = null

const baseTheme = EditorView.baseTheme({
  '&': { fontSize: '12px', height: '100%' },
  '.cm-content': { fontFamily: 'JetBrains Mono, D2Coding, Consolas, monospace' },
  '.cm-mergeView': { height: '100%' },
})

function destroy() {
  if (mergeView) {
    mergeView.destroy()
    mergeView = null
  }
}

function build() {
  destroy()
  if (!containerRef.value) return
  const parsed = parseDiffFirstFile(props.patch || '')
  if (!parsed) {
    fileName.value = ''
    return
  }
  fileName.value = parsed.fileName

  const extensions = [
    lineNumbers(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    oneDark,
    baseTheme,
    EditorView.editable.of(false),
    EditorView.lineWrapping,
  ]

  mergeView = new MergeView({
    parent: containerRef.value,
    a: {
      doc: parsed.before,
      extensions,
    },
    b: {
      doc: parsed.after,
      extensions,
    },
    revertControls: undefined,
    highlightChanges: true,
    gutter: true,
  })
}

watch(
  () => props.patch,
  () => build(),
  { immediate: false },
)

// container ref 가 mount 후에만 build (mounted 상태 보장).
import { onMounted } from 'vue'
onMounted(() => build())
onBeforeUnmount(() => destroy())
</script>

<template>
  <div class="flex h-full flex-col">
    <div
      v-if="fileName"
      class="border-b border-border bg-muted/30 px-3 py-1 font-mono text-[11px] text-muted-foreground"
    >
      {{ fileName }} <span class="ml-2 text-[10px]">(첫 파일만 — v1)</span>
    </div>
    <div ref="container" class="min-h-0 flex-1 overflow-auto" />
    <div
      v-if="!fileName"
      class="p-6 text-center text-sm text-muted-foreground"
    >
      Split 모드로 표시할 변경 없음.
    </div>
  </div>
</template>

<style>
/* MergeView 의 양쪽 split 가 부모 100% 채우도록. */
.cm-mergeView {
  height: 100%;
}
.cm-mergeView .cm-mergeViewEditor {
  height: 100%;
}
</style>
