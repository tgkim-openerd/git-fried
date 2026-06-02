<script setup lang="ts">
// Sprint c30 / GitKraken UX (Phase 7c) — File View syntax highlighting.
//
// FullscreenDiffView 의 viewMode='file' 일 때 raw <pre> 대신 CodeMirror 로 표시.
// 파일 확장자 → language 매핑 (이미 import 되어 있는 lang-* 재사용).
//
// 미지원 확장자는 plain text + 라인 넘버만.
//
// E2 (plan #44) — gutter blame: blame prop 전달 시 좌측 gutter 에 라인별 blame
// (shortSha + author) 을 GitLens 스타일(연속 동일 commit 은 첫 줄만)로 표시.

import { onMounted, onUnmounted, ref, watch } from 'vue'
import { EditorState, type Extension } from '@codemirror/state'
import {
  EditorView,
  lineNumbers,
  highlightActiveLine,
  gutter,
  GutterMarker,
} from '@codemirror/view'
import { syntaxHighlighting, defaultHighlightStyle, foldGutter } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import type { BlameLine } from '@/api/git'

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
  /** E2 — 라인별 blame (finalLine 1-based). 전달 시 좌측 blame gutter 표시. */
  blame?: BlameLine[] | null
}>()

const containerRef = ref<HTMLDivElement | null>(null)
let view: EditorView | null = null

// E2 — blame gutter marker. 연속 동일 commit(continuation)은 빈 칸 → 첫 줄만 정보 표기.
class BlameMarker extends GutterMarker {
  constructor(
    readonly bl: BlameLine,
    readonly continuation: boolean,
  ) {
    super()
  }
  eq(other: GutterMarker): boolean {
    return (
      other instanceof BlameMarker &&
      other.bl.sha === this.bl.sha &&
      other.continuation === this.continuation
    )
  }
  toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = 'cm-blame-marker'
    if (this.continuation) {
      el.textContent = ''
    } else {
      el.textContent = `${this.bl.shortSha} ${this.bl.authorName}`
      const when = new Date(this.bl.authorAt * 1000).toLocaleDateString()
      el.title = `${this.bl.shortSha} · ${this.bl.authorName} · ${when}\n${this.bl.summary}`
    }
    return el
  }
}

function blameGutter(lines: BlameLine[]): Extension {
  const byLine = new Map<number, BlameLine>()
  for (const l of lines) byLine.set(l.finalLine, l)
  return gutter({
    class: 'cm-blame-gutter',
    lineMarker(v, block) {
      const lineNo = v.state.doc.lineAt(block.from).number
      const bl = byLine.get(lineNo)
      if (!bl) return null
      const prev = byLine.get(lineNo - 1)
      return new BlameMarker(bl, prev?.sha === bl.sha)
    },
  })
}

function buildBaseState(
  content: string,
  lang: Extension | null,
  blame: BlameLine[] | null,
): EditorState {
  const extensions: Extension[] = [
    // E2 — blame gutter 는 line number 보다 좌측 (최좌단).
    ...(blame && blame.length ? [blameGutter(blame)] : []),
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
  view.setState(buildBaseState(content, lang, props.blame ?? null))
}

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

onMounted(() => {
  if (!containerRef.value) return
  // plain text first (lang 없이) — instant render
  view = new EditorView({
    state: buildBaseState(props.content, null, props.blame ?? null),
    parent: containerRef.value,
  })
  void mountWithLang(props.content, props.path)
})

onUnmounted(() => {
  view?.destroy()
  view = null
})

// content / path / blame 변경 시 재빌드 (blame toggle / refetch 포함).
watch(
  () => [props.content, props.path, props.blame] as const,
  ([content, path]) => {
    if (!view) return
    view.setState(buildBaseState(content, null, props.blame ?? null))
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
  font-family: 'SFMono-Regular', 'D2Coding', 'Consolas', 'Liberation Mono', 'Menlo', monospace;
}
/* E2 — blame gutter: 고정폭 + ellipsis 로 스크롤 시 width 안정. */
:deep(.cm-blame-gutter) {
  min-width: 14ch;
  max-width: 22ch;
  background: hsl(var(--muted) / 0.3);
  border-right: 1px solid hsl(var(--border));
}
:deep(.cm-blame-marker) {
  display: block;
  overflow: hidden;
  padding: 0 6px;
  color: hsl(var(--muted-foreground));
  font-size: 10px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
