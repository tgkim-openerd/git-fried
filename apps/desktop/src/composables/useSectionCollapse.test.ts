import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useSectionCollapse } from './useSectionCollapse'

// Module-level cache 가 key 별 ref 를 재사용 — test 마다 unique key 로 분리.
// watch 가 lifecycle 안에서 발화하도록 mount harness 사용.

function harness(key: string, initial = false) {
  return defineComponent({
    setup() {
      const collapsed = useSectionCollapse(key, initial)
      return { collapsed }
    },
    render() {
      return h('div')
    },
  })
}

let testIdx = 0
function uniqueKey(): string {
  testIdx += 1
  return `unit-test-${testIdx}-${Date.now()}`
}

describe('useSectionCollapse', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear()
  })
  afterEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear()
  })

  it('default initial=false', () => {
    const w = mount(harness(uniqueKey()))
    expect(w.vm.collapsed).toBe(false)
  })

  it('initialCollapsed=true 적용', () => {
    const w = mount(harness(uniqueKey(), true))
    expect(w.vm.collapsed).toBe(true)
  })

  it('localStorage "1" 우선 (stored true)', () => {
    const k = uniqueKey()
    localStorage.setItem(`git-fried.section-collapsed.${k}`, '1')
    const w = mount(harness(k))
    expect(w.vm.collapsed).toBe(true)
  })

  it('localStorage "0" 우선 (stored false override initial=true)', () => {
    const k = uniqueKey()
    localStorage.setItem(`git-fried.section-collapsed.${k}`, '0')
    const w = mount(harness(k, true))
    expect(w.vm.collapsed).toBe(false)
  })

  it('값 변경 시 localStorage 갱신 ("0" → "1")', async () => {
    const k = uniqueKey()
    const C = defineComponent({
      setup() {
        const c = useSectionCollapse(k)
        return { c }
      },
      render() {
        return h('div')
      },
    })
    const w = mount(C)
    w.vm.c = true
    await nextTick()
    expect(localStorage.getItem(`git-fried.section-collapsed.${k}`)).toBe('1')
  })

  it('같은 key 재호출 시 cached ref 재사용 (singleton per key)', () => {
    const k = uniqueKey()
    const C = defineComponent({
      setup() {
        const a = useSectionCollapse(k)
        const b = useSectionCollapse(k)
        return { a, b, sameRef: a === b }
      },
      render() {
        return h('div')
      },
    })
    const w = mount(C)
    expect(w.vm.sameRef).toBe(true)
  })

  it('invalid stored value (e.g., "banana") falls back to initial', () => {
    const k = uniqueKey()
    localStorage.setItem(`git-fried.section-collapsed.${k}`, 'banana')
    const w = mount(harness(k, true))
    expect(w.vm.collapsed).toBe(true)
  })
})
