// Diff 3-mode 토글 — Sprint B1 (`docs/plan/11 §7`).
//
// GitKraken 의 Hunk / Inline / Split 모드 흡수. Split (side-by-side) 은 v1.x
// (CodeMirror MergeView 통합 필요). v1 은 컨텍스트 라인 수 토글:
//   - compact: -U0  (변경 라인만, GitKraken Hunk 와 동등)
//   - default: -U3  (git 기본, GitKraken Inline 의 보통 컨텍스트)
//   - context: -U25 (더 많은 컨텍스트, 큰 파일은 거의 전체 보임)
//
// localStorage 영속화 — 사용자 선호도는 글로벌 (per-repo 시나리오 약함).

import { computed, ref, watch } from 'vue'

export type DiffMode = 'compact' | 'default' | 'context'

const STORAGE_KEY = 'git-fried.diff-mode.v1'

function loadInitial(): DiffMode {
  if (typeof localStorage === 'undefined') return 'default'
  const v = localStorage.getItem(STORAGE_KEY)
  if (v === 'compact' || v === 'default' || v === 'context') return v
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

  /** git -U<n> 옵션 값. default 는 null (git 기본). */
  const contextLines = computed<number | null>(() => {
    switch (mode.value) {
      case 'compact':
        return 0
      case 'default':
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
}
