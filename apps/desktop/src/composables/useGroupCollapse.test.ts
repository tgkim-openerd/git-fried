// Sprint c50 — useGroupCollapse composable (Pattern 10) 회귀 보호.
//
// 핵심 검증:
//   1. 기본 모두 open (collapsedKeys 빈 set)
//   2. setOpen(false/true) 양방향 동기화
//   3. collapseAll / expandAll
//   4. ref<Set> 재할당 패턴 (mutate 가 아닌 immutable update)
//   5. allCollapsed 정확성 (groups 0 / 부분 / 전체)
import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { useGroupCollapse } from './useGroupCollapse'

function makeGroups(keys: string[]) {
  const list = ref(keys.map((k) => ({ key: k })))
  return computed(() => list.value)
}

describe('useGroupCollapse', () => {
  it('기본은 모든 그룹 open (collapsedKeys 빈 Set)', () => {
    const { collapsedKeys, isOpen, allCollapsed } = useGroupCollapse(makeGroups(['a', 'b', 'c']))
    expect(collapsedKeys.value.size).toBe(0)
    expect(isOpen('a')).toBe(true)
    expect(isOpen('b')).toBe(true)
    expect(allCollapsed.value).toBe(false)
  })

  it('setOpen(key, false) → 그 key 만 collapse', () => {
    const { isOpen, setOpen, collapsedKeys } = useGroupCollapse(makeGroups(['a', 'b']))
    setOpen('a', false)
    expect(isOpen('a')).toBe(false)
    expect(isOpen('b')).toBe(true)
    expect(collapsedKeys.value.has('a')).toBe(true)
    expect(collapsedKeys.value.has('b')).toBe(false)
  })

  it('setOpen(key, true) → 그 key expand (Set 에서 제거)', () => {
    const { isOpen, setOpen } = useGroupCollapse(makeGroups(['a', 'b']))
    setOpen('a', false)
    setOpen('a', true)
    expect(isOpen('a')).toBe(true)
  })

  it('collapseAll → 모든 group key 추가, allCollapsed=true', () => {
    const { allCollapsed, collapseAll, collapsedKeys } = useGroupCollapse(
      makeGroups(['a', 'b', 'c']),
    )
    collapseAll()
    expect(collapsedKeys.value.size).toBe(3)
    expect(allCollapsed.value).toBe(true)
  })

  it('expandAll → 빈 Set, allCollapsed=false', () => {
    const { allCollapsed, collapseAll, expandAll, collapsedKeys } = useGroupCollapse(
      makeGroups(['a', 'b']),
    )
    collapseAll()
    expandAll()
    expect(collapsedKeys.value.size).toBe(0)
    expect(allCollapsed.value).toBe(false)
  })

  it('groups 가 빈 배열이면 allCollapsed=false (vacuous truth 차단)', () => {
    const { allCollapsed } = useGroupCollapse(makeGroups([]))
    expect(allCollapsed.value).toBe(false)
  })

  it('setOpen 호출마다 ref<Set> 재할당 — 같은 instance 가 아님 (immutable update 보장)', () => {
    const { collapsedKeys, setOpen } = useGroupCollapse(makeGroups(['a', 'b']))
    const before = collapsedKeys.value
    setOpen('a', false)
    const after = collapsedKeys.value
    // Vue3 ref<Set> reactivity 한계 우회 — Set.add 가 아닌 new Set(prev) 패턴 검증.
    expect(after).not.toBe(before)
    expect(after.has('a')).toBe(true)
  })

  it('일부만 collapse 면 allCollapsed=false', () => {
    const { allCollapsed, setOpen } = useGroupCollapse(makeGroups(['a', 'b', 'c']))
    setOpen('a', false)
    setOpen('b', false)
    expect(allCollapsed.value).toBe(false)
  })

  it('collapseAll 후 expandAll → setOpen 으로 다시 collapse 가능 (state 재사용)', () => {
    const { isOpen, collapseAll, expandAll, setOpen } = useGroupCollapse(makeGroups(['a', 'b']))
    collapseAll()
    expandAll()
    setOpen('b', false)
    expect(isOpen('a')).toBe(true)
    expect(isOpen('b')).toBe(false)
  })
})
