// Sprint 22-21 — TDD-lite 시범 1: PlaceholderButton 컴포넌트 테스트.
//
// 검증 영역:
//   - props (label / eta / detail / icon / size / showToast)
//   - 동적 a11y (aria-label / title)
//   - click → toast.info dispatch (singleton useToast)
//   - showToast=false 시 click 무시
//   - 'sm' / 'md' size class 분기
//
// useToast 는 global singleton — beforeEach 에서 clearAll 로 격리.
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PlaceholderButton from './PlaceholderButton.vue'
import { useToast } from '@/composables/useToast'

describe('PlaceholderButton', () => {
  const { toasts, clearAll } = useToast()

  beforeEach(() => {
    clearAll()
  })

  describe('렌더링', () => {
    it('label / eta 뱃지 표시', () => {
      const wrapper = mount(PlaceholderButton, {
        props: { label: 'OAuth 로그인', eta: 'v1.5' },
      })
      expect(wrapper.text()).toContain('OAuth 로그인')
      expect(wrapper.text()).toContain('🔜 v1.5')
    })

    it('icon prop 있으면 렌더 / 없으면 미렌더', () => {
      const withIcon = mount(PlaceholderButton, {
        props: { label: 'A', icon: '🔐' },
      })
      expect(withIcon.text()).toContain('🔐')

      const withoutIcon = mount(PlaceholderButton, {
        props: { label: 'B' },
      })
      // icon 미지정 시 'B' + '🔜 v0.4' 만 (이모지는 뱃지에 1개)
      expect(withoutIcon.text()).not.toMatch(/🔐|🔑|⚡/)
    })

    it('eta 미지정 시 기본 v0.4', () => {
      const wrapper = mount(PlaceholderButton, { props: { label: 'A' } })
      expect(wrapper.text()).toContain('🔜 v0.4')
    })
  })

  describe('a11y', () => {
    it('aria-label 동적 = "${label} (${eta} 예정)"', () => {
      const wrapper = mount(PlaceholderButton, {
        props: { label: 'OAuth', eta: 'v1.5' },
      })
      expect(wrapper.attributes('aria-label')).toBe('OAuth (v1.5 예정)')
    })

    it('title attribute 다중 라인 (eta + detail + plan/05)', () => {
      const wrapper = mount(PlaceholderButton, {
        props: {
          label: 'OAuth',
          eta: 'v1.5',
          detail: 'GitHub OAuth + Custom URL scheme',
        },
      })
      const title = wrapper.attributes('title') ?? ''
      expect(title).toContain('🔜 v1.5 예정')
      expect(title).toContain('GitHub OAuth + Custom URL scheme')
      expect(title).toContain('docs/plan/05')
    })

    it('detail 미지정 시 title 에 detail 라인 없음', () => {
      const wrapper = mount(PlaceholderButton, {
        props: { label: 'OAuth', eta: 'v1.5' },
      })
      const title = wrapper.attributes('title') ?? ''
      expect(title).toContain('🔜 v1.5 예정')
      expect(title).toContain('docs/plan/05')
      // 빈 줄만 있고 detail 텍스트 부재 — 라인 수 검증
      expect(title.split('\n').length).toBe(2)
    })
  })

  describe('click 동작', () => {
    it('click → toast.info dispatch (showToast=true 기본)', async () => {
      const wrapper = mount(PlaceholderButton, {
        props: { label: 'OAuth', eta: 'v1.5' },
      })
      await wrapper.trigger('click')
      expect(toasts.value).toHaveLength(1)
      expect(toasts.value[0].kind).toBe('info')
      expect(toasts.value[0].title).toContain('OAuth')
      expect(toasts.value[0].title).toContain('v1.5')
    })

    it('showToast=false 시 click 무시', async () => {
      const wrapper = mount(PlaceholderButton, {
        props: { label: 'OAuth', showToast: false },
      })
      await wrapper.trigger('click')
      expect(toasts.value).toHaveLength(0)
    })

    it('toast.info message 에 plan/05 가이드 포함', async () => {
      const wrapper = mount(PlaceholderButton, {
        props: { label: 'OAuth', eta: 'v1.5' },
      })
      await wrapper.trigger('click')
      expect(toasts.value[0].message).toContain('docs/plan/05')
    })
  })

  describe('size 분기', () => {
    it('size="sm" (기본) — px-2 py-1 text-xs', () => {
      const wrapper = mount(PlaceholderButton, { props: { label: 'A' } })
      expect(wrapper.classes()).toContain('px-2')
      expect(wrapper.classes()).toContain('py-1')
      expect(wrapper.classes()).toContain('text-xs')
    })

    it('size="md" — px-3 py-1.5 text-sm', () => {
      const wrapper = mount(PlaceholderButton, {
        props: { label: 'A', size: 'md' },
      })
      expect(wrapper.classes()).toContain('px-3')
      expect(wrapper.classes()).toContain('text-sm')
    })
  })

  describe('disabled / cursor 시각', () => {
    it('cursor-not-allowed + 점선 border', () => {
      const wrapper = mount(PlaceholderButton, { props: { label: 'A' } })
      expect(wrapper.classes()).toContain('cursor-not-allowed')
      expect(wrapper.classes()).toContain('border-dashed')
    })
  })
})
