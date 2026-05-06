// Sprint c37 — useStatusSelection 단위 테스트.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { RepoStatus, FileChange } from '@/types/git'

// useShortcut mock — 등록된 handler capture.
const registered = new Map<string, () => void>()
vi.mock('@/composables/useShortcuts', () => ({
  useShortcut: (action: string, handler: () => void) => {
    registered.set(action, handler)
  },
}))

// useToast mock — 호출만 capture, 실제 UI 부수효과 없음.
const toastCalls: Array<{ kind: string; title: string; msg: string }> = []
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    success: (title: string, msg: string) => toastCalls.push({ kind: 'success', title, msg }),
    error: (title: string, msg: string) => toastCalls.push({ kind: 'error', title, msg }),
    warning: (title: string, msg: string) => toastCalls.push({ kind: 'warning', title, msg }),
    info: (title: string, msg: string) => toastCalls.push({ kind: 'info', title, msg }),
  }),
}))

import { useStatusSelection } from './useStatusSelection'

function fc(path: string, status: FileChange['status'] = 'modified'): FileChange {
  return { path, oldPath: null, status }
}

function makeStatus(
  opts: {
    staged?: FileChange[]
    unstaged?: FileChange[]
    untracked?: string[]
    conflicted?: string[]
  } = {},
): RepoStatus {
  return {
    branch: 'main',
    upstream: null,
    ahead: 0,
    behind: 0,
    staged: opts.staged ?? [],
    unstaged: opts.unstaged ?? [],
    untracked: opts.untracked ?? [],
    conflicted: opts.conflicted ?? [],
    isClean: false,
  }
}

function makeMutMock() {
  return {
    mutate: vi.fn(),
    isPending: { value: false },
  } as unknown as Parameters<typeof useStatusSelection>[0]['stageMut']
}

beforeEach(() => {
  registered.clear()
  toastCalls.length = 0
})

describe('useStatusSelection — selectPath 토글', () => {
  it('초기 selectedPath = null', () => {
    const sel = useStatusSelection({
      repoId: () => 1,
      status: ref(undefined),
      stageMut: makeMutMock(),
      unstageMut: makeMutMock(),
      stageAllMut: makeMutMock() as never,
      openHistory: vi.fn(),
    })
    expect(sel.selectedPath.value).toBeNull()
  })

  it('selectPath(path) → 설정', () => {
    const sel = useStatusSelection({
      repoId: () => 1,
      status: ref(undefined),
      stageMut: makeMutMock(),
      unstageMut: makeMutMock(),
      stageAllMut: makeMutMock() as never,
      openHistory: vi.fn(),
    })
    sel.selectPath('a.ts')
    expect(sel.selectedPath.value).toBe('a.ts')
  })

  it('selectPath(같은 path) → 토글 → null', () => {
    const sel = useStatusSelection({
      repoId: () => 1,
      status: ref(undefined),
      stageMut: makeMutMock(),
      unstageMut: makeMutMock(),
      stageAllMut: makeMutMock() as never,
      openHistory: vi.fn(),
    })
    sel.selectPath('a.ts')
    sel.selectPath('a.ts')
    expect(sel.selectedPath.value).toBeNull()
  })

  it('selectPath(다른 path) → 교체', () => {
    const sel = useStatusSelection({
      repoId: () => 1,
      status: ref(undefined),
      stageMut: makeMutMock(),
      unstageMut: makeMutMock(),
      stageAllMut: makeMutMock() as never,
      openHistory: vi.fn(),
    })
    sel.selectPath('a.ts')
    sel.selectPath('b.ts')
    expect(sel.selectedPath.value).toBe('b.ts')
  })
})

describe('useStatusSelection — copyPath', () => {
  it('clipboard 성공 → toast.success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const sel = useStatusSelection({
      repoId: () => 1,
      status: ref(undefined),
      stageMut: makeMutMock(),
      unstageMut: makeMutMock(),
      stageAllMut: makeMutMock() as never,
      openHistory: vi.fn(),
    })
    await sel.copyPath('foo/bar.ts')
    expect(writeText).toHaveBeenCalledWith('foo/bar.ts')
    // c43 i18n 마이그 — t('statusSelection.pathCopied') / 'Path copied' (en) 반환.
    expect(toastCalls.length).toBe(1)
    expect(toastCalls[0].kind).toBe('success')
    expect(toastCalls[0].msg).toBe('foo/bar.ts')
    vi.unstubAllGlobals()
  })

  it('clipboard 실패 → toast.error', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const sel = useStatusSelection({
      repoId: () => 1,
      status: ref(undefined),
      stageMut: makeMutMock(),
      unstageMut: makeMutMock(),
      stageAllMut: makeMutMock() as never,
      openHistory: vi.fn(),
    })
    await sel.copyPath('x')
    expect(toastCalls.length).toBe(1)
    expect(toastCalls[0].kind).toBe('error')
    // c43 i18n 마이그 — title 은 t('errors.copyFailed') 결과 (locale 의존).
    expect(toastCalls[0].title.length).toBeGreaterThan(0)
    vi.unstubAllGlobals()
  })
})

describe('useStatusSelection — vim shortcut 등록', () => {
  it('5개 단축키 모두 등록', () => {
    useStatusSelection({
      repoId: () => 1,
      status: ref(undefined),
      stageMut: makeMutMock(),
      unstageMut: makeMutMock(),
      stageAllMut: makeMutMock() as never,
      openHistory: vi.fn(),
    })
    expect(registered.has('stageCurrent')).toBe(true)
    expect(registered.has('unstageCurrent')).toBe(true)
    expect(registered.has('stageAllExplicit')).toBe(true)
    expect(registered.has('unstageAll')).toBe(true)
    expect(registered.has('fileHistorySearch')).toBe(true)
  })
})

describe('useStatusSelection — stageCurrent (vim S)', () => {
  it('repoId null → no-op', () => {
    const stageMut = makeMutMock()
    useStatusSelection({
      repoId: () => null,
      status: ref(makeStatus({ unstaged: [fc('a.ts')] })),
      stageMut,
      unstageMut: makeMutMock(),
      stageAllMut: makeMutMock() as never,
      openHistory: vi.fn(),
    })
    registered.get('stageCurrent')!()
    expect(stageMut.mutate).not.toHaveBeenCalled()
  })

  it('selectedPath 없음 → unstaged[0] 우선', () => {
    const stageMut = makeMutMock()
    useStatusSelection({
      repoId: () => 1,
      status: ref(makeStatus({ unstaged: [fc('first.ts')], untracked: ['new.ts'] })),
      stageMut,
      unstageMut: makeMutMock(),
      stageAllMut: makeMutMock() as never,
      openHistory: vi.fn(),
    })
    registered.get('stageCurrent')!()
    expect(stageMut.mutate).toHaveBeenCalledWith({ id: 1, paths: ['first.ts'] })
  })

  it('unstaged 비었으면 untracked[0]', () => {
    const stageMut = makeMutMock()
    useStatusSelection({
      repoId: () => 1,
      status: ref(makeStatus({ untracked: ['fresh.ts'] })),
      stageMut,
      unstageMut: makeMutMock(),
      stageAllMut: makeMutMock() as never,
      openHistory: vi.fn(),
    })
    registered.get('stageCurrent')!()
    expect(stageMut.mutate).toHaveBeenCalledWith({ id: 1, paths: ['fresh.ts'] })
  })

  it('selectedPath 있고 staged 아님 → 그대로', () => {
    const stageMut = makeMutMock()
    const sel = useStatusSelection({
      repoId: () => 1,
      status: ref(makeStatus({ unstaged: [fc('x.ts')] })),
      stageMut,
      unstageMut: makeMutMock(),
      stageAllMut: makeMutMock() as never,
      openHistory: vi.fn(),
    })
    sel.selectPath('x.ts')
    registered.get('stageCurrent')!()
    expect(stageMut.mutate).toHaveBeenCalledWith({ id: 1, paths: ['x.ts'] })
  })
})

describe('useStatusSelection — stageAllExplicit / unstageAll', () => {
  it('stageAllExplicit → stageAllMut.mutate(repoId)', () => {
    const stageAllMut = makeMutMock()
    useStatusSelection({
      repoId: () => 42,
      status: ref(makeStatus()),
      stageMut: makeMutMock(),
      unstageMut: makeMutMock(),
      stageAllMut: stageAllMut as never,
      openHistory: vi.fn(),
    })
    registered.get('stageAllExplicit')!()
    expect(stageAllMut.mutate).toHaveBeenCalledWith(42)
  })

  it('unstageAll — staged 비었으면 no-op', () => {
    const unstageMut = makeMutMock()
    useStatusSelection({
      repoId: () => 1,
      status: ref(makeStatus()),
      stageMut: makeMutMock(),
      unstageMut,
      stageAllMut: makeMutMock() as never,
      openHistory: vi.fn(),
    })
    registered.get('unstageAll')!()
    expect(unstageMut.mutate).not.toHaveBeenCalled()
  })

  it('unstageAll — staged 모두 paths 로 호출', () => {
    const unstageMut = makeMutMock()
    useStatusSelection({
      repoId: () => 1,
      status: ref(makeStatus({ staged: [fc('a.ts'), fc('b.ts')] })),
      stageMut: makeMutMock(),
      unstageMut,
      stageAllMut: makeMutMock() as never,
      openHistory: vi.fn(),
    })
    registered.get('unstageAll')!()
    expect(unstageMut.mutate).toHaveBeenCalledWith({ id: 1, paths: ['a.ts', 'b.ts'] })
  })
})

describe('useStatusSelection — fileHistorySearch (⌘⇧H)', () => {
  it('selectedPath 우선', () => {
    const openHistory = vi.fn()
    const sel = useStatusSelection({
      repoId: () => 1,
      status: ref(makeStatus({ unstaged: [fc('first.ts')] })),
      stageMut: makeMutMock(),
      unstageMut: makeMutMock(),
      stageAllMut: makeMutMock() as never,
      openHistory,
    })
    sel.selectPath('chosen.ts')
    registered.get('fileHistorySearch')!()
    expect(openHistory).toHaveBeenCalledWith('chosen.ts')
  })

  it('selectedPath 없음 + unstaged[0]', () => {
    const openHistory = vi.fn()
    useStatusSelection({
      repoId: () => 1,
      status: ref(makeStatus({ unstaged: [fc('first.ts')] })),
      stageMut: makeMutMock(),
      unstageMut: makeMutMock(),
      stageAllMut: makeMutMock() as never,
      openHistory,
    })
    registered.get('fileHistorySearch')!()
    expect(openHistory).toHaveBeenCalledWith('first.ts')
  })

  it('아무것도 없으면 호출 안 함', () => {
    const openHistory = vi.fn()
    useStatusSelection({
      repoId: () => 1,
      status: ref(makeStatus()),
      stageMut: makeMutMock(),
      unstageMut: makeMutMock(),
      stageAllMut: makeMutMock() as never,
      openHistory,
    })
    registered.get('fileHistorySearch')!()
    expect(openHistory).not.toHaveBeenCalled()
  })
})
