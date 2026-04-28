// Path/Tree 그룹핑 유틸 (Sprint c25-2.1 — `docs/plan/25 §3-2`).
//
// GitKraken Image #1 의 `Path | Tree` 토글에서 Tree 모드 변환 로직.
// 목적: 50+ 레포 / 모노레포 환경에서 변경 파일 디렉토리 구조 시각화.

export interface TreeFileLeaf<T> {
  kind: 'file'
  /** Full path (트리 어느 깊이든 원본 path 보존). */
  path: string
  /** Leaf segment (UI 라벨용). */
  name: string
  /** 파일 메타 (status, oldPath 등 — 호출자가 정의). */
  meta: T
  /** 트리 깊이 (0=root). UI indentation 계산용. */
  depth: number
}

export interface TreeDirNode<T> {
  kind: 'dir'
  /** 누적된 디렉토리 경로 (e.g., `apps/desktop/src`). */
  path: string
  /** 화면 표시용 segment — collapse 활성 시 prefix 합쳐짐 (e.g., `apps/desktop/src`). */
  name: string
  depth: number
  /** 하위 노드 (정렬: 디렉토리 우선, 그 안에서 알파벳). */
  children: TreeNode<T>[]
}

export type TreeNode<T> = TreeFileLeaf<T> | TreeDirNode<T>

interface RawDir<T> {
  segments: string[]
  children: Map<string, RawDir<T>>
  files: Array<{ name: string; path: string; meta: T }>
}

function emptyDir<T>(segments: string[]): RawDir<T> {
  return { segments, children: new Map(), files: [] }
}

/**
 * 평탄한 path 배열을 디렉토리 트리로 변환.
 *
 * @param items 변환 대상 (path + meta 페어).
 * @param options.collapseSingleChild 단일 자식만 가진 디렉토리 체인을 한 노드로 합칠지 (e.g., `apps/desktop/src/api/git.ts` 의 부모 체인 `apps → desktop → src → api`). 기본 true.
 */
export function buildPathTree<T>(
  items: Array<{ path: string; meta: T }>,
  options: { collapseSingleChild?: boolean } = {},
): TreeNode<T>[] {
  const collapse = options.collapseSingleChild ?? true
  const root = emptyDir<T>([])

  for (const item of items) {
    const parts = item.path.split('/').filter((s) => s.length > 0)
    if (parts.length === 0) continue
    const fileName = parts[parts.length - 1]
    const dirParts = parts.slice(0, -1)

    let cursor = root
    for (const seg of dirParts) {
      let next = cursor.children.get(seg)
      if (!next) {
        next = emptyDir<T>([...cursor.segments, seg])
        cursor.children.set(seg, next)
      }
      cursor = next
    }
    cursor.files.push({ name: fileName, path: item.path, meta: item.meta })
  }

  return materialize(root, 0, collapse)
}

function materialize<T>(
  raw: RawDir<T>,
  depth: number,
  collapse: boolean,
): TreeNode<T>[] {
  // 디렉토리 자식 — 정렬 (알파벳).
  const dirEntries = Array.from(raw.children.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  )
  const fileEntries = [...raw.files].sort((a, b) => a.name.localeCompare(b.name))

  const out: TreeNode<T>[] = []

  for (const [segName, child] of dirEntries) {
    if (collapse) {
      // 단일 자식 디렉토리 체인 압축 — `apps/desktop/src/api` 처럼.
      let cur = child
      let displayName = segName
      let displayPath = cur.segments.join('/')
      while (
        cur.children.size === 1 &&
        cur.files.length === 0
      ) {
        const onlyEntry = cur.children.entries().next().value
        if (!onlyEntry) break
        const [nextName, nextChild] = onlyEntry
        displayName += '/' + nextName
        displayPath = nextChild.segments.join('/')
        cur = nextChild
      }
      out.push({
        kind: 'dir',
        path: displayPath,
        name: displayName,
        depth,
        children: materialize(cur, depth + 1, collapse),
      })
    } else {
      out.push({
        kind: 'dir',
        path: child.segments.join('/'),
        name: segName,
        depth,
        children: materialize(child, depth + 1, collapse),
      })
    }
  }

  for (const file of fileEntries) {
    out.push({
      kind: 'file',
      path: file.path,
      name: file.name,
      meta: file.meta,
      depth,
    })
  }

  return out
}

/** Tree 안의 모든 디렉토리 path 를 평탄 수집 (collapse 상태 토글에 사용). */
export function collectDirPaths<T>(nodes: TreeNode<T>[]): string[] {
  const out: string[] = []
  for (const n of nodes) {
    if (n.kind === 'dir') {
      out.push(n.path)
      out.push(...collectDirPaths(n.children))
    }
  }
  return out
}
