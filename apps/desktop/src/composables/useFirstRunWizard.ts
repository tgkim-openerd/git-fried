// v0.4 #2 (UltraPlan plan/31 §9 Q1 절충) — First-run wizard state.
//
// 정책: toast 1회 후 7s 자동 modal 표시 (사용자 dismiss 가능).
// 기존 useOnboardingDetect 의 modal-자동-open-금지 정책 변경 — UltraPlan §9 Q1
// 권장 (c) 절충안. 사용자 dismiss 또는 complete 시 localStorage 마킹.
//
// step 1 (welcome): 환영 + 차별점 catalog (Tauri ~30MB / 한글 safety / AI 무료 / Gitea)
// step 2 (theme): light / dark / system 선택
// step 3 (quickstart): 첫 레포 추가 / GitKraken 마이그 / Skip
//
// localStorage 'git-fried.firstRunWizard.completed.v1' 부재 시 한 번만.

import { computed, ref } from 'vue'

export type WizardStep = 1 | 2 | 3
const WIZARD_KEY = 'git-fried.firstRunWizard.completed.v1'

const isOpen = ref(false)
const step = ref<WizardStep>(1)

function hasCompleted(): boolean {
  try {
    return localStorage.getItem(WIZARD_KEY) != null
  } catch {
    // localStorage 비활성 (시크릿 모드 / SSR) — silent fallback (한 번 더 표시 가능).
    return false
  }
}

function markCompleted(): void {
  try {
    localStorage.setItem(WIZARD_KEY, String(Date.now()))
  } catch {
    // ignore
  }
}

export function useFirstRunWizard() {
  function open(initialStep: WizardStep = 1): void {
    if (hasCompleted()) return
    step.value = initialStep
    isOpen.value = true
  }

  function close(): void {
    isOpen.value = false
  }

  function next(): void {
    if (step.value < 3) {
      step.value = (step.value + 1) as WizardStep
    }
  }

  function prev(): void {
    if (step.value > 1) {
      step.value = (step.value - 1) as WizardStep
    }
  }

  function complete(): void {
    markCompleted()
    isOpen.value = false
  }

  function skipForever(): void {
    markCompleted()
    isOpen.value = false
  }

  return {
    isOpen: computed(() => isOpen.value),
    step: computed(() => step.value),
    open,
    close,
    next,
    prev,
    complete,
    skipForever,
    hasCompleted,
  }
}

/** 테스트 / reset — first-run completed mark 즉시 해제 + state. */
export function __resetFirstRunWizard(): void {
  try {
    localStorage.removeItem(WIZARD_KEY)
  } catch {
    // ignore
  }
  isOpen.value = false
  step.value = 1
}
