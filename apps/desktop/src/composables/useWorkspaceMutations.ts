// Workspace 편집 (create / update / delete) 통합 composable.
// Sidebar.vue 의 워크스페이스 편집 영역을 추출 (Sidebar God comp 분리, Sprint c29-2).
//
// 책임:
// - 신규 워크스페이스 form state (name / color)
// - 편집 중인 workspace id
// - 3 mutation (create / update / delete) + invalidation
// - tryCreate / confirmDelete helper
//
// Sidebar.vue 는 이 composable 호출 후 form binding 만 담당.

import { computed, ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { createWorkspace, deleteWorkspace, updateWorkspace } from '@/api/git'
import type { Workspace } from '@/types/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useReposStore } from '@/stores/repos'
import { confirmDialog } from '@/composables/useConfirm'
import { i18n } from '@/i18n'

const t = i18n.global.t

export const WORKSPACE_COLOR_PRESETS = [
  '#0ea5e9', // sky
  '#22c55e', // green
  '#f59e0b', // amber
  '#a78bfa', // violet
  '#f43f5e', // rose
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#ef4444', // red
  '#6b7280', // gray
] as const

const DEFAULT_COLOR = WORKSPACE_COLOR_PRESETS[0]

export function useWorkspaceMutations(workspaces: () => Workspace[] | undefined) {
  const qc = useQueryClient()
  const toast = useToast()
  const store = useReposStore()

  const newName = ref('')
  const newColor = ref<string>(DEFAULT_COLOR)
  const editingId = ref<number | null>(null)

  const createMut = useMutation({
    mutationFn: () => createWorkspace(newName.value.trim(), newColor.value),
    onSuccess: () => {
      newName.value = ''
      qc.invalidateQueries({ queryKey: ['workspaces'] })
    },
    onError: (e) => toast.error(t('errors.workspaceCreateFailed'), describeError(e)),
  })

  const updateMut = useMutation({
    mutationFn: ({
      id,
      name,
      color,
    }: {
      id: number
      name?: string | null
      color?: string | null
    }) => updateWorkspace(id, name, color),
    onSuccess: () => {
      editingId.value = null
      qc.invalidateQueries({ queryKey: ['workspaces'] })
    },
    onError: (e) => toast.error(t('errors.workspaceUpdateFailed'), describeError(e)),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteWorkspace(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces'] })
      qc.invalidateQueries({ queryKey: ['repos'] })
      if (store.activeWorkspaceId != null) store.setActiveWorkspace(null)
    },
    onError: (e) => toast.error(t('errors.workspaceDeleteFailed'), describeError(e)),
  })

  const activeWorkspace = computed(() =>
    workspaces()?.find((w) => w.id === store.activeWorkspaceId),
  )

  function tryCreate() {
    if (newName.value.trim()) createMut.mutate()
  }

  async function confirmDelete(): Promise<void> {
    const w = activeWorkspace.value
    if (!w) return
    const ok = await confirmDialog({
      title: t('confirm.deleteWorkspaceTitle'),
      message: t('confirm.deleteWorkspaceMessage', { name: w.name }),
      danger: true,
    })
    if (ok) {
      deleteMut.mutate(w.id)
    }
  }

  return {
    // state
    newName,
    newColor,
    editingId,
    // mutations
    createMut,
    updateMut,
    deleteMut,
    // derived
    activeWorkspace,
    // helpers
    tryCreate,
    confirmDelete,
    // constants
    colorPresets: WORKSPACE_COLOR_PRESETS,
  }
}
