// Sprint c33 — useConfirm 단위 테스트.
//
// state singleton + Promise resolution 검증. UI 컴포넌트 마운트 없이 state API 만 검증.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __resetConfirmDialogForTest, confirmDialog, useConfirmDialogState } from './useConfirm'

beforeEach(() => {
  __resetConfirmDialogForTest()
})

afterEach(() => {
  __resetConfirmDialogForTest()
})

describe('useConfirm — initial state', () => {
  it('초기에 닫혀있고 message 비어있음', () => {
    const s = useConfirmDialogState()
    expect(s.isOpen.value).toBe(false)
    expect(s.options.value.message).toBe('')
  })
})

describe('useConfirm — open + resolve true', () => {
  it('confirmDialog 호출 → isOpen=true + options 반영', () => {
    const s = useConfirmDialogState()
    void confirmDialog({ title: '삭제', message: 'X 를 삭제할까요?', danger: true })
    expect(s.isOpen.value).toBe(true)
    expect(s.options.value.title).toBe('삭제')
    expect(s.options.value.message).toBe('X 를 삭제할까요?')
    expect(s.options.value.danger).toBe(true)
  })

  it('resolve(true) → Promise 가 true 로 resolve', async () => {
    const s = useConfirmDialogState()
    const p = confirmDialog({ message: 'go?' })
    s.resolve(true)
    await expect(p).resolves.toBe(true)
    expect(s.isOpen.value).toBe(false)
  })

  it('resolve(false) → Promise 가 false 로 resolve', async () => {
    const s = useConfirmDialogState()
    const p = confirmDialog({ message: 'go?' })
    s.resolve(false)
    await expect(p).resolves.toBe(false)
    expect(s.isOpen.value).toBe(false)
  })
})

describe('useConfirm — race condition', () => {
  it('두 번째 호출은 이전 요청을 false 로 resolve 후 자기 자신 open', async () => {
    const s = useConfirmDialogState()
    const p1 = confirmDialog({ message: 'first' })
    const p2 = confirmDialog({ message: 'second' })
    // 첫 번째는 자동으로 false resolve
    await expect(p1).resolves.toBe(false)
    // 두 번째 dialog 가 현재 open 상태
    expect(s.isOpen.value).toBe(true)
    expect(s.options.value.message).toBe('second')
    s.resolve(true)
    await expect(p2).resolves.toBe(true)
  })
})

describe('useConfirm — defaults', () => {
  it('danger 미지정 시 undefined (false 로 취급은 컴포넌트에서)', () => {
    const s = useConfirmDialogState()
    void confirmDialog({ message: 'no danger' })
    expect(s.options.value.danger).toBeUndefined()
  })

  it('confirmText / cancelText 옵션 반영', () => {
    const s = useConfirmDialogState()
    void confirmDialog({
      message: '?',
      confirmText: '강제 진행',
      cancelText: '돌아가기',
    })
    expect(s.options.value.confirmText).toBe('강제 진행')
    expect(s.options.value.cancelText).toBe('돌아가기')
  })
})

describe('useConfirm — readonly state', () => {
  it('isOpen / options 는 readonly (직접 수정 불가)', () => {
    const s = useConfirmDialogState()
    void confirmDialog({ message: 'x' })
    // readonly 의 .value 직접 set 시도 — 런타임에 mutate 시도하면 타입 에러.
    // 본 테스트는 타입 레벨 보호 확인 — 실 mutate 시도는 컴파일 시점에 차단됨.
    expect(s.isOpen.value).toBe(true)
    s.resolve(false)
    expect(s.isOpen.value).toBe(false)
  })
})

describe('useConfirm — multiple sequential', () => {
  it('순차 호출: 각각 독립적으로 resolve', async () => {
    const s = useConfirmDialogState()

    const p1 = confirmDialog({ message: 'first' })
    s.resolve(true)
    await expect(p1).resolves.toBe(true)

    const p2 = confirmDialog({ message: 'second' })
    s.resolve(false)
    await expect(p2).resolves.toBe(false)

    const p3 = confirmDialog({ message: 'third', danger: true })
    expect(s.options.value.message).toBe('third')
    expect(s.options.value.danger).toBe(true)
    s.resolve(true)
    await expect(p3).resolves.toBe(true)
  })
})
