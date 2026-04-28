import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flattenTree, useStatusTreeView } from './useStatusTreeView'
import type { TreeNode } from '@/utils/pathTree'

describe('useStatusTreeView', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear()
  })
  afterEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear()
  })

  it('default viewMode is path', () => {
    const { viewMode } = useStatusTreeView()
    expect(viewMode.value).toBe('path')
  })

  it('setViewMode persists to localStorage', () => {
    const { setViewMode, viewMode } = useStatusTreeView()
    setViewMode('tree')
    expect(viewMode.value).toBe('tree')
    expect(localStorage.getItem('git-fried.status.viewMode')).toBe('tree')
  })

  it('loadViewMode picks tree from localStorage', () => {
    localStorage.setItem('git-fried.status.viewMode', 'tree')
    const { viewMode } = useStatusTreeView()
    expect(viewMode.value).toBe('tree')
  })

  it('invalid stored value falls back to path', () => {
    localStorage.setItem('git-fried.status.viewMode', 'banana')
    const { viewMode } = useStatusTreeView()
    expect(viewMode.value).toBe('path')
  })

  it('collapsedDirs initial empty', () => {
    const { collapsedDirs } = useStatusTreeView()
    expect(collapsedDirs.value.size).toBe(0)
  })

  it('toggleDir adds + removes (idempotent toggle)', () => {
    const { collapsedDirs, toggleDir } = useStatusTreeView()
    toggleDir('src/api')
    expect(collapsedDirs.value.has('src/api')).toBe(true)
    toggleDir('src/api')
    expect(collapsedDirs.value.has('src/api')).toBe(false)
  })

  it('toggleDir multiple paths', () => {
    const { collapsedDirs, toggleDir } = useStatusTreeView()
    toggleDir('src/a')
    toggleDir('src/b')
    expect(collapsedDirs.value.size).toBe(2)
  })

  it('toggleDir creates new Set ref (reactive trigger)', () => {
    const { collapsedDirs, toggleDir } = useStatusTreeView()
    const before = collapsedDirs.value
    toggleDir('src/x')
    expect(collapsedDirs.value).not.toBe(before)
  })
})

describe('flattenTree', () => {
  function dir(
    path: string,
    name: string,
    depth: number,
    children: TreeNode<string>[],
  ): TreeNode<string> {
    return { kind: 'dir', path, name, depth, children }
  }
  function file(path: string, name: string, depth: number, meta: string): TreeNode<string> {
    return { kind: 'file', path, name, depth, meta }
  }

  it('빈 nodes → 빈 결과', () => {
    expect(flattenTree([], new Set())).toEqual([])
  })

  it('flat file 만 있는 경우', () => {
    const tree: TreeNode<string>[] = [file('a.ts', 'a.ts', 0, 'meta-a')]
    const result = flattenTree(tree, new Set())
    expect(result.length).toBe(1)
    expect(result[0].kind).toBe('file')
  })

  it('dir + 자식 file 노드 모두 펼침', () => {
    const tree: TreeNode<string>[] = [dir('src', 'src', 0, [file('src/a.ts', 'a.ts', 1, 'a')])]
    const result = flattenTree(tree, new Set())
    expect(result.length).toBe(2)
    expect(result[0].kind).toBe('dir')
    expect(result[1].kind).toBe('file')
  })

  it('collapsed dir 의 자식은 결과에서 제외', () => {
    const tree: TreeNode<string>[] = [dir('src', 'src', 0, [file('src/a.ts', 'a.ts', 1, 'a')])]
    const result = flattenTree(tree, new Set(['src']))
    expect(result.length).toBe(1)
    expect(result[0].kind).toBe('dir')
    if (result[0].kind === 'dir') expect(result[0].collapsed).toBe(true)
  })

  it('중첩 dir — 부모 collapsed 면 손자도 제외', () => {
    const tree: TreeNode<string>[] = [
      dir('a', 'a', 0, [dir('a/b', 'b', 1, [file('a/b/c.ts', 'c.ts', 2, 'c')])]),
    ]
    const expanded = flattenTree(tree, new Set())
    expect(expanded.length).toBe(3) // a/, a/b/, a/b/c.ts
    const collapsedAtRoot = flattenTree(tree, new Set(['a']))
    expect(collapsedAtRoot.length).toBe(1)
    const collapsedAtChild = flattenTree(tree, new Set(['a/b']))
    expect(collapsedAtChild.length).toBe(2) // a/, a/b/ (자식 제외)
  })
})
