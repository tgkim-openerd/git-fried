// Sprint c46 DX-1 — EmptyState 컴포넌트 unit test.
// props 분기 (icon / title / description / size) + slot 노출 검증.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import EmptyState from './EmptyState.vue'

describe('EmptyState', () => {
  it('title 만 있으면 title 표시', () => {
    const w = mount(EmptyState, { props: { title: 'No data' } })
    expect(w.text()).toContain('No data')
    expect(w.attributes('role')).toBe('status')
  })

  it('icon + description 함께 렌더', () => {
    const w = mount(EmptyState, {
      props: { icon: '📭', title: 'PR 없음', description: '현재 브랜치 PR 없습니다' },
    })
    expect(w.text()).toContain('📭')
    expect(w.text()).toContain('PR 없음')
    expect(w.text()).toContain('현재 브랜치 PR 없습니다')
    // icon span 은 aria-hidden 필수 (screen reader 중복 읽기 방지)
    const iconSpan = w.findAll('div').find((d) => d.text() === '📭')
    expect(iconSpan?.attributes('aria-hidden')).toBe('true')
  })

  it('size sm → 작은 padding/gap class', () => {
    const w = mount(EmptyState, { props: { title: 'X', size: 'sm' } })
    expect(w.attributes('class')).toContain('p-4')
    expect(w.attributes('class')).toContain('gap-1')
  })

  it('size md (기본) → 큰 padding/gap', () => {
    const w = mount(EmptyState, { props: { title: 'X' } })
    expect(w.attributes('class')).toContain('p-8')
    expect(w.attributes('class')).toContain('gap-2')
  })

  it('action slot 제공 시 액션 영역 렌더', () => {
    const w = mount(EmptyState, {
      props: { title: 'Empty' },
      slots: { action: () => h('button', { class: 'test-btn' }, 'Add') },
    })
    expect(w.find('.test-btn').exists()).toBe(true)
    expect(w.text()).toContain('Add')
  })

  it('description 미지정 시 description 영역 미렌더', () => {
    const w = mount(EmptyState, { props: { title: 'X' } })
    const ps = w.findAll('p')
    // title p 만 (description p 부재)
    expect(ps).toHaveLength(1)
  })
})
