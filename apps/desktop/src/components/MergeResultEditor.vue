<script setup lang="ts">
// plan #44 E4 — MergeEditorModal 의 result 편집기를 textarea → CodeMirror 로 업그레이드.
//
// 핵심 가치: (1) 줄 번호 (2) **conflict marker 라인 시각 강조**(<<<<<<< /======= /||||||| />>>>>>>
// 가 amber 배경 → 미해소 충돌 즉시 식별) (3) 일반 textarea 보다 나은 편집(긴 줄/이동).
// v-model 양방향 바인딩 (editor→modelValue: updateListener / modelValue→editor: watch + doc diff).
//
// 참고: 2-pane MergeView(ours↔result chunk-accept)는 후속 — 본 v1 은 editable + conflict 강조.

import { onMounted, onUnmounted, ref, watch } from 'vue'
import { EditorState, RangeSetBuilder } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  highlightActiveLine,
  lineNumbers,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import { oneDark } from '@codemirror/theme-one-dark'

const props = defineProps<{
  modelValue: string
  // (예약) path — 추후 언어별 syntax highlight 용. 현재 미사용.
  path?: string | null
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const containerRef = ref<HTMLDivElement | null>(null)
let view: EditorView | null = null

// conflict marker 라인 판정 (라인 시작 7자 마커, diff3 base 마커 포함).
const CONFLICT_RE = /^(<{7}|\|{7}|={7}|>{7})/
const conflictLineDeco = Decoration.line({ class: 'cm-conflict-line' })

function buildConflictDecos(v: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  for (const { from, to } of v.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = v.state.doc.lineAt(pos)
      if (CONFLICT_RE.test(line.text)) {
        builder.add(line.from, line.from, conflictLineDeco)
      }
      pos = line.to + 1
    }
  }
  return builder.finish()
}

const conflictHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(v: EditorView) {
      this.decorations = buildConflictDecos(v)
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) this.decorations = buildConflictDecos(u.view)
    }
  },
  { decorations: (plugin) => plugin.decorations },
)

function buildState(doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      oneDark,
      EditorView.lineWrapping,
      conflictHighlighter,
      EditorView.updateListener.of((u) => {
        if (u.docChanged) emit('update:modelValue', u.state.doc.toString())
      }),
    ],
  })
}

onMounted(() => {
  if (!containerRef.value) return
  view = new EditorView({ state: buildState(props.modelValue), parent: containerRef.value })
})

onUnmounted(() => {
  view?.destroy()
  view = null
})

// 외부에서 modelValue 변경 (ours/theirs/base 복사, AI 추천) 시 editor doc 갱신.
// editor 가 emit 한 값은 이미 doc 과 동일하므로 diff 비교로 loop 방지.
watch(
  () => props.modelValue,
  (v) => {
    if (!view) return
    const current = view.state.doc.toString()
    if (v !== current) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: v } })
    }
  },
)
</script>

<template>
  <div ref="containerRef" data-testid="merge-result-editor" class="h-full overflow-auto text-2xs" />
</template>

<style scoped>
:deep(.cm-editor) {
  height: 100%;
  font-size: 12px;
}
:deep(.cm-scroller) {
  font-family: 'SFMono-Regular', 'D2Coding', 'Consolas', 'Liberation Mono', 'Menlo', monospace;
}
/* E4 — conflict marker 라인 강조 (미해소 충돌 즉시 식별). */
:deep(.cm-conflict-line) {
  background: hsl(var(--warning-amber) / 0.18);
}
</style>
