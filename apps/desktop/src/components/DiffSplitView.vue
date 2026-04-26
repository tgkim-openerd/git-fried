<script setup lang="ts">
// Diff Split (side-by-side) view — Sprint E3 + F3 (다중 파일 picker).
//
// CodeMirror 6 의 @codemirror/merge MergeView 사용. patch 의 모든 파일 파싱 →
// 좌측 file picker 로 전환.
//
// 한계 (parseDiffAllFiles 참조):
//   - hunk 사이 unchanged 영역은 모름 → MergeView 가 hunk 만 비교 가능.
//   - 정확한 split 은 backend 가 두 blob 직접 fetch 해야 (별 endpoint).
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef,
  watch,
} from 'vue'
import { MergeView } from '@codemirror/merge'
import { EditorView, lineNumbers } from '@codemirror/view'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { parseDiffAllFiles, type DiffFile } from '@/utils/parseDiff'

const props = defineProps<{ patch: string }>()

const containerRef = useTemplateRef<HTMLDivElement>('container')
const files = ref<DiffFile[]>([])
const activeIdx = ref(0)
let mergeView: MergeView | null = null

const baseTheme = EditorView.baseTheme({
  '&': { fontSize: '12px', height: '100%' },
  '.cm-content': { fontFamily: 'JetBrains Mono, D2Coding, Consolas, monospace' },
  '.cm-mergeView': { height: '100%' },
})

const activeFile = computed<DiffFile | null>(
  () => files.value[activeIdx.value] ?? null,
)

function destroy() {
  if (mergeView) {
    mergeView.destroy()
    mergeView = null
  }
}

function build() {
  destroy()
  if (!containerRef.value) return
  const f = activeFile.value
  if (!f) return

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
    a: { doc: f.before, extensions },
    b: { doc: f.after, extensions },
    revertControls: undefined,
    highlightChanges: true,
    gutter: true,
  })
}

function refreshFromPatch() {
  files.value = parseDiffAllFiles(props.patch || '')
  // 파일 list 가 줄어들 때 idx 보정.
  if (activeIdx.value >= files.value.length) activeIdx.value = 0
  build()
}

watch(() => props.patch, refreshFromPatch, { immediate: false })
watch(activeIdx, () => build())

onMounted(() => refreshFromPatch())
onBeforeUnmount(() => destroy())
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 다중 파일 picker (Sprint F3). 1 파일이면 단순 라벨. -->
    <div
      v-if="files.length > 1"
      class="flex items-center gap-1 overflow-x-auto border-b border-border bg-muted/30 px-2 py-1"
    >
      <span class="shrink-0 font-mono text-[10px] text-muted-foreground">
        {{ files.length }} 파일
      </span>
      <button
        v-for="(f, idx) in files"
        :key="`${idx}:${f.fileName}`"
        type="button"
        class="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] hover:bg-accent/40"
        :class="
          idx === activeIdx
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground'
        "
        :title="f.fileName"
        @click="activeIdx = idx"
      >
        {{ f.fileName.split('/').pop() }}
      </button>
    </div>
    <div
      v-else-if="activeFile"
      class="border-b border-border bg-muted/30 px-3 py-1 font-mono text-[11px] text-muted-foreground"
    >
      {{ activeFile.fileName }}
    </div>
    <div ref="container" class="min-h-0 flex-1 overflow-auto" />
    <div v-if="!activeFile" class="p-6 text-center text-sm text-muted-foreground">
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
