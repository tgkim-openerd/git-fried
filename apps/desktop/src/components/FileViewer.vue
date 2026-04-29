<script setup lang="ts">
// Sprint c30 / GitKraken UX (Phase 7c) — File View syntax highlighting.
//
// FullscreenDiffView 의 viewMode='file' 일 때 raw <pre> 대신 CodeMirror 로 표시.
// 파일 확장자 → language 매핑 (이미 import 되어 있는 lang-* 재사용).
//
// 미지원 확장자는 plain text + 라인 넘버만.

import { onMounted, onUnmounted, ref, watch } from 'vue'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { syntaxHighlighting, defaultHighlightStyle, foldGutter } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { javascript } from '@codemirror/lang-javascript'
import { vue } from '@codemirror/lang-vue'
import { rust } from '@codemirror/lang-rust'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'

const props = defineProps<{
  /** 파일 raw content (UTF-8). */
  content: string
  /** 파일 path — 확장자 기반 language detection. */
  path: string
}>()

const containerRef = ref<HTMLDivElement | null>(null)
let view: EditorView | null = null

function languageExtension(path: string): Extension | null {
  const lower = path.toLowerCase()
  // 확장자 추출 (마지막 . 뒤).
  const dot = lower.lastIndexOf('.')
  const ext = dot >= 0 ? lower.slice(dot + 1) : ''
  switch (ext) {
    case 'ts':
    case 'tsx':
      return javascript({ typescript: true, jsx: ext === 'tsx' })
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return javascript({ typescript: false, jsx: ext === 'jsx' })
    case 'vue':
      return vue()
    case 'rs':
      return rust()
    case 'css':
    case 'scss':
    case 'sass':
      return css()
    case 'html':
    case 'htm':
      return html()
    case 'json':
    case 'jsonc':
      return json()
    case 'md':
    case 'markdown':
      return markdown()
    default:
      return null
  }
}

function buildState(content: string, path: string): EditorState {
  const lang = languageExtension(path)
  const extensions: Extension[] = [
    lineNumbers(),
    foldGutter(),
    highlightActiveLine(),
    syntaxHighlighting(defaultHighlightStyle),
    oneDark,
    EditorView.lineWrapping,
    EditorState.readOnly.of(true),
    EditorView.editable.of(false),
  ]
  if (lang) extensions.push(lang)
  return EditorState.create({
    doc: content,
    extensions,
  })
}

onMounted(() => {
  if (!containerRef.value) return
  view = new EditorView({
    state: buildState(props.content, props.path),
    parent: containerRef.value,
  })
})

onUnmounted(() => {
  view?.destroy()
  view = null
})

watch(
  () => [props.content, props.path] as const,
  ([content, path]) => {
    if (!view) return
    view.setState(buildState(content, path))
  },
)
</script>

<template>
  <div
    ref="containerRef"
    data-testid="file-viewer"
    class="h-full overflow-auto font-mono text-xs"
  />
</template>

<style scoped>
:deep(.cm-editor) {
  height: 100%;
  font-size: 12px;
}
:deep(.cm-scroller) {
  font-family: 'SFMono-Regular', 'Consolas', 'Liberation Mono', 'Menlo', monospace;
}
</style>
