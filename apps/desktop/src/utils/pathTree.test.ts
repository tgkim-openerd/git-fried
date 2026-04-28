import { describe, expect, it } from 'vitest'
import { buildPathTree, collectDirPaths } from './pathTree'

describe('pathTree.buildPathTree', () => {
  it('빈 배열은 빈 트리', () => {
    expect(buildPathTree([])).toEqual([])
  })

  it('단일 root 파일은 leaf 1개', () => {
    const tree = buildPathTree([{ path: 'README.md', meta: { s: 'mod' } }])
    expect(tree).toHaveLength(1)
    expect(tree[0]).toMatchObject({ kind: 'file', name: 'README.md', depth: 0 })
  })

  it('단일 디렉토리 체인은 collapse (기본 동작)', () => {
    const tree = buildPathTree([
      { path: 'apps/desktop/src/api/git.ts', meta: 1 },
    ])
    expect(tree).toHaveLength(1)
    expect(tree[0]).toMatchObject({
      kind: 'dir',
      name: 'apps/desktop/src/api',
      depth: 0,
    })
    const dir = tree[0]
    if (dir.kind !== 'dir') throw new Error('expected dir')
    expect(dir.children).toHaveLength(1)
    expect(dir.children[0]).toMatchObject({ kind: 'file', name: 'git.ts', depth: 1 })
  })

  it('collapse=false 시 각 segment 별 디렉토리 노드', () => {
    const tree = buildPathTree(
      [{ path: 'a/b/c.ts', meta: 1 }],
      { collapseSingleChild: false },
    )
    expect(tree).toHaveLength(1)
    const a = tree[0]
    if (a.kind !== 'dir') throw new Error()
    expect(a.name).toBe('a')
    const b = a.children[0]
    if (b.kind !== 'dir') throw new Error()
    expect(b.name).toBe('b')
  })

  it('형제 디렉토리는 collapse 멈춤', () => {
    const tree = buildPathTree([
      { path: 'apps/desktop/foo.ts', meta: 1 },
      { path: 'apps/server/bar.ts', meta: 2 },
    ])
    // apps/ 아래 desktop, server 두 형제 → apps 만 단독 collapse 안 됨.
    expect(tree).toHaveLength(1)
    const apps = tree[0]
    if (apps.kind !== 'dir') throw new Error()
    expect(apps.name).toBe('apps')
    expect(apps.children).toHaveLength(2)
  })

  it('디렉토리 우선 알파벳 정렬', () => {
    const tree = buildPathTree([
      { path: 'z.ts', meta: 1 },
      { path: 'src/a.ts', meta: 2 },
      { path: 'a.ts', meta: 3 },
    ])
    expect(tree.map((n) => n.name)).toEqual(['src', 'a.ts', 'z.ts'])
  })

  it('동일 디렉토리에 파일 + 하위 디렉토리 혼합', () => {
    const tree = buildPathTree([
      { path: 'apps/foo.ts', meta: 1 },
      { path: 'apps/lib/bar.ts', meta: 2 },
    ])
    const apps = tree[0]
    if (apps.kind !== 'dir') throw new Error()
    expect(apps.name).toBe('apps')
    expect(apps.children.map((n) => n.name)).toEqual(['lib', 'foo.ts'])
  })

  it('meta 보존', () => {
    const tree = buildPathTree([
      { path: 'a.ts', meta: { status: 'modified' } },
    ])
    const leaf = tree[0]
    if (leaf.kind !== 'file') throw new Error()
    expect(leaf.meta).toEqual({ status: 'modified' })
  })
})

describe('pathTree.collectDirPaths', () => {
  it('모든 디렉토리 path 평탄 수집', () => {
    const tree = buildPathTree(
      [
        { path: 'a/b.ts', meta: 1 },
        { path: 'a/c/d.ts', meta: 2 },
        { path: 'x.ts', meta: 3 },
      ],
      { collapseSingleChild: false },
    )
    const dirs = collectDirPaths(tree)
    // a, a/c
    expect(dirs).toContain('a')
    expect(dirs).toContain('a/c')
    expect(dirs).not.toContain('x.ts')
  })
})
