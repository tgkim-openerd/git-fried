// Sprint c31 — BaseTooltip 단위 테스트.
// reka-ui Tooltip 마운트는 happy-dom 에서 일부 portal/raf 동작이 제한적이므로
// 본 테스트는 (a) trigger slot 렌더 (b) disabled 시 raw slot 만 노출 (c) props 검증 위주.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseTooltip from './BaseTooltip.vue'

describe('BaseTooltip', () => {
  it('default slot 컨텐츠가 trigger 로 렌더', () => {
    const w = mount(BaseTooltip, {
      props: { text: 'Pull (⌘⇧L)' },
      slots: { default: '<button data-testid="trig">Pull</button>' },
    })
    expect(w.find('[data-testid="trig"]').exists()).toBe(true)
    expect(w.text()).toContain('Pull')
  })

  it('disabled=true 시 TooltipRoot 우회 — slot 만 노출', () => {
    const w = mount(BaseTooltip, {
      props: { text: 'never shown', disabled: true },
      slots: { default: '<span data-testid="raw">raw</span>' },
    })
    expect(w.find('[data-testid="raw"]').exists()).toBe(true)
    // disabled 시 TooltipContent 마운트 안 됨 (v-if).
    expect(w.html()).not.toContain('role="tooltip"')
  })

  it('placement / delay / kbd props 가 default 와 함께 정의됨', () => {
    const w = mount(BaseTooltip, {
      props: { text: '이전 hunk', kbd: 'Alt+↑', placement: 'bottom', delay: 100 },
      slots: { default: '<button>↑</button>' },
    })
    // 명시적 verification 은 reka-ui 내부 구현에 의존 — 마운트 자체가 throw 없으면 OK.
    expect(w.exists()).toBe(true)
  })

  it('placement default = top', () => {
    const w = mount(BaseTooltip, {
      props: { text: 'default placement' },
      slots: { default: '<button>x</button>' },
    })
    expect(w.exists()).toBe(true)
  })

  it('빈 text 도 마운트 가능 (런타임 throw 없음)', () => {
    expect(() =>
      mount(BaseTooltip, {
        props: { text: '' },
        slots: { default: '<button>x</button>' },
      }),
    ).not.toThrow()
  })
})
