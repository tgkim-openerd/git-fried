import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusSectionHeader from './StatusSectionHeader.vue'

describe('StatusSectionHeader', () => {
  it('title + count + ▼ (펼친 상태) 표시', () => {
    const w = mount(StatusSectionHeader, {
      props: { title: 'Staged', count: 3, collapsed: false },
    })
    expect(w.text()).toContain('▼')
    expect(w.text()).toContain('Staged')
    expect(w.text()).toContain('(3)')
  })

  it('collapsed=true → ▶', () => {
    const w = mount(StatusSectionHeader, {
      props: { title: 'Modified', count: 5, collapsed: true },
    })
    expect(w.text()).toContain('▶')
    expect(w.text()).toContain('Modified')
  })

  it('outer 클릭 → update:collapsed emit (toggle)', async () => {
    const w = mount(StatusSectionHeader, {
      props: { title: 'Staged', count: 3, collapsed: false },
    })
    await w.find('div').trigger('click')
    expect(w.emitted('update:collapsed')).toBeTruthy()
    expect(w.emitted('update:collapsed')![0]).toEqual([true])
  })

  it('우클릭 → update:collapsed emit (preventDefault)', async () => {
    const w = mount(StatusSectionHeader, {
      props: { title: 'Staged', count: 3, collapsed: true },
    })
    await w.find('div').trigger('contextmenu')
    expect(w.emitted('update:collapsed')![0]).toEqual([false])
  })

  it('bulkLabel 있을 때 bulk button 표시 + 클릭 시 bulk emit', async () => {
    const w = mount(StatusSectionHeader, {
      props: {
        title: 'Staged',
        count: 3,
        collapsed: false,
        bulkLabel: '모두 unstage',
        bulkTitle: '모두 unstage (⌘⇧U)',
      },
    })
    const btn = w.find('button')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toBe('모두 unstage')
    expect(btn.attributes('title')).toBe('모두 unstage (⌘⇧U)')

    await btn.trigger('click')
    expect(w.emitted('bulk')).toBeTruthy()
    // click.stop → outer toggle 미발생
    expect(w.emitted('update:collapsed')).toBeFalsy()
  })

  it('bulkLabel 없으면 button 미표시', () => {
    const w = mount(StatusSectionHeader, {
      props: { title: 'Untracked', count: 2, collapsed: false },
    })
    expect(w.find('button').exists()).toBe(false)
  })

  it('destructive=true → text-destructive class', () => {
    const w = mount(StatusSectionHeader, {
      props: { title: 'Conflicted', count: 1, collapsed: false, destructive: true },
    })
    const span = w.find('span')
    expect(span.classes()).toContain('text-destructive')
  })

  it('destructive=false (기본) → text-muted-foreground', () => {
    const w = mount(StatusSectionHeader, {
      props: { title: 'Modified', count: 1, collapsed: false },
    })
    const span = w.find('span')
    expect(span.classes()).toContain('text-muted-foreground')
  })

  it('한글 title 통과', () => {
    const w = mount(StatusSectionHeader, {
      props: { title: '변경사항', count: 7, collapsed: false },
    })
    expect(w.text()).toContain('변경사항')
    expect(w.text()).toContain('(7)')
  })
})
