// Sprint c37 god comp 분리 20/N — StatusPanel.vue 의 selectedPath + vim nav 분리.
//
// 책임:
//   - selectedPath state (단일 토글 / 명시 set)
//   - selectPath(path) — 토글 (키보드 단축키용)
//   - pickStageTarget / pickUnstageTarget — vim S/U 우선순위 결정
//     (selectedPath 우선, 없으면 unstaged / staged 첫 항목)
//   - useShortcut('stageCurrent' / 'unstageCurrent' / 'stageAllExplicit' / 'unstageAll' /
//     'fileHistorySearch') 등록
//   - copyPath(path) — clipboard 복사 + toast
//
// 사용:
//   const sel = useStatusSelection({
//     repoId: () => props.repoId,
//     status,
//     stageMut, unstageMut, stageAllMut,
//     openHistory,
//   })
//
// LOC 절감: StatusPanel 88-95 + 163-226 = 약 80 LOC.
import { ref, type Ref } from 'vue'
import type { UseMutationReturnType } from '@tanstack/vue-query'
import { useShortcut } from '@/composables/useShortcuts'
import { useToast } from '@/composables/useToast'
import { describeError } from '@/api/errors'
import type { RepoStatus } from '@/types/git'
import { i18n } from '@/i18n'

const t = i18n.global.t

type StagePathsMut = UseMutationReturnType<
  unknown,
  unknown,
  { id: number; paths: string[] },
  unknown
>
type StageAllMut = UseMutationReturnType<unknown, unknown, number, unknown>

export interface UseStatusSelectionOptions {
  repoId: () => number | null
  status: Ref<RepoStatus | undefined>
  stageMut: StagePathsMut
  unstageMut: StagePathsMut
  stageAllMut: StageAllMut
  openHistory: (path: string) => void
}

export interface UseStatusSelectionReturn {
  selectedPath: Ref<string | null>
  selectPath: (path: string) => void
  copyPath: (path: string) => Promise<void>
}

export function useStatusSelection(options: UseStatusSelectionOptions): UseStatusSelectionReturn {
  const { repoId, status, stageMut, unstageMut, stageAllMut, openHistory } = options
  const toast = useToast()

  const selectedPath = ref<string | null>(null)

  function selectPath(path: string) {
    selectedPath.value = selectedPath.value === path ? null : path
  }

  async function copyPath(path: string) {
    try {
      await navigator.clipboard.writeText(path)
      toast.success(t('statusSelection.pathCopied'), path)
    } catch (e) {
      toast.error(t('errors.copyFailed'), describeError(e))
    }
  }

  // Vim S/U — 현재 선택된 파일 stage / unstage (Sprint A2).
  // 우선순위:
  //   1. 명시적 클릭으로 selectedPath 가 있으면 그 파일.
  //   2. unstage list 첫 파일 (stage S 의 일반 케이스).
  //   3. staged list 첫 파일 (unstage U 의 일반 케이스).
  function pickStageTarget(): string | null {
    if (selectedPath.value) {
      // staged 에 있으면 이미 stage 됨 → 다음 unstaged 행으로.
      if (status.value?.staged.some((f) => f.path === selectedPath.value)) {
        return status.value?.unstaged[0]?.path ?? status.value?.untracked[0] ?? null
      }
      return selectedPath.value
    }
    return status.value?.unstaged[0]?.path ?? status.value?.untracked[0] ?? null
  }

  function pickUnstageTarget(): string | null {
    if (selectedPath.value) {
      if (status.value?.unstaged.some((f) => f.path === selectedPath.value)) {
        return status.value?.staged[0]?.path ?? null
      }
      return selectedPath.value
    }
    return status.value?.staged[0]?.path ?? null
  }

  useShortcut('stageCurrent', () => {
    const id = repoId()
    if (id == null) return
    const target = pickStageTarget()
    if (!target) return
    stageMut.mutate({ id, paths: [target] })
  })

  useShortcut('unstageCurrent', () => {
    const id = repoId()
    if (id == null) return
    const target = pickUnstageTarget()
    if (!target) return
    unstageMut.mutate({ id, paths: [target] })
  })

  // Sprint B5 — ⌘⇧S / ⌘⇧U 일괄, ⌘⇧H 첫 unstaged 의 file history.
  useShortcut('stageAllExplicit', () => {
    const id = repoId()
    if (id != null) stageAllMut.mutate(id)
  })

  useShortcut('unstageAll', () => {
    const id = repoId()
    if (id == null) return
    const paths = (status.value?.staged ?? []).map((f) => f.path)
    if (paths.length === 0) return
    unstageMut.mutate({ id, paths })
  })

  useShortcut('fileHistorySearch', () => {
    // 현재 selected 또는 첫 번째 unstaged/staged 의 history.
    const target =
      selectedPath.value ?? status.value?.unstaged[0]?.path ?? status.value?.staged[0]?.path ?? null
    if (target) openHistory(target)
  })

  return {
    selectedPath,
    selectPath,
    copyPath,
  }
}
