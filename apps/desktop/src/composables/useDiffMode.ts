// Diff 4-mode 토글 — Sprint B1 + E3 (`docs/plan/11 §7`).
//
// GitKraken 의 Hunk / Inline / Split 모드 흡수.
//   - compact (Hunk): -U0  (변경 라인만)
//   - default (Inline): -U3  (git 기본 컨텍스트)
//   - context: -U25 (더 많은 컨텍스트)
//   - split: side-by-side (CodeMirror MergeView, Sprint E3) — patch 의 첫 파일만.
//
// localStorage 영속화 — 사용자 선호도는 글로벌.

import { computed, ref, watch } from 'vue'

export type DiffMode = 'compact' | 'default' | 'context' | 'split'

const STORAGE_KEY = 'git-fried.diff-mode.v1'

function loadInitial(): DiffMode {
  if (typeof localStorage === 'undefined') return 'default'
  const v = localStorage.getItem(STORAGE_KEY)
  if (
    v === 'compact' ||
    v === 'default' ||
    v === 'context' ||
    v === 'split'
  ) {
    return v
  }
  return 'default'
}

const mode = ref<DiffMode>(loadInitial())

watch(mode, (v) => {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, v)
    } catch {
      /* ignore */
    }
  }
})

export function useDiffMode() {
  function setMode(m: DiffMode) {
    mode.value = m
  }

  /** git -U<n> 옵션 값. default 는 null (git 기본). split 은 default 와 동일. */
  const contextLines = computed<number | null>(() => {
    switch (mode.value) {
      case 'compact':
        return 0
      case 'default':
      case 'split':
        return null
      case 'context':
        return 25
    }
  })

  return {
    mode,
    setMode,
    contextLines,
  }
}

export const DIFF_MODE_LABELS: Record<DiffMode, string> = {
  compact: 'Hunk',
  default: 'Inline',
  context: 'Context',
  split: 'Split',
}
