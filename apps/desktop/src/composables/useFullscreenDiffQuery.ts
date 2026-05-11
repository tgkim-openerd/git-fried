// Sprint c35 god 16/N — FullscreenDiffView.vue 의 patch query 영역 추출.
//
// 책임:
//   - useFullscreenDiff().current 의 source ('wip' / 'commit') 분기로 queryArgs 계산
//   - commit context 시 diffRev (parent..commit) 적용 — `git diff sha~..sha`
//     (working dir 비교 vs commit 변경 분리)
//   - patchQuery (getDiff IPC) — staleTime REALTIME
//   - hunkCount + hunkNavDisabled computed (헤더 ↑↓ 네비 disable)
//
// 부모 (FullscreenDiffView) 는 viewMode / DiffViewer ref / blame / file viewer 만 관리.
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { getDiff, readFile } from '@/api/git'
import { STALE_TIME } from '@/api/queryClient'
import { useFullscreenDiff } from '@/composables/useFullscreenDiff'
import { useStatus } from '@/composables/useStatus'

/**
 * Sprint c54+++ Issue 1 — untracked 파일 fake unified patch 생성.
 *
 * `git diff` 는 untracked 파일을 인식 못 함 (index 에 없으므로). backend `getDiff` 가 빈
 * string 반환 → "변경사항 없음" placeholder → 사용자가 untracked 파일 내용을 못 봄 (회귀).
 *
 * Frontend fallback: readFile 로 working dir 내용 fetch → 가짜 unified diff (`new file mode
 * 100644` + 모든 라인 `+` prefix) 생성. binary 감지 (null byte) 시 별도 placeholder.
 *
 * c64-A: export 추가 — 단위 테스트 (binary 감지 / 빈 파일 / 일반 케이스) 위해.
 */
export function buildUntrackedPatch(path: string, content: string): string {
  if (!content) {
    return `diff --git a/${path} b/${path}\nnew file mode 100644\n(empty file)\n`
  }
  // Binary 휴리스틱 — null byte 포함 시 (PNG / lock / etc.) text diff 부적절.
  if (content.includes('\0')) {
    return `diff --git a/${path} b/${path}\nnew file mode 100644\nBinary file (untracked) ${path}\n`
  }
  const lines = content.split('\n')
  // split 부산물 — 파일 끝 newline 시 empty 라인 제거.
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  const lineCount = lines.length
  const header = [
    `diff --git a/${path} b/${path}`,
    'new file mode 100644',
    '--- /dev/null',
    `+++ b/${path}`,
    `@@ -0,0 +1,${lineCount} @@`,
  ].join('\n')
  const body = lines.map((l) => '+' + l).join('\n')
  return `${header}\n${body}`
}

export function useFullscreenDiffQuery(repoId: () => number | null) {
  const fs = useFullscreenDiff()
  // Sprint c54+++ Issue 1 — untracked 판정 위해 status 참조.
  const { data: status } = useStatus(repoId)

  // WIP context 에서 path 가 status.untracked 에 포함되면 fake patch 생성.
  // staged 또는 commit context 는 backend `getDiff` 정상 작동.
  const isUntracked = computed(() => {
    const cur = fs.current.value
    if (!cur || cur.source !== 'wip' || cur.isStaged) return false
    return status.value?.untracked.includes(cur.path) ?? false
  })

  const queryArgs = computed(() => {
    const cur = fs.current.value
    const id = repoId()
    if (!cur || id == null) return null
    if (cur.source === 'wip') {
      return {
        repoId: id,
        staged: cur.isStaged,
        path: cur.path,
        rev: null as string | null,
      }
    }
    return {
      repoId: id,
      staged: false,
      path: cur.path,
      rev: cur.sha,
    }
  })

  // Phase 14-3 — diff query 전용 rev (parent..commit). File / Blame 쿼리는 단일 sha 유지.
  //   기존: getDiff(rev=sha) → backend `git diff sha -- path` = sha~working dir 비교 → 같으면 empty.
  //   변경: diff query 만 rev=`sha~..sha` → backend `git diff sha~..sha -- path` = 그 commit 의 파일 변경.
  //   (root commit 의 경우 ~ 없어서 git error — rare 케이스, fallback 추후.)
  const diffRev = computed<string | null>(() => {
    const cur = fs.current.value
    if (!cur || cur.source !== 'commit') return null
    return `${cur.sha}~..${cur.sha}`
  })

  const patchQuery = useQuery({
    queryKey: computed(() => {
      const a = queryArgs.value
      if (!a) return ['fullscreen-diff', 'idle'] as const
      // Phase 14-3 — commit context 시 diffRev (parent..commit) 사용.
      const rev = diffRev.value ?? a.rev
      // Sprint c54+++ Issue 1 — untracked 분기 시 별도 cache key.
      const u = isUntracked.value ? 'untracked' : 'tracked'
      return ['fullscreen-diff', a.repoId, a.staged, a.path, rev, u] as const
    }),
    queryFn: async () => {
      const a = queryArgs.value
      if (!a) return ''
      // Sprint c54+++ Issue 1 — untracked fallback: readFile + fake unified patch.
      // backend getDiff 는 untracked 빈 string 반환 → 사용자가 내용 못 봄.
      if (isUntracked.value) {
        try {
          const content = await readFile(a.repoId, a.path, null, false)
          return buildUntrackedPatch(a.path, content)
        } catch {
          // readFile 실패 (binary error / 권한 등) → backend getDiff fallback (empty 가능).
        }
      }
      const rev = diffRev.value ?? a.rev
      return getDiff({
        repoId: a.repoId,
        staged: a.staged,
        path: a.path,
        rev,
        context: 3,
      })
    },
    enabled: computed(() => queryArgs.value != null),
    staleTime: STALE_TIME.REALTIME,
  })

  // patch 의 hunk 헤더 카운트 — DiffViewer.hunkCount() 는 reactive 아님이므로 자체 셈.
  const hunkCount = computed(() => {
    const p = patchQuery.data.value
    if (!p) return 0
    return (p.match(/^@@\s/gm) ?? []).length
  })
  const hunkNavDisabled = computed(() => hunkCount.value <= 1)

  return {
    queryArgs,
    diffRev,
    patchQuery,
    hunkCount,
    hunkNavDisabled,
  }
}
