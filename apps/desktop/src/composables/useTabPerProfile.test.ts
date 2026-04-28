import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'

// useTabPerProfile — useProfiles 의존, mock 으로 격리.
type Profile = { id: number; isActive: boolean; name: string } | null
const activeProfile = ref<Profile>(null)

vi.mock('./useProfiles', () => ({
  useProfiles: () => ({ active: activeProfile }),
}))

import { useTabPerProfile } from './useTabPerProfile'

describe('useTabPerProfile', () => {
  beforeEach(() => {
    localStorage.clear()
    activeProfile.value = null
  })
  afterEach(() => {
    localStorage.clear()
  })

  it('초기 — profile 없음 + global 미저장 → defaultTab 적용', async () => {
    const tab = ref<'a' | 'b' | 'c'>('a')
    const C = defineComponent({
      setup() {
        useTabPerProfile(tab, 'c')
        return { tab }
      },
      render() {
        return h('div')
      },
    })
    const w = mount(C)
    await nextTick()
    expect(tab.value).toBe('c') // immediate watch 가 default 적용
    w.unmount()
  })

  it('초기 — global key 저장값 우선 적용', async () => {
    localStorage.setItem('git-fried.tab.global', 'b')
    const tab = ref<'a' | 'b' | 'c'>('a')
    const C = defineComponent({
      setup() {
        useTabPerProfile(tab, 'c')
        return { tab }
      },
      render() {
        return h('div')
      },
    })
    const w = mount(C)
    await nextTick()
    expect(tab.value).toBe('b')
    w.unmount()
  })

  it('profile 있음 — profile-별 key 우선', async () => {
    activeProfile.value = { id: 7, isActive: true, name: 'work' }
    localStorage.setItem('git-fried.tab.profile-7', 'changes')
    const tab = ref<string>('default')
    const C = defineComponent({
      setup() {
        useTabPerProfile(tab, 'default')
        return { tab }
      },
      render() {
        return h('div')
      },
    })
    const w = mount(C)
    await nextTick()
    expect(tab.value).toBe('changes')
    w.unmount()
  })

  it('tab 변경 시 active key 에 저장', async () => {
    activeProfile.value = { id: 5, isActive: true, name: 'p' }
    const tab = ref<string>('a')
    const C = defineComponent({
      setup() {
        useTabPerProfile(tab, 'a')
        return { tab }
      },
      render() {
        return h('div')
      },
    })
    const w = mount(C)
    await nextTick()
    w.vm.tab = 'branches'
    await nextTick()
    expect(localStorage.getItem('git-fried.tab.profile-5')).toBe('branches')
    w.unmount()
  })

  it('profile 전환 시 새 profile 의 저장값 복원', async () => {
    activeProfile.value = { id: 1, isActive: true, name: 'a' }
    localStorage.setItem('git-fried.tab.profile-1', 'x')
    localStorage.setItem('git-fried.tab.profile-2', 'y')
    const tab = ref<string>('default')
    const C = defineComponent({
      setup() {
        useTabPerProfile(tab, 'default')
        return { tab }
      },
      render() {
        return h('div')
      },
    })
    const w = mount(C)
    await nextTick()
    expect(tab.value).toBe('x')
    activeProfile.value = { id: 2, isActive: true, name: 'b' }
    await nextTick()
    expect(tab.value).toBe('y')
    w.unmount()
  })

  it('profile 전환 시 신규 profile 저장값 없으면 default 적용', async () => {
    activeProfile.value = { id: 1, isActive: true, name: 'a' }
    localStorage.setItem('git-fried.tab.profile-1', 'stored')
    const tab = ref<string>('default')
    const C = defineComponent({
      setup() {
        useTabPerProfile(tab, 'fallback')
        return { tab }
      },
      render() {
        return h('div')
      },
    })
    const w = mount(C)
    await nextTick()
    expect(tab.value).toBe('stored')
    activeProfile.value = { id: 99, isActive: true, name: 'new' }
    await nextTick()
    expect(tab.value).toBe('fallback')
    w.unmount()
  })
})
