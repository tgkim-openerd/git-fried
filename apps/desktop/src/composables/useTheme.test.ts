import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useTheme } from './useTheme'

// useTheme 의 onMounted / watch 가 발화하려면 Vue component lifecycle 안에서 실행 필요.
// test wrapper component 로 mount.

function createHarness() {
  return defineComponent({
    setup() {
      const { theme, toggle } = useTheme()
      return { theme, toggle }
    },
    render() {
      return h('div')
    },
  })
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })
  afterEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('default theme is dark + applies .dark class on mount', async () => {
    const w = mount(createHarness())
    await nextTick()
    expect(w.vm.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('git-fried.theme')).toBe('dark')
  })

  it('loads stored "light" from localStorage on mount', async () => {
    localStorage.setItem('git-fried.theme', 'light')
    const w = mount(createHarness())
    await nextTick()
    expect(w.vm.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('toggle: dark → light → dark', async () => {
    const w = mount(createHarness())
    await nextTick()
    expect(w.vm.theme).toBe('dark')
    w.vm.toggle()
    await nextTick()
    expect(w.vm.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('git-fried.theme')).toBe('light')
    w.vm.toggle()
    await nextTick()
    expect(w.vm.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('invalid stored value falls back to default dark', async () => {
    localStorage.setItem('git-fried.theme', 'banana')
    const w = mount(createHarness())
    await nextTick()
    expect(w.vm.theme).toBe('dark')
  })

  it('watch persists subsequent changes to localStorage', async () => {
    const w = mount(createHarness())
    await nextTick()
    w.vm.toggle()
    await nextTick()
    expect(localStorage.getItem('git-fried.theme')).toBe('light')
  })
})
