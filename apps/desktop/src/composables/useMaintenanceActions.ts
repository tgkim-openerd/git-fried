// settings.vue 에서 추출 (2026-05-04 /analyze 후속).
// `gc` / `fsck` / `lfs install` 3 mutation + 진행 상태 + 결과 표시 헬퍼.
//
// 사용:
//   const m = useMaintenanceActions()
//   m.gcMut.mutate(false)     // git gc
//   m.confirmAggressiveGc()   // git gc --aggressive --prune=now (확인)
//   m.fsckMut.mutate()
//   m.lfsInstallMut.mutate()
//   m.maintLabel / m.maintResult 로 출력 표시.
//
// 의존: useReposStore (active repo) / useToast / useI18n / confirmDialog.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation } from '@tanstack/vue-query'
import { useReposStore } from '@/stores/repos'
import { useToast } from '@/composables/useToast'
import { confirmDialog } from '@/composables/useConfirm'
import { lfsInstall, maintenanceFsck, maintenanceGc, type MaintenanceResult } from '@/api/git'
import { describeError } from '@/api/errors'

export function useMaintenanceActions() {
  const reposStore = useReposStore()
  const toast = useToast()
  const { t } = useI18n()

  const maintResult = ref<MaintenanceResult | null>(null)
  const maintLabel = ref<string>('')

  function onMaintenanceDone(label: string, r: MaintenanceResult) {
    maintLabel.value = label
    maintResult.value = r
    if (r.success) {
      toast.success(`${label} 완료`, '')
    } else {
      toast.warning(`${label} 비정상 종료`, `exit=${r.exitCode ?? '?'}`)
    }
  }

  const gcMut = useMutation({
    mutationFn: (aggressive: boolean) => {
      if (reposStore.activeRepoId == null) throw new Error(t('errors.noRepo'))
      return maintenanceGc(reposStore.activeRepoId, aggressive)
    },
    onSuccess: (r, aggressive) =>
      onMaintenanceDone(aggressive ? 'git gc --aggressive --prune=now' : 'git gc', r),
    onError: (e) => toast.error('git gc 실패', describeError(e)),
  })

  const fsckMut = useMutation({
    mutationFn: () => {
      if (reposStore.activeRepoId == null) throw new Error(t('errors.noRepo'))
      return maintenanceFsck(reposStore.activeRepoId)
    },
    onSuccess: (r) => onMaintenanceDone('git fsck --full', r),
    onError: (e) => toast.error('git fsck 실패', describeError(e)),
  })

  async function confirmAggressiveGc() {
    const ok = await confirmDialog({
      title: t('confirm.aggressiveGcTitle'),
      message: t('confirm.aggressiveGcMessage'),
    })
    if (ok) {
      gcMut.mutate(true)
    }
  }

  const lfsInstallMut = useMutation({
    mutationFn: () => {
      if (reposStore.activeRepoId == null) throw new Error(t('errors.noRepo'))
      return lfsInstall(reposStore.activeRepoId)
    },
    onSuccess: () => {
      maintLabel.value = 'git lfs install'
      maintResult.value = {
        success: true,
        stdout: 'LFS hooks 등록 완료',
        stderr: '',
        exitCode: 0,
      }
      toast.success('LFS 초기화', 'pre-push hook 등록')
    },
    onError: (e) => toast.error('LFS 초기화 실패', describeError(e)),
  })

  return {
    maintResult,
    maintLabel,
    gcMut,
    fsckMut,
    lfsInstallMut,
    confirmAggressiveGc,
  }
}
