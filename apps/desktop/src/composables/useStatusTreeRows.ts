// Sprint c40 god comp 분리 — StatusPanel.vue (715 LOC) 의 4 tree row
// computed (staged/unstaged/untracked/conflicted) + mergetool mutation
// 통합 (/analyze 후속).
//
// 책임:
//   - viewMode='tree' 시 4 섹션 각각 buildPathTree → flattenTree
//   - mergetoolMut + onLaunchMergetool (외부 merge tool 실행)
//
// 사용:
//   const { stagedTreeRows, unstagedTreeRows, untrackedTreeRows,
//           conflictedTreeRows, mergetoolMut, onLaunchMergetool } =
//     useStatusTreeRows({
//       repoId: () => props.repoId,
//       status, viewMode, collapsedDirs,
//       filteredStaged, filteredUnstaged, filteredUntracked, filteredConflicted,
//     })
//
// LOC 절감: StatusPanel 126-147 + 179-205 = ~50 LOC → ~10 LOC destructure.
import { computed, type ComputedRef, type Ref } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { launchMergetool } from '@/api/git'
import type { FileChange } from '@/types/git'
import { describeError, humanizeGitError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { flattenTree, type FlatTreeRow, type ViewMode } from '@/composables/useStatusTreeView'
import { buildPathTree } from '@/utils/pathTree'
import { useI18n } from 'vue-i18n'

export type FileChangeTreeRow = FlatTreeRow<FileChange>
export type StringTreeRow = FlatTreeRow<string>

export interface UseStatusTreeRowsOptions {
  repoId: () => number | null
  // status 는 useStatusTreeRows 가 직접 보지 않음 (filtered* 가 SoT) — Reserved.
  viewMode: Ref<ViewMode>
  collapsedDirs: Ref<Set<string>> | ComputedRef<Set<string>>
  filteredStaged: ComputedRef<readonly FileChange[]>
  filteredUnstaged: ComputedRef<readonly FileChange[]>
  filteredUntracked: ComputedRef<readonly string[]>
  filteredConflicted: ComputedRef<readonly string[]>
}

export function useStatusTreeRows(opts: UseStatusTreeRowsOptions) {
  const { t } = useI18n()
  const toast = useToast()
  const invalidate = useInvalidateRepoQueries()

  const stagedTreeRows = computed<FileChangeTreeRow[]>(() => {
    if (opts.viewMode.value !== 'tree') return []
    const items = opts.filteredStaged.value.map((f) => ({ path: f.path, meta: f }))
    const tree = buildPathTree(items, { collapseSingleChild: true })
    return flattenTree(tree, opts.collapsedDirs.value)
  })

  const unstagedTreeRows = computed<FileChangeTreeRow[]>(() => {
    if (opts.viewMode.value !== 'tree') return []
    const items = opts.filteredUnstaged.value.map((f) => ({ path: f.path, meta: f }))
    const tree = buildPathTree(items, { collapseSingleChild: true })
    return flattenTree(tree, opts.collapsedDirs.value)
  })

  const untrackedTreeRows = computed<StringTreeRow[]>(() => {
    if (opts.viewMode.value !== 'tree') return []
    const items = opts.filteredUntracked.value.map((p) => ({ path: p, meta: p }))
    const tree = buildPathTree(items, { collapseSingleChild: true })
    return flattenTree(tree, opts.collapsedDirs.value)
  })

  const conflictedTreeRows = computed<StringTreeRow[]>(() => {
    if (opts.viewMode.value !== 'tree') return []
    const items = opts.filteredConflicted.value.map((p) => ({ path: p, meta: p }))
    const tree = buildPathTree(items, { collapseSingleChild: true })
    return flattenTree(tree, opts.collapsedDirs.value)
  })

  // Sprint C6 — 외부 merge tool launch.
  const mergetoolMut = useMutation({
    mutationFn: ({ p }: { p: string }) => {
      const id = opts.repoId()
      if (id == null) return Promise.reject(new Error('no repo'))
      return launchMergetool(id, p, null)
    },
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('status.mergetoolDoneTitle'), '')
        invalidate(opts.repoId())
      } else {
        toast.error(
          t('status.mergetoolFailedTitle'),
          humanizeGitError(res.stderr) || `exit ${res.exitCode}`,
        )
      }
    },
    onError: (e) => toast.error(t('status.mergetoolErrorTitle'), describeError(e)),
  })

  function onLaunchMergetool(p: string) {
    if (opts.repoId() == null) return
    mergetoolMut.mutate({ p })
  }

  return {
    stagedTreeRows,
    unstagedTreeRows,
    untrackedTreeRows,
    conflictedTreeRows,
    mergetoolMut,
    onLaunchMergetool,
  }
}
