<script setup lang="ts" generic="T">
// Phase 12-1 — 트리 뷰 (folder ▾ / leaf).
// MiniBranchList / MiniRemoteBranchList / MiniTagList 공용.
//
// Props:
//   - nodes: BranchTreeNode<T>[] (filtered + sorted)
//   - storageKey: localStorage key (펼침 상태 영속)
//   - autoExpand: 모든 폴더 강제 펼침 (검색 모드 시 true)
//
// Slots:
//   - leaf (default): { node, data, index } — 한 행 렌더 (사용처가 brand-specific UI).
//     index 는 leaf 순서 (drag-drop hover 식별용, folder 는 카운트 제외).

import { computed } from 'vue'
import {
  flattenVisible,
  useBranchTreeExpand,
  type BranchTreeNode,
  type BranchTreeFolder,
  type BranchTreeLeaf,
} from '@/composables/useBranchTree'

const props = defineProps<{
  nodes: readonly BranchTreeNode<T>[]
  storageKey: string
  autoExpand?: boolean
}>()

const expand = useBranchTreeExpand(props.storageKey, true)

function isExpanded(path: string): boolean {
  if (props.autoExpand) return true
  return expand.isExpanded(path)
}

const visible = computed(() => flattenVisible(props.nodes, isExpanded))

// visible 안에서 leaf 만 골라 path → leaf-index 매핑 (drag-drop hover ring 식별용).
const leafIndexMap = computed<Map<string, number>>(() => {
  const m = new Map<string, number>()
  let i = 0
  for (const n of visible.value) {
    if (n.kind === 'leaf') m.set(n.fullName, i++)
  }
  return m
})

function indent(node: BranchTreeNode<T>): string {
  // depth 기반 padding-left (12px 단위).
  return `${node.depth * 10}px`
}

function isFolder(n: BranchTreeNode<T>): n is BranchTreeFolder<T> {
  return n.kind === 'folder'
}
function isLeaf(n: BranchTreeNode<T>): n is BranchTreeLeaf<T> {
  return n.kind === 'leaf'
}

function onToggle(n: BranchTreeFolder<T>) {
  if (props.autoExpand) return
  expand.toggle(n.path)
}
</script>

<template>
  <ul class="space-y-0">
    <li
      v-for="n in visible"
      :key="`${n.kind}:${isFolder(n) ? n.path : n.fullName}`"
      class="text-[11px]"
    >
      <button
        v-if="isFolder(n)"
        type="button"
        class="flex w-full items-center gap-1 rounded px-1 py-0.5 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
        :style="{ paddingLeft: indent(n) }"
        :title="`${n.path} (${n.leafCount})`"
        :aria-expanded="isExpanded(n.path)"
        @click="onToggle(n)"
      >
        <span class="w-3 shrink-0 text-center text-[9px]">
          {{ isExpanded(n.path) ? '▼' : '▶' }}
        </span>
        <span class="flex-1 truncate">{{ n.name }}</span>
        <span class="rounded bg-muted px-1 text-[9px]">{{ n.leafCount }}</span>
      </button>
      <div v-else-if="isLeaf(n)" class="rounded" :style="{ paddingLeft: indent(n) }">
        <slot :node="n" :data="n.data" :index="leafIndexMap.get(n.fullName) ?? -1" />
      </div>
    </li>
  </ul>
</template>
