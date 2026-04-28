import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'

// useWipNote — module-level cache + watch persist. lifecycle 안에서 호출.

async function importFresh() {
  vi.resetModules()
  return await import('./useWipNote')
}

let testIdx = 1000
function uniqueRepoId(): number {
  return testIdx++
}

describe('useWipNote', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
  })

  it('initial empty for new repoId', async () => {
    const { useWipNote } = await importFresh()
    const id = uniqueRepoId()
    const C = defineComponent({
      setup() {
        const note = useWipNote(id)
        return { note }
      },
      render() {
        return h('div')
      },
    })
    const w = mount(C)
    expect(w.vm.note).toBe('')
  })

  it('loads stored value on first call', async () => {
    const id = uniqueRepoId()
    localStorage.setItem(`git-fried.wip.${id}`, '한글 메모')
    const { useWipNote } = await importFresh()
    const C = defineComponent({
      setup() {
        const note = useWipNote(id)
        return { note }
      },
      render() {
        return h('div')
      },
    })
    const w = mount(C)
    expect(w.vm.note).toBe('한글 메모')
  })

  it('변경 시 localStorage persist', async () => {
    const { useWipNote } = await importFresh()
    const id = uniqueRepoId()
    const C = defineComponent({
      setup() {
        const note = useWipNote(id)
        return { note }
      },
      render() {
        return h('div')
      },
    })
    const w = mount(C)
    w.vm.note = 'WIP: foo'
    await nextTick()
    expect(localStorage.getItem(`git-fried.wip.${id}`)).toBe('WIP: foo')
  })

  it('빈 문자열로 변경 시 localStorage 항목 제거', async () => {
    const { useWipNote } = await importFresh()
    const id = uniqueRepoId()
    const C = defineComponent({
      setup() {
        const note = useWipNote(id)
        return { note }
      },
      render() {
        return h('div')
      },
    })
    const w = mount(C)
    w.vm.note = 'something'
    await nextTick()
    expect(localStorage.getItem(`git-fried.wip.${id}`)).toBe('something')
    w.vm.note = ''
    await nextTick()
    expect(localStorage.getItem(`git-fried.wip.${id}`)).toBe(null)
  })

  it('cache — 같은 repoId 두 번 호출 시 같은 ref', async () => {
    const { useWipNote } = await importFresh()
    const id = uniqueRepoId()
    const C = defineComponent({
      setup() {
        const a = useWipNote(id)
        const b = useWipNote(id)
        return { sameRef: a === b }
      },
      render() {
        return h('div')
      },
    })
    const w = mount(C)
    expect(w.vm.sameRef).toBe(true)
  })

  it('clearWipNote — 활성 ref 비우고 localStorage 항목 제거', async () => {
    const { useWipNote, clearWipNote } = await importFresh()
    const id = uniqueRepoId()
    const C = defineComponent({
      setup() {
        const note = useWipNote(id)
        return { note }
      },
      render() {
        return h('div')
      },
    })
    const w = mount(C)
    w.vm.note = 'temp'
    await nextTick()
    clearWipNote(id)
    await nextTick()
    expect(w.vm.note).toBe('')
    expect(localStorage.getItem(`git-fried.wip.${id}`)).toBe(null)
  })

  it('clearWipNote — cache 미존재 repoId 에도 안전 (직접 localStorage 정리)', async () => {
    const { clearWipNote } = await importFresh()
    const id = uniqueRepoId()
    localStorage.setItem(`git-fried.wip.${id}`, 'orphan')
    expect(() => clearWipNote(id)).not.toThrow()
    expect(localStorage.getItem(`git-fried.wip.${id}`)).toBe(null)
  })
})
