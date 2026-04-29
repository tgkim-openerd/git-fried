// Sprint c30 / GitKraken UX (Phase 3) — Fullscreen Diff View singleton state.
//
// 파일 row 더블클릭 시 좌측 graph 영역 전체를 DiffViewer 로 전환.
// useToast 와 동일한 module-scope ref 싱글톤 패턴 (createGlobalState 미사용).
//
// 데이터 model:
//   working dir 변경: { source: 'wip', path, isStaged }
//   특정 commit 의 파일: { source: 'commit', sha, path }
//
// 사용:
//   const fs = useFullscreenDiff()
//   fs.openWip(path, isStaged)   // StatusPanel FileRow @dblclick
//   fs.openCommit(sha, path)     // CommitDetailSidebar file @dblclick
//   fs.close()                   // 닫기 X / ESC
//
// index.vue 가 fs.current 를 watch 해 fullscreen layout 진입.

import { readonly, ref } from 'vue'

export type FullscreenDiffState =
  | { source: 'wip'; path: string; isStaged: boolean }
  | { source: 'commit'; sha: string; path: string }

const _state = ref<FullscreenDiffState | null>(null)

function openWip(path: string, isStaged: boolean): void {
  _state.value = { source: 'wip', path, isStaged }
}

function openCommit(sha: string, path: string): void {
  _state.value = { source: 'commit', sha, path }
}

function close(): void {
  _state.value = null
}

export function useFullscreenDiff() {
  return {
    current: readonly(_state),
    openWip,
    openCommit,
    close,
  }
}
