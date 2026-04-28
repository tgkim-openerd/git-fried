// StatusPanel 의 Path / Tree 토글 (Sprint c25-2.1 — `docs/plan/25 §3-2`).
//
// GitKraken Image #1 의 우측 패널 헤더 `Path | Tree` 흡수.
// viewMode (path | tree) + collapsedDirs (Set<string>) + flattenTree generic helper.
//
// ARCH-005 (의도적 일관성) — 4 섹션 (Staged / Modified / Untracked / Conflicted) 이 동일한
// `apps/desktop/src/api` 디렉토리 노드를 가질 수 있다. 한쪽에서 접으면 양쪽 모두 접히는 동작이 의도.
// 사용자가 "이 디렉토리 전체 숨김" 모델로 인지하기 쉽게 통일.
//
// StatusPanel.vue 의 1059 LOC God component 분리 2차 (useStatusFilter 후속).

import { ref, type Ref } from 'vue'
import type { TreeNode } from '@/utils/pathTree'

export type ViewMode = 'path' | 'tree'

const VIEW_MODE_KEY = 'git-fried.status.viewMode'

function loadViewMode(): ViewMode {
  if (typeof localStorage === 'undefined') return 'path'
  const v = localStorage.getItem(VIEW_MODE_KEY)
  return v === 'tree' ? 'tree' : 'path'
}

function persistViewMode(m: ViewMode): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(VIEW_MODE_KEY, m)
  } catch {
    /* ignore quota / private mode */
  }
}

// Sprint c25-2.1 / c27-2 (TYPE-005 fix) — generic 트리 평탄화.
// row 의 meta 는 호출자 generic <T> — FileChange (Modified/Staged) 또는 string (Untracked/Conflicted).
// path / name 은 두 mode 모두 노출 (file row 의 SoT).
export type FlatTreeRow<T> =
  | { kind: 'dir'; path: string; name: string; depth: number; collapsed: boolean }
  | { kind: 'file'; path: string; name: string; depth: number; meta: T }

export function flattenTree<T>(
  nodes: readonly TreeNode<T>[],
  collapsed: ReadonlySet<string>,
  out: FlatTreeRow<T>[] = [],
): FlatTreeRow<T>[] {
  for (const n of nodes) {
    if (n.kind === 'dir') {
      const isCollapsed = collapsed.has(n.path)
      out.push({
        kind: 'dir',
        path: n.path,
        name: n.name,
        depth: n.depth,
        collapsed: isCollapsed,
      })
      if (!isCollapsed) flattenTree(n.children, collapsed, out)
    } else {
      out.push({ kind: 'file', path: n.path, name: n.name, depth: n.depth, meta: n.meta })
    }
  }
  return out
}

export interface UseStatusTreeViewReturn {
  viewMode: Ref<ViewMode>
  setViewMode: (m: ViewMode) => void
  collapsedDirs: Ref<Set<string>>
  toggleDir: (path: string) => void
}

export function useStatusTreeView(): UseStatusTreeViewReturn {
  const viewMode = ref<ViewMode>(loadViewMode())
  const collapsedDirs = ref<Set<string>>(new Set())

  function setViewMode(m: ViewMode): void {
    viewMode.value = m
    persistViewMode(m)
  }

  function toggleDir(path: string): void {
    const next = new Set(collapsedDirs.value)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    collapsedDirs.value = next
  }

  return { viewMode, setViewMode, collapsedDirs, toggleDir }
}
