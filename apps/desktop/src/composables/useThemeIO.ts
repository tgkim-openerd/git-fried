// settings.vue 에서 추출 (2026-05-04 /analyze 후속).
// Custom theme JSON export / import / reset / 클립보드 복사.
//
// 사용:
//   const io = useThemeIO()
//   io.exportText.value          // bind to <textarea readonly>
//   io.importText.value          // bind to <textarea>
//   io.onExport()                // 현재 theme → exportText 채움
//   io.onImport()                // importText 적용
//   io.onReset()                 // 기본 dark/light 복원
//   io.onCopy()                  // exportText 클립보드 복사
//
// 의존: useCustomTheme / useToast.
import { ref } from 'vue'
import { useCustomTheme } from '@/composables/useCustomTheme'
import { useToast } from '@/composables/useToast'
import { i18n } from '@/i18n'

const t = i18n.global.t

export function useThemeIO() {
  const ctheme = useCustomTheme()
  const toast = useToast()
  const importText = ref('')
  const exportText = ref('')

  function onExport() {
    exportText.value = ctheme.exportJson()
  }

  function onImport() {
    const r = ctheme.importJson(importText.value)
    if (r.ok) {
      toast.success(t('toast.themeApplied'), t('themeIO.appliedBody'))
      importText.value = ''
    } else {
      toast.error(t('errors.themeImportFailed'), r.error || '?')
    }
  }

  function onReset() {
    ctheme.reset()
    toast.success(t('toast.themeReset'), t('themeIO.resetBody'))
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(exportText.value)
      toast.success(t('themeIO.clipboardCopy'), '')
    } catch {
      toast.error(t('errors.copyFailed'), '')
    }
  }

  return {
    importText,
    exportText,
    onExport,
    onImport,
    onReset,
    onCopy,
  }
}
