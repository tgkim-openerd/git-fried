// Sprint 22-16 Q-7 — Custom theme HSL 검증 단위 테스트.
// validateHsl 의 경계값 + 한국어 에러 메시지 + shadcn-vue 표준 호환성.
import { describe, it, expect } from 'vitest'
import { validateHsl } from './useCustomTheme'

describe('validateHsl', () => {
  describe('유효한 형식', () => {
    it('shadcn-vue 표준 형식 통과', () => {
      expect(validateHsl('240 10% 3.9%').ok).toBe(true)
      expect(validateHsl('0 72% 51%').ok).toBe(true)
      expect(validateHsl('240 5.9% 10%').ok).toBe(true)
      expect(validateHsl('0 0% 100%').ok).toBe(true)
      expect(validateHsl('360 100% 0%').ok).toBe(true)
    })

    it('앞뒤 공백 trim', () => {
      expect(validateHsl('  240 10% 3.9%  ').ok).toBe(true)
      expect(validateHsl('\t0 72% 51%\n').ok).toBe(true)
    })

    it('소수 saturation/lightness', () => {
      expect(validateHsl('240 4.8% 95.9%').ok).toBe(true)
      expect(validateHsl('142 65.5% 45.25%').ok).toBe(true)
    })
  })

  describe('형식 실패 (정규식)', () => {
    it('CSS 색 이름 거부', () => {
      const r = validateHsl('red')
      expect(r.ok).toBe(false)
      expect(r.error).toContain('HSL 형식 아님')
    })

    it('hex 거부', () => {
      expect(validateHsl('#ff0000').ok).toBe(false)
      expect(validateHsl('#fff').ok).toBe(false)
    })

    it('rgb/hsl 함수 표기 거부 (Tailwind alpha 합성 미호환)', () => {
      expect(validateHsl('rgb(0, 0, 0)').ok).toBe(false)
      expect(validateHsl('hsl(240, 10%, 3.9%)').ok).toBe(false)
    })

    it('% 누락 거부', () => {
      expect(validateHsl('240 10 3.9').ok).toBe(false)
      expect(validateHsl('240 10% 3.9').ok).toBe(false)
      expect(validateHsl('240 10 3.9%').ok).toBe(false)
    })

    it('comma 구분 거부 (띄어쓰기 강제)', () => {
      expect(validateHsl('240, 10%, 3.9%').ok).toBe(false)
    })

    it('빈 문자열 거부', () => {
      expect(validateHsl('').ok).toBe(false)
      expect(validateHsl('   ').ok).toBe(false)
    })
  })

  describe('범위 실패', () => {
    it('Hue 범위 초과', () => {
      const r = validateHsl('361 50% 50%')
      expect(r.ok).toBe(false)
      expect(r.error).toContain('Hue')
      expect(r.error).toContain('361')
    })

    it('Saturation 범위 초과', () => {
      const r = validateHsl('240 101% 50%')
      expect(r.ok).toBe(false)
      expect(r.error).toContain('Saturation')
    })

    it('Lightness 범위 초과', () => {
      const r = validateHsl('240 50% 150%')
      expect(r.ok).toBe(false)
      expect(r.error).toContain('Lightness')
    })

    it('Hue 음수 거부 (정규식 단계에서 차단)', () => {
      // 정규식이 음수 sign 허용 안 함 → "HSL 형식 아님" 으로 분류.
      const r = validateHsl('-1 50% 50%')
      expect(r.ok).toBe(false)
      expect(r.error).toContain('HSL 형식 아님')
    })
  })

  describe('git-fried 실제 토큰 (main.css 검증용 소스 truth)', () => {
    it('light mode 핵심 토큰', () => {
      // main.css :root
      expect(validateHsl('0 0% 100%').ok).toBe(true) // background
      expect(validateHsl('240 10% 3.9%').ok).toBe(true) // foreground
      expect(validateHsl('240 5.9% 10%').ok).toBe(true) // primary
      expect(validateHsl('240 4.8% 95.9%').ok).toBe(true) // secondary
      expect(validateHsl('240 4.8% 97.5%').ok).toBe(true) // muted (Q2 적용)
      expect(validateHsl('240 5.9% 92%').ok).toBe(true) // accent (Q2 적용)
      expect(validateHsl('0 72% 51%').ok).toBe(true) // destructive
    })

    it('dark mode 핵심 토큰', () => {
      // main.css .dark
      expect(validateHsl('240 10% 3.9%').ok).toBe(true) // background
      expect(validateHsl('0 0% 98%').ok).toBe(true) // foreground
      expect(validateHsl('240 3.7% 12%').ok).toBe(true) // muted (Q2)
      expect(validateHsl('240 3.7% 22%').ok).toBe(true) // accent (Q2)
      expect(validateHsl('0 62.8% 30.6%').ok).toBe(true) // destructive
    })

    it('status semantic 토큰 (Sprint A-3)', () => {
      expect(validateHsl('142 71% 35%').ok).toBe(true) // success light
      expect(validateHsl('38 92% 45%').ok).toBe(true) // warning light
      expect(validateHsl('217 91% 50%').ok).toBe(true) // info light
    })
  })
})
