// Sprint 22-21 — TDD-lite 시범 2: SkeletonBlock 컴포넌트 테스트.
//
// 검증 영역:
//   - count props (반복 row 개수)
//   - height props ('sm' / 'md' / 'lg' → h-4 / h-6 / h-8 클래스)
//   - widthRange props (각 row 의 width % 가 [min, max] 범위 안)
//   - deterministic width per index (sin pseudo-noise reload 시 안정)
//   - a11y (role="status" + aria-live="polite" + sr-only "데이터 불러오는 중...")
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SkeletonBlock from './SkeletonBlock.vue'

describe('SkeletonBlock', () => {
  describe('count', () => {
    it('default count=4 → 4개 row 렌더', () => {
      const wrapper = mount(SkeletonBlock)
      const rows = wrapper.findAll('.bg-muted')
      expect(rows).toHaveLength(4)
    })

    it('count=6 → 6개 row', () => {
      const wrapper = mount(SkeletonBlock, { props: { count: 6 } })
      expect(wrapper.findAll('.bg-muted')).toHaveLength(6)
    })

    it('count=1 → 단일 row', () => {
      const wrapper = mount(SkeletonBlock, { props: { count: 1 } })
      expect(wrapper.findAll('.bg-muted')).toHaveLength(1)
    })

    it('count=0 → row 없음', () => {
      const wrapper = mount(SkeletonBlock, { props: { count: 0 } })
      expect(wrapper.findAll('.bg-muted')).toHaveLength(0)
    })
  })

  describe('height', () => {
    it('default height="md" → h-6', () => {
      const wrapper = mount(SkeletonBlock)
      const row = wrapper.find('.bg-muted')
      expect(row.classes()).toContain('h-6')
    })

    it('height="sm" → h-4', () => {
      const wrapper = mount(SkeletonBlock, { props: { height: 'sm' } })
      expect(wrapper.find('.bg-muted').classes()).toContain('h-4')
    })

    it('height="lg" → h-8', () => {
      const wrapper = mount(SkeletonBlock, { props: { height: 'lg' } })
      expect(wrapper.find('.bg-muted').classes()).toContain('h-8')
    })
  })

  describe('width (deterministic per index)', () => {
    it('각 row 의 width inline style = "${N}%"', () => {
      const wrapper = mount(SkeletonBlock, { props: { count: 3 } })
      const rows = wrapper.findAll('.bg-muted')
      for (const row of rows) {
        const style = row.attributes('style') ?? ''
        expect(style).toMatch(/width:\s*\d+%/)
      }
    })

    it('default widthRange [50, 95] — 모든 width 가 범위 안', () => {
      const wrapper = mount(SkeletonBlock, { props: { count: 10 } })
      const rows = wrapper.findAll('.bg-muted')
      for (const row of rows) {
        const m = /(\d+)%/.exec(row.attributes('style') ?? '')
        expect(m).not.toBeNull()
        const w = Number(m![1])
        expect(w).toBeGreaterThanOrEqual(50)
        expect(w).toBeLessThanOrEqual(95)
      }
    })

    it('custom widthRange [30, 60] 적용', () => {
      const wrapper = mount(SkeletonBlock, {
        props: { count: 5, widthRange: [30, 60] },
      })
      const rows = wrapper.findAll('.bg-muted')
      for (const row of rows) {
        const m = /(\d+)%/.exec(row.attributes('style') ?? '')
        const w = Number(m![1])
        expect(w).toBeGreaterThanOrEqual(30)
        expect(w).toBeLessThanOrEqual(60)
      }
    })

    it('deterministic — 동일 props 로 재마운트 시 width 동일 (sin seed)', () => {
      const w1 = mount(SkeletonBlock, { props: { count: 5 } })
      const w2 = mount(SkeletonBlock, { props: { count: 5 } })
      const styles1 = w1.findAll('.bg-muted').map((r) => r.attributes('style'))
      const styles2 = w2.findAll('.bg-muted').map((r) => r.attributes('style'))
      expect(styles1).toEqual(styles2)
    })
  })

  describe('a11y', () => {
    it('role="status" 루트', () => {
      const wrapper = mount(SkeletonBlock)
      expect(wrapper.attributes('role')).toBe('status')
    })

    it('aria-live="polite"', () => {
      const wrapper = mount(SkeletonBlock)
      expect(wrapper.attributes('aria-live')).toBe('polite')
    })

    it('aria-label="로딩 중..."', () => {
      const wrapper = mount(SkeletonBlock)
      expect(wrapper.attributes('aria-label')).toBe('로딩 중...')
    })

    it('sr-only 텍스트 (스크린리더용 명시)', () => {
      const wrapper = mount(SkeletonBlock)
      const sr = wrapper.find('.sr-only')
      expect(sr.exists()).toBe(true)
      expect(sr.text()).toContain('데이터 불러오는 중')
    })
  })

  describe('animation', () => {
    it('각 row 에 animate-pulse 클래스', () => {
      const wrapper = mount(SkeletonBlock)
      const row = wrapper.find('.bg-muted')
      expect(row.classes()).toContain('animate-pulse')
    })
  })
})
