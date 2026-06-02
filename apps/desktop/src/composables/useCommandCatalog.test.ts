// Sprint c31 — useCommandCatalog 단위 테스트.
// CommandPalette god comp 분리 후 catalog 의 shape 안정성 회귀 차단.
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { CATEGORY_LABELS, CATEGORY_ORDER, useCommandCatalog, type Cmd } from './useCommandCatalog'

// Tauri devMock 회피 — 본 테스트는 invoke 호출 안 함.
vi.mock('@/api/git', () => ({}))

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

function mountInCtx(setup: () => unknown) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { render: () => null } }],
  })
  const queryClient = new QueryClient()
  const Comp = defineComponent({
    setup,
    render: () => h('div'),
  })
  return mount(Comp, {
    global: {
      plugins: [router, [VueQueryPlugin, { queryClient }]],
    },
  })
}

describe('useCommandCatalog — shape', () => {
  it('allCommands 가 비어있지 않은 list 반환', () => {
    let captured: Cmd[] = []
    mountInCtx(() => {
      const { allCommands } = useCommandCatalog()
      captured = allCommands.value
    })
    expect(captured.length).toBeGreaterThanOrEqual(40)
  })

  it('모든 cmd 가 id / category / label / action 필수 필드 보유', () => {
    let captured: Cmd[] = []
    mountInCtx(() => {
      const { allCommands } = useCommandCatalog()
      captured = allCommands.value
    })
    for (const c of captured) {
      expect(typeof c.id).toBe('string')
      expect(c.id.length).toBeGreaterThan(0)
      expect(typeof c.category).toBe('string')
      expect(typeof c.label).toBe('string')
      expect(typeof c.action).toBe('function')
    }
  })

  it('cmd id 가 catalog 내에서 unique', () => {
    let captured: Cmd[] = []
    mountInCtx(() => {
      const { allCommands } = useCommandCatalog()
      captured = allCommands.value
    })
    const ids = captured.map((c) => c.id)
    const set = new Set(ids)
    expect(set.size).toBe(ids.length)
  })

  it('모든 category 가 CATEGORY_ORDER 안에 정의됨', () => {
    let captured: Cmd[] = []
    mountInCtx(() => {
      const { allCommands } = useCommandCatalog()
      captured = allCommands.value
    })
    for (const c of captured) {
      expect(CATEGORY_ORDER).toContain(c.category)
    }
  })

  it('CATEGORY_LABELS 가 9개 카테고리 모두 한국어 라벨 보유', () => {
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(CATEGORY_ORDER.length)
    for (const cat of CATEGORY_ORDER) {
      expect(CATEGORY_LABELS[cat]).toBeTruthy()
    }
  })

  it('CATEGORY_ORDER 9 카테고리 (repo/branch/file/view/stash/history/ai/settings/integration)', () => {
    expect(CATEGORY_ORDER).toEqual([
      'repo',
      'branch',
      'file',
      'view',
      'stash',
      'history',
      'ai',
      'settings',
      'integration',
    ])
  })
})

describe('useCommandCatalog — 카테고리별 명령 카운트 (회귀 차단)', () => {
  // 각 카테고리 명령 수가 알려진 값에서 벗어나면 회귀 가능성 — 의도적 추가시 본 테스트도 갱신.
  const expectedCounts: Record<string, number> = {
    repo: 19,
    branch: 8,
    file: 5,
    view: 15,
    stash: 1,
    history: 5,
    ai: 1,
    settings: 4,
    integration: 3,
  }

  it.each(Object.entries(expectedCounts))('%s 카테고리에 %i 명령', (cat, expected) => {
    let captured: Cmd[] = []
    mountInCtx(() => {
      const { allCommands } = useCommandCatalog()
      captured = allCommands.value
    })
    const count = captured.filter((c) => c.category === cat).length
    expect(count).toBe(expected)
  })
})

describe('useCommandCatalog — 동적 label (toggle 상태 반영)', () => {
  it('Auto-Fetch 명령 label 에 현재 주기 표시', () => {
    let captured: Cmd[] = []
    mountInCtx(() => {
      const { allCommands } = useCommandCatalog()
      captured = allCommands.value
    })
    const cmd = captured.find((c) => c.id === 'repo.auto-fetch')
    expect(cmd).toBeDefined()
    expect(cmd!.label).toMatch(/Auto-Fetch 주기 순환 \(현재: /)
  })

  it('Date locale cycle 명령 label 에 현재 locale 표시', () => {
    let captured: Cmd[] = []
    mountInCtx(() => {
      const { allCommands } = useCommandCatalog()
      captured = allCommands.value
    })
    const cmd = captured.find((c) => c.id === 'view.date-locale')
    expect(cmd).toBeDefined()
    expect(cmd!.label).toMatch(/날짜 형식 순환/)
  })
})
