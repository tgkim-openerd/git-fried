// 공용 Confirm 다이얼로그 — Sprint c33 (Phase 0 UX gap fix).
//
// `window.confirm()` 의 OS 다이얼로그 대체. 다음 3 가지 UX 갭 동시 해소:
//   1. Von Restorff Effect — destructive 액션 시각 구분 (red 버튼 + danger flag)
//   2. i18n (Selective Attention) — 한국어 메시지 vue-i18n 흡수 가능
//   3. Jakob's Law — 데스크탑 git 클라이언트 표준 (커스텀 modal)
//
// API:
//   import { confirmDialog } from '@/composables/useConfirm'
//   const ok = await confirmDialog({
//     title: '브랜치 삭제',
//     message: `'feature/foo' 를 삭제할까요?`,
//     danger: true,
//   })
//   if (!ok) return
//
// 단일 Promise queue — 동시에 두 dialog 가 뜨지 않음 (이전 요청 cancel resolve).
// 컴포넌트는 `ConfirmDialog.vue` 가 App.vue 에 한 번 마운트되어 state 를 read.
import { readonly, ref } from 'vue'

export interface ConfirmOptions {
  /** 헤더 (생략 시 i18n 'confirm.title') */
  title?: string
  /** 본문 (필수) — \n 줄바꿈 허용 */
  message: string
  /** 확인 버튼 텍스트 (생략 시 i18n 'confirm.confirm') */
  confirmText?: string
  /** 취소 버튼 텍스트 (생략 시 i18n 'common.cancel') */
  cancelText?: string
  /** destructive 액션 (red 버튼 + cancel auto-focus + Enter 자동 confirm 비활성) */
  danger?: boolean
}

const isOpen = ref(false)
const options = ref<ConfirmOptions>({ message: '' })
let resolver: ((value: boolean) => void) | null = null

/**
 * Confirm dialog 트리거. Promise<boolean> resolve.
 *  - true: 확인
 *  - false: 취소 / Esc / backdrop click
 *
 * 동시 호출 시: 이전 요청은 false 로 resolve 후 새 dialog open.
 */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  // 이전 미해결 요청은 false 로 resolve (race condition 방어).
  if (resolver) {
    resolver(false)
    resolver = null
  }
  return new Promise<boolean>((resolve) => {
    options.value = opts
    isOpen.value = true
    resolver = resolve
  })
}

/**
 * ConfirmDialog 컴포넌트 전용 state 접근. 호출 코드는 `confirmDialog()` 만 사용.
 */
export function useConfirmDialogState() {
  return {
    isOpen: readonly(isOpen),
    options: readonly(options),
    /** 컴포넌트가 사용자 응답 시 호출. result=false 면 취소 동등. */
    resolve(result: boolean) {
      isOpen.value = false
      resolver?.(result)
      resolver = null
    },
  }
}

/** 테스트 전용 — state reset. */
export function __resetConfirmDialogForTest() {
  if (resolver) {
    resolver(false)
    resolver = null
  }
  isOpen.value = false
  options.value = { message: '' }
}
