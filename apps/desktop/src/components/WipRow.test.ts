import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WipRow from './WipRow.vue'

describe('WipRow', () => {
  it('// WIP 텍스트 + change count 표시', () => {
    const w = mount(WipRow, {
      props: { changeCount: 6, branch: 'develop', selected: false },
    })
    expect(w.text()).toContain('// WIP')
    expect(w.text()).toContain('6')
    expect(w.text()).toContain('develop')
  })

  it('changeCount=0 → badge 미표시', () => {
    const w = mount(WipRow, {
      props: { changeCount: 0, branch: 'main', selected: false },
    })
    expect(w.text()).toContain('// WIP')
    // count badge (amber-500/15 클래스) 가 없어야
    expect(w.findAll('.bg-amber-500\\/15')).toHaveLength(0)
  })

  it('branch=null → ● 라벨 미표시', () => {
    const w = mount(WipRow, {
      props: { changeCount: 3, branch: null, selected: false },
    })
    expect(w.text()).toContain('// WIP')
    // ● 표시 (text 안에 ● 가 있으면 fail)
    expect(w.text()).not.toContain('●')
  })

  it('click → select emit', async () => {
    const w = mount(WipRow, {
      props: { changeCount: 1, branch: 'develop', selected: false },
    })
    await w.trigger('click')
    expect(w.emitted('select')).toBeTruthy()
  })

  it('Enter 키 → select emit', async () => {
    const w = mount(WipRow, {
      props: { changeCount: 1, branch: 'develop', selected: false },
    })
    await w.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('select')).toBeTruthy()
  })

  it('selected=true → ring/bg-accent 클래스 추가', () => {
    const w = mount(WipRow, {
      props: { changeCount: 1, branch: 'develop', selected: true },
    })
    expect(w.classes()).toContain('bg-accent')
    expect(w.classes()).toContain('ring-1')
  })

  it('selected=false → hover only', () => {
    const w = mount(WipRow, {
      props: { changeCount: 1, branch: 'develop', selected: false },
    })
    expect(w.classes()).not.toContain('bg-accent')
    expect(w.classes()).toContain('hover:bg-accent/30')
  })

  it('aria-label 한글 + change count + branch', () => {
    const w = mount(WipRow, {
      props: { changeCount: 5, branch: 'develop', selected: false },
    })
    const label = w.attributes('aria-label')
    expect(label).toContain('5')
    expect(label).toContain('develop')
    expect(label).toContain('staging')
  })

  it('data-testid="wip-row"', () => {
    const w = mount(WipRow, {
      props: { changeCount: 1, branch: 'develop', selected: false },
    })
    expect(w.attributes('data-testid')).toBe('wip-row')
  })
})
