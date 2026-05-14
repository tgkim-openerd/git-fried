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

// PR-B.1 (plan v0.9 Phase 3) — CodeMirror lang-* 7 dynamic import.
// 기존 7 static import (~200 KB gzip) 가 모두 vendor-cm-langs 청크에 (PR-A.4 commit 47420a5).
// 본 dynamic import 로 file ext 매핑 lazy load — FileViewer 비활성 사용자에게는 청크
// 자체 미로드. 첫 file open 시 해당 lang 만 fetch (vite 가 chunk 분리 처리).
const langLoaders: Record<string, () => Promise<Extension>> = {
  ts: () => import('@codemirror/lang-javascript').then((m) => m.javascript({ typescript: true })),
  tsx: () =>
    import('@codemirror/lang-javascript').then((m) =>
      m.javascript({ typescript: true, jsx: true }),
    ),
  js: () => import('@codemirror/lang-javascript').then((m) => m.javascript({ typescript: false })),
  mjs: () => import('@codemirror/lang-javascript').then((m) => m.javascript({ typescript: false })),
  cjs: () => import('@codemirror/lang-javascript').then((m) => m.javascript({ typescript: false })),
  jsx: () =>
    import('@codemirror/lang-javascript').then((m) =>
      m.javascript({ typescript: false, jsx: true }),
    ),
  vue: () => import('@codemirror/lang-vue').then((m) => m.vue()),
  rs: () => import('@codemirror/lang-rust').then((m) => m.rust()),
  css: () => import('@codemirror/lang-css').then((m) => m.css()),
  scss: () => import('@codemirror/lang-css').then((m) => m.css()),
  sass: () => import('@codemirror/lang-css').then((m) => m.css()),
  html: () => import('@codemirror/lang-html').then((m) => m.html()),
  htm: () => import('@codemirror/lang-html').then((m) => m.html()),
  json: () => import('@codemirror/lang-json').then((m) => m.json()),
  jsonc: () => import('@codemirror/lang-json').then((m) => m.json()),
  md: () => import('@codemirror/lang-markdown').then((m) => m.markdown()),
  markdown: () => import('@codemirror/lang-markdown').then((m) => m.markdown()),
}

const props = defineProps<{
  /** 파일 raw content (UTF-8). */
  content: string
  /** 파일 path — 확장자 기반 language detection. */
  path: string
}>()

const containerRef = ref<HTMLDivElement | null>(null)
let view: EditorView | null = null

async function loadLanguage(path: string): Promise<Extension | null> {
  const lower = path.toLowerCase()
  const dot = lower.lastIndexOf('.')
  const ext = dot >= 0 ? lower.slice(dot + 1) : ''
  const loader = langLoaders[ext]
  if (!loader) return null
  try {
    return await loader()
  } catch {
    return null
  }
}

function buildBaseState(content: string, lang: Extension | null): EditorState {
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

// PR-B.1 — dynamic import 라 EditorView 는 plain text 로 즉시 mount,
// language extension 도착 후 setState 로 syntax highlight 재적용.
async function mountWithLang(content: string, path: string) {
  if (!view) return
  const lang = await loadLanguage(path)
  view.setState(buildBaseState(content, lang))
}

onMounted(() => {
  if (!containerRef.value) return
  // plain text first (lang 없이) — instant render
  view = new EditorView({
    state: buildBaseState(props.content, null),
    parent: containerRef.value,
  })
  void mountWithLang(props.content, props.path)
})

onUnmounted(() => {
  view?.destroy()
  view = null
})

watch(
  () => [props.content, props.path] as const,
  ([content, path]) => {
    if (!view) return
    view.setState(buildBaseState(content, null))
    void mountWithLang(content, path)
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
