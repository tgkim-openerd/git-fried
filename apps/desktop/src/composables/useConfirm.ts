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

// ============================================================
// Sprint c38 / plan/29 E5 — promptDialog (window.prompt 대체)
// ============================================================
//
// `window.prompt()` 가 OS 다이얼로그를 띄우고 a11y / 키보드 / 한글 IME 처리가
// 일관되지 않음. 본 promptDialog 는 confirmDialog 와 동일 패턴 (App.vue 에
// 한 번 마운트되는 PromptDialog.vue + composable singleton state).
//
// API:
//   const v = await promptDialog({ title, message, defaultValue: 'foo' })
//   if (v == null) return  // 취소
//   if (!v.trim()) return  // 빈 입력
//
// 동시 호출 방어: 이전 요청 null resolve.

export interface PromptOptions {
  /** 제목 (생략 시 i18n 'confirm.title'). */
  title?: string
  /** 본문 (필수, \n 줄바꿈 허용). */
  message: string
  /** 기본값. */
  defaultValue?: string
  /** placeholder. */
  placeholder?: string
  /** 확인 버튼 텍스트 (생략 시 i18n 'confirm.confirm'). */
  confirmText?: string
  /** 취소 버튼 텍스트 (생략 시 i18n 'common.cancel'). */
  cancelText?: string
}

const isPromptOpen = ref(false)
const promptOptions = ref<PromptOptions>({ message: '' })
let promptResolver: ((value: string | null) => void) | null = null

/**
 * Prompt dialog 트리거. Promise<string | null> resolve.
 *  - string: 사용자 입력 (trim 미적용 — 호출 측에서 처리).
 *  - null: 취소 / Esc / backdrop click.
 *
 * 동시 호출 시 이전 요청은 null 로 resolve.
 */
export function promptDialog(opts: PromptOptions): Promise<string | null> {
  if (promptResolver) {
    promptResolver(null)
    promptResolver = null
  }
  return new Promise<string | null>((resolve) => {
    promptOptions.value = opts
    isPromptOpen.value = true
    promptResolver = resolve
  })
}

/**
 * PromptDialog 컴포넌트 전용 state 접근.
 */
export function usePromptDialogState() {
  return {
    isOpen: readonly(isPromptOpen),
    options: readonly(promptOptions),
    /** 입력값 또는 null (cancel). */
    resolve(result: string | null) {
      isPromptOpen.value = false
      promptResolver?.(result)
      promptResolver = null
    },
  }
}

/** 테스트 전용 — prompt state reset. */
export function __resetPromptDialogForTest() {
  if (promptResolver) {
    promptResolver(null)
    promptResolver = null
  }
  isPromptOpen.value = false
  promptOptions.value = { message: '' }
}

// ============================================================
// UXF-10 — chooseDialog (다중 옵션 action sheet)
// ============================================================
//
// confirmDialog(yes/no) / promptDialog(text input) 의 형제. N 개 버튼 중 1 개 선택.
// `window.prompt('m | r | cancel')` 같은 텍스트 입력 안티패턴 대체 (Hick's Law).
//
// API:
//   const v = await chooseDialog({
//     title, message,
//     options: [{ value: 'merge', label: 'Merge' }, { value: 'rebase', label: 'Rebase' }],
//   })
//   if (v == null) return  // 취소 / Esc / backdrop

export interface ChooseOption {
  /** resolve 시 반환값. */
  value: string
  /** 버튼 표시 텍스트. */
  label: string
  /** destructive 강조 (red). */
  danger?: boolean
}

export interface ChooseOptions {
  /** 제목 (생략 시 i18n 'confirm.title'). */
  title?: string
  /** 본문 (필수, \n 줄바꿈 허용). */
  message: string
  /** 선택지 (2개 이상). */
  options: ChooseOption[]
  /** 취소 버튼 텍스트 (생략 시 i18n 'common.cancel'). */
  cancelText?: string
}

const isChooseOpen = ref(false)
const chooseOptions = ref<ChooseOptions>({ message: '', options: [] })
let chooseResolver: ((value: string | null) => void) | null = null

/**
 * Choose dialog 트리거. Promise<string | null> resolve.
 *  - string: 선택한 option.value.
 *  - null: 취소 / Esc / backdrop click.
 */
export function chooseDialog(opts: ChooseOptions): Promise<string | null> {
  if (chooseResolver) {
    chooseResolver(null)
    chooseResolver = null
  }
  return new Promise<string | null>((resolve) => {
    chooseOptions.value = opts
    isChooseOpen.value = true
    chooseResolver = resolve
  })
}

/** ChooseDialog 컴포넌트 전용 state 접근. */
export function useChooseDialogState() {
  return {
    isOpen: readonly(isChooseOpen),
    options: readonly(chooseOptions),
    resolve(result: string | null) {
      isChooseOpen.value = false
      chooseResolver?.(result)
      chooseResolver = null
    },
  }
}

/** 테스트 전용 — choose state reset. */
export function __resetChooseDialogForTest() {
  if (chooseResolver) {
    chooseResolver(null)
    chooseResolver = null
  }
  isChooseOpen.value = false
  chooseOptions.value = { message: '', options: [] }
}
