import { describe, expect, it } from 'vitest'
import { buildBranchTree, filterTree, flattenVisible } from './useBranchTree'

interface MockBranch {
  name: string
}

const mk = (names: string[]): MockBranch[] => names.map((n) => ({ name: n }))

describe('buildBranchTree', () => {
  it('단일 segment leaves — 폴더 생성 없음', () => {
    const tree = buildBranchTree(mk(['main', 'develop']), { getName: (x) => x.name })
    expect(tree.length).toBe(2)
    expect(tree[0].kind).toBe('leaf')
    expect(tree[1].kind).toBe('leaf')
  })

  it('prefix 같은 2+ leaves → folder 생성', () => {
    const tree = buildBranchTree(mk(['chore/v2', 'chore/setup', 'main']), {
      getName: (x) => x.name,
    })
    // main (leaf) + chore (folder, 2 leaves)
    expect(tree.length).toBe(2)
    const chore = tree.find((n) => n.kind === 'folder' && n.name === 'chore')!
    expect(chore.kind).toBe('folder')
    expect(chore.kind === 'folder' && chore.leafCount).toBe(2)
    expect(chore.kind === 'folder' && chore.children.length).toBe(2)
  })

  it('1-leaf folder 자동 격하 (chore/v2 단독 → leaf "chore/v2")', () => {
    const tree = buildBranchTree(mk(['chore/v2', 'main']), { getName: (x) => x.name })
    expect(tree.length).toBe(2)
    const chore = tree.find((n) => n.name === 'chore/v2')
    expect(chore?.kind).toBe('leaf')
  })

  it('깊이 3 단계 — feat/sprint-c30/sub-task', () => {
    const tree = buildBranchTree(
      mk(['feat/sprint-c30/sub-task', 'feat/sprint-c30/sub-task-2', 'main']),
      { getName: (x) => x.name },
    )
    // main (leaf) + feat folder
    const feat = tree.find((n) => n.kind === 'folder')!
    expect(feat.kind === 'folder' && feat.name).toBe('feat')
    // feat 안에 sprint-c30 단일 폴더 — 1-leaf 격하 안 됨 (자식 2개)
    const sprint = feat.kind === 'folder' && feat.children[0]
    expect(sprint && sprint.kind === 'folder' && sprint.name).toBe('sprint-c30')
    expect(sprint && sprint.kind === 'folder' && sprint.children.length).toBe(2)
  })

  it('rootPrefix=origin — REMOTE 트리 origin 으로 wrap', () => {
    const tree = buildBranchTree(mk(['feat/x', 'feat/y', 'main']), {
      getName: (x) => x.name,
      rootPrefix: 'origin',
    })
    expect(tree.length).toBe(1)
    expect(tree[0].kind === 'folder' && tree[0].name).toBe('origin')
    expect(tree[0].kind === 'folder' && tree[0].leafCount).toBe(3)
  })

  it('정렬 — 폴더 우선 (leaf 수 내림차순), leaf 알파벳', () => {
    const tree = buildBranchTree(
      mk(['feat/a', 'feat/b', 'chore/v2', 'chore/setup', 'chore/upgrade', 'main']),
      { getName: (x) => x.name },
    )
    // chore (3) > feat (2) > main (leaf)
    expect(tree[0].kind === 'folder' && tree[0].name).toBe('chore')
    expect(tree[0].kind === 'folder' && tree[0].leafCount).toBe(3)
    expect(tree[1].kind === 'folder' && tree[1].name).toBe('feat')
    expect(tree[2].kind === 'leaf' && tree[2].name).toBe('main')
  })
})

describe('flattenVisible', () => {
  it('폴더 접힌 상태 — 자식 노출 안 함', () => {
    const tree = buildBranchTree(mk(['chore/v2', 'chore/setup', 'main']), {
      getName: (x) => x.name,
    })
    const flat = flattenVisible(tree, () => false) // 모두 접힘
    expect(flat.length).toBe(2) // chore folder + main (leaf)
    expect(flat[0].kind).toBe('folder')
    expect(flat[1].kind).toBe('leaf')
  })

  it('폴더 펼친 상태 — 자식 모두 노출', () => {
    const tree = buildBranchTree(mk(['chore/v2', 'chore/setup', 'main']), {
      getName: (x) => x.name,
    })
    const flat = flattenVisible(tree, () => true)
    expect(flat.length).toBe(4) // chore + v2 + setup + main
  })
})

describe('filterTree', () => {
  it('빈 query → 원본 그대로', () => {
    const tree = buildBranchTree(mk(['chore/v2', 'main']), { getName: (x) => x.name })
    const filtered = filterTree(tree, '', (x) => x.name)
    expect(filtered.length).toBe(tree.length)
  })

  it('leaf 매칭 — 그 leaf 의 폴더 ancestor 도 유지', () => {
    const tree = buildBranchTree(mk(['chore/v2', 'chore/setup', 'feat/api']), {
      getName: (x) => x.name,
    })
    const filtered = filterTree(tree, 'setup', (x) => x.name)
    expect(filtered.length).toBe(1)
    expect(filtered[0].kind === 'folder' && filtered[0].name).toBe('chore')
    expect(filtered[0].kind === 'folder' && filtered[0].children.length).toBe(1)
    expect(
      filtered[0].kind === 'folder' &&
        filtered[0].children[0].kind === 'leaf' &&
        filtered[0].children[0].name,
    ).toBe('setup')
  })

  it('매칭 없으면 빈 결과', () => {
    const tree = buildBranchTree(mk(['main', 'develop']), { getName: (x) => x.name })
    const filtered = filterTree(tree, 'zzz', (x) => x.name)
    expect(filtered.length).toBe(0)
  })
})
