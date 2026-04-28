import { describe, expect, it } from 'vitest'

describe('useWorkspaceMutations exports', () => {
  it('WORKSPACE_COLOR_PRESETS 가 9개 색상 (sky/green/amber/violet/rose/emerald/cyan/red/gray)', async () => {
    const { WORKSPACE_COLOR_PRESETS } = await import('./useWorkspaceMutations')
    expect(WORKSPACE_COLOR_PRESETS.length).toBe(9)
    // sky 첫번째 (default)
    expect(WORKSPACE_COLOR_PRESETS[0]).toBe('#0ea5e9')
  })

  it('모든 preset 이 hex 색상 형식 (#xxxxxx)', async () => {
    const { WORKSPACE_COLOR_PRESETS } = await import('./useWorkspaceMutations')
    for (const c of WORKSPACE_COLOR_PRESETS) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('preset 중복 없음', async () => {
    const { WORKSPACE_COLOR_PRESETS } = await import('./useWorkspaceMutations')
    const set = new Set(WORKSPACE_COLOR_PRESETS)
    expect(set.size).toBe(WORKSPACE_COLOR_PRESETS.length)
  })
})
