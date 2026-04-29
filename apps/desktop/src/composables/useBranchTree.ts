// Phase 12-1 — 브랜치 이름 prefix `/` 기반 트리 빌드 (GitKraken parity).
//
// 입력: `['main', 'chore/v2', 'chore/setup', 'feat/api-data-revival', 'feat/new-features']`
// 출력 (펼침 상태):
//   main
//   chore (folder, 2)
//     ├─ v2
//     └─ setup
//   feat (folder, 2)
//     ├─ api-data-revival
//     └─ new-features
//
// 단일 leaf 가 있는 폴더 (예: chore/x 1개) 는 폴더 미생성 — 그대로 leaf 'chore/x' 표시.
// 깊이 N 단계 모두 지원 (예: feat/sprint-c30/sub-task → feat > sprint-c30 > sub-task).
//
// 사용처:
//   - MiniBranchList (LOCAL) — 로컬 브랜치 hierarchical
//   - MiniRemoteBranchList (REMOTE) — 원격 브랜치 hierarchical (origin/feat/x → origin > feat > x)
//   - MiniTagList — 동일 적용 가능

import type { ComputedRef } from 'vue'
import { computed, ref, type Ref } from 'vue'

export interface BranchTreeFolder<T = unknown> {
  kind: 'folder'
  /** 표시명 (마지막 segment) */
  name: string
  /** 전체 경로 (root → 자기자신, '/' 결합). 예: 'feat/sprint-c30' */
  path: string
  /** 펼침 깊이 (root = 0) */
  depth: number
  /** 자식 (folder 또는 leaf) */
  children: BranchTreeNode<T>[]
  /** 후손 leaf 총 수 */
  leafCount: number
}

export interface BranchTreeLeaf<T> {
  kind: 'leaf'
  /** 표시명 (마지막 segment) */
  name: string
  /** 원본 데이터 (BranchInfo, TagInfo 등) */
  data: T
  /** 전체 브랜치명 (그대로) */
  fullName: string
  /** 펼침 깊이 */
  depth: number
}

export type BranchTreeNode<T = unknown> = BranchTreeFolder<T> | BranchTreeLeaf<T>

interface BuildOpts<T> {
  /** 각 항목에서 브랜치명 추출 (slash 분리 대상). */
  getName: (item: T) => string
  /** REMOTE 처럼 prefix 1단계 (origin/) 를 root 로 강제 분리. 미지정 시 일반 처리. */
  rootPrefix?: string | null
}

/** 깊이 우선 정렬 — 폴더 먼저 (자식 많은 순), leaf 알파벳. */
function sortNodes<T>(nodes: BranchTreeNode<T>[]): BranchTreeNode<T>[] {
  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
    if (a.kind === 'folder' && b.kind === 'folder') {
      // 폴더는 leaf 수 내림차순, 동률이면 이름 알파벳.
      if (a.leafCount !== b.leafCount) return b.leafCount - a.leafCount
    }
    return a.name.localeCompare(b.name)
  })
  for (const n of nodes) {
    if (n.kind === 'folder') sortNodes(n.children)
  }
  return nodes
}

/**
 * branches 배열을 prefix tree 로 변환. 폴더 1-leaf 단축은 호출자 측 옵션.
 */
export function buildBranchTree<T>(items: readonly T[], opts: BuildOpts<T>): BranchTreeNode<T>[] {
  const root: BranchTreeFolder<T> = {
    kind: 'folder',
    name: '',
    path: '',
    depth: -1,
    children: [],
    leafCount: 0,
  }

  function ensureFolder(parent: BranchTreeFolder<T>, name: string): BranchTreeFolder<T> {
    for (const c of parent.children) {
      if (c.kind === 'folder' && c.name === name) return c
    }
    const folder: BranchTreeFolder<T> = {
      kind: 'folder',
      name,
      path: parent.path ? `${parent.path}/${name}` : name,
      depth: parent.depth + 1,
      children: [],
      leafCount: 0,
    }
    parent.children.push(folder)
    return folder
  }

  for (const item of items) {
    const fullName = opts.getName(item)
    if (!fullName) continue
    const segments = fullName.split('/')
    let node = root
    for (let i = 0; i < segments.length - 1; i++) {
      node = ensureFolder(node, segments[i])
    }
    const leaf: BranchTreeLeaf<T> = {
      kind: 'leaf',
      name: segments[segments.length - 1],
      data: item,
      fullName,
      depth: node.depth + 1,
    }
    node.children.push(leaf)
  }

  // leafCount 집계 (post-order).
  function countLeaves(folder: BranchTreeFolder<T>): number {
    let n = 0
    for (const c of folder.children) {
      if (c.kind === 'leaf') n += 1
      else n += countLeaves(c)
    }
    folder.leafCount = n
    return n
  }
  countLeaves(root)

  // 1-leaf 폴더는 leaf 로 격하 (예: chore/v2 가 chore 폴더 안에 v2 1개만 → 'chore/v2' leaf).
  function flattenSoloFolders(parent: BranchTreeFolder<T>) {
    const next: BranchTreeNode<T>[] = []
    for (const c of parent.children) {
      if (c.kind === 'folder') {
        flattenSoloFolders(c)
        if (c.children.length === 1 && c.children[0].kind === 'leaf') {
          // 단일 leaf 폴더 → leaf 격상 (이름은 fullName 그대로).
          const leaf = c.children[0]
          next.push({
            kind: 'leaf',
            name: leaf.fullName, // 'chore/v2' 등 전체 표기 (중복 방지).
            data: leaf.data,
            fullName: leaf.fullName,
            depth: c.depth, // 폴더 자리 차지.
          })
          continue
        }
      }
      next.push(c)
    }
    parent.children = next
  }
  flattenSoloFolders(root)

  // rootPrefix 옵션 (REMOTE='origin') — 'origin/...' 으로 강제 wrap.
  if (opts.rootPrefix) {
    const wrap: BranchTreeFolder<T> = {
      kind: 'folder',
      name: opts.rootPrefix,
      path: opts.rootPrefix,
      depth: 0,
      children: root.children.map((c) => {
        if (c.kind === 'folder') c.depth += 1
        else c.depth += 1
        return c
      }),
      leafCount: root.leafCount,
    }
    return sortNodes([wrap])
  }

  return sortNodes(root.children)
}

/**
 * 트리 펼침/접힘 상태 관리.
 * localStorage 영속 — 같은 trees 재방문 시 사용자 상태 복원.
 */
export function useBranchTreeExpand(storageKey: string, defaultExpanded = true) {
  const expanded = ref<Set<string>>(load())

  function load(): Set<string> {
    if (typeof localStorage === 'undefined') return new Set()
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return new Set()
      const arr = JSON.parse(raw) as string[]
      return new Set(arr)
    } catch {
      return new Set()
    }
  }
  function persist() {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(expanded.value)))
    } catch {
      /* ignore */
    }
  }

  function isExpanded(path: string): boolean {
    if (expanded.value.has(path)) return true
    if (expanded.value.has(`!${path}`)) return false
    return defaultExpanded
  }
  function toggle(path: string) {
    const cur = isExpanded(path)
    expanded.value.delete(path)
    expanded.value.delete(`!${path}`)
    expanded.value.add(cur ? `!${path}` : path)
    // ref 변경 트리거.
    expanded.value = new Set(expanded.value)
    persist()
  }

  return { expanded, isExpanded, toggle }
}

/**
 * 트리를 평탄화 (가시 노드만 — 접힌 폴더의 자식은 제외).
 * MiniSection ul li 렌더링용.
 */
export function flattenVisible<T>(
  nodes: readonly BranchTreeNode<T>[],
  isExpanded: (path: string) => boolean,
): BranchTreeNode<T>[] {
  const out: BranchTreeNode<T>[] = []
  function visit(n: BranchTreeNode<T>) {
    out.push(n)
    if (n.kind === 'folder' && isExpanded(n.path)) {
      for (const c of n.children) visit(c)
    }
  }
  for (const n of nodes) visit(n)
  return out
}

/**
 * 검색어로 leaf filter — match 된 leaf 의 모든 ancestor folder 자동 expand.
 * 빈 query 면 원본 트리.
 */
export function filterTree<T>(
  nodes: readonly BranchTreeNode<T>[],
  query: string,
  getName: (item: T) => string,
): BranchTreeNode<T>[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...nodes]
  function visit(n: BranchTreeNode<T>): BranchTreeNode<T> | null {
    if (n.kind === 'leaf') {
      return n.fullName.toLowerCase().includes(q) || getName(n.data).toLowerCase().includes(q)
        ? n
        : null
    }
    const kept: BranchTreeNode<T>[] = []
    for (const c of n.children) {
      const v = visit(c)
      if (v) kept.push(v)
    }
    if (kept.length === 0) return null
    const newLeafCount = kept.reduce<number>((s, c) => s + (c.kind === 'leaf' ? 1 : c.leafCount), 0)
    const next: BranchTreeFolder<T> = {
      kind: 'folder',
      name: n.name,
      path: n.path,
      depth: n.depth,
      children: kept,
      leafCount: newLeafCount,
    }
    return next
  }
  const out: BranchTreeNode<T>[] = []
  for (const n of nodes) {
    const v = visit(n)
    if (v) out.push(v)
  }
  return out
}

/** 사용자 query 가 있으면 모든 폴더 강제 expand (검색 결과 표시). */
export function buildExpandResolver(
  baseExpand: (path: string) => boolean,
  query: ComputedRef<string> | Ref<string>,
): (path: string) => boolean {
  return (path: string) => {
    if (computed(() => query.value.trim() !== '').value) return true
    return baseExpand(path)
  }
}
