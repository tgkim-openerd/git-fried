// "// WIP" 텍스트박스 — Sprint J (`docs/plan/11 §28`).
//
// 사용자가 "지금 작업 중인 내용" 을 한 줄로 적어두면, stash 시 메시지로 자동
// prefill. GitKraken 의 그래프 상단 WIP 라벨 흡수.
//
// 영속: per-repo localStorage. key = `git-fried.wip.<repoId>`.
import { ref, watch, type Ref } from 'vue'

const cache = new Map<number, Ref<string>>()

function load(repoId: number): string {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(`git-fried.wip.${repoId}`) ?? ''
}

function save(repoId: number, v: string) {
  if (typeof localStorage === 'undefined') return
  try {
    if (v) localStorage.setItem(`git-fried.wip.${repoId}`, v)
    else localStorage.removeItem(`git-fried.wip.${repoId}`)
  } catch {
    /* ignore */
  }
}

/**
 * 활성 레포의 WIP 노트 ref. 같은 repoId 는 동일 ref 공유 (stash panel ↔
 * graph 상단 banner 가 양방향 동기화).
 */
export function useWipNote(repoId: number): Ref<string> {
  let r = cache.get(repoId)
  if (!r) {
    r = ref(load(repoId))
    watch(r, (v) => save(repoId, v))
    cache.set(repoId, r)
  }
  return r
}

/** stash push 성공 후 호출 — 의도가 stash 로 옮겨진 셈이니 클리어. */
export function clearWipNote(repoId: number) {
  const r = cache.get(repoId)
  if (r) r.value = ''
  else save(repoId, '')
}
