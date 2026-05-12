/**
 * Sprint c75-C — pages/index.vue inline diff visibility + maximize 영속화 분리.
 *
 * Sprint c25-4.5: inline diff panel 좌측 vertical split (row click → selectedSha set → 자동 노출).
 * localStorage 키:
 *   'git-fried.inline-diff.visible'   ('0' 이면 닫힘, default 열림)
 *   'git-fried.inline-diff.maximized' ('1' 이면 maximized, default 일반)
 *
 * sentinel WIP_SHA 는 inline diff 대상 아님 — caller 가 선택 sha 와 함께 inlineDiffActive
 * computed 를 만든다 (caller-decision API).
 */
import { ref } from 'vue'

const INLINE_DIFF_KEY = 'git-fried.inline-diff.visible'
const INLINE_DIFF_MAX_KEY = 'git-fried.inline-diff.maximized'

function loadInlineDiff(): boolean {
  if (typeof localStorage === 'undefined') return true
  return localStorage.getItem(INLINE_DIFF_KEY) !== '0'
}
function loadInlineDiffMax(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(INLINE_DIFF_MAX_KEY) === '1'
}

export function useInlineDiffPersist() {
  const inlineDiffVisible = ref(loadInlineDiff())
  function setInlineDiff(visible: boolean) {
    inlineDiffVisible.value = visible
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(INLINE_DIFF_KEY, visible ? '1' : '0')
    }
  }

  const inlineDiffMaximized = ref(loadInlineDiffMax())
  function toggleInlineDiffMaximize() {
    inlineDiffMaximized.value = !inlineDiffMaximized.value
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(INLINE_DIFF_MAX_KEY, inlineDiffMaximized.value ? '1' : '0')
    }
  }

  return {
    inlineDiffVisible,
    setInlineDiff,
    inlineDiffMaximized,
    toggleInlineDiffMaximize,
  }
}
