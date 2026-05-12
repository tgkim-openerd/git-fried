/**
 * Sprint c75-B — App.vue god comp 분리. modal 9개 state + open helper + closeAllModals.
 *
 * App.vue 가 관리하는 modal (자체 mount 모달, 단축키/Command Palette 진입):
 *   syncTemplate / bisect / reflog / repoSwitcher / createPr / help / commitSearch /
 *   compare (with initial ref1/ref2/mode args)
 *
 * 외부 등록된 modal trigger (InteractiveRebase, CommandPalette 자체 register) 는 여기서
 * 관리 안 함 — 각자 lifecycle 책임.
 */
import { ref } from 'vue'

export function useAppModals() {
  // Sync-template Modal — Command Palette / 추후 우클릭 메뉴에서 trigger.
  const syncTemplateOpen = ref(false)
  const syncTemplateInitialSha = ref<string | null>(null)
  function openSyncTemplate(sha?: string) {
    syncTemplateInitialSha.value = sha ?? null
    syncTemplateOpen.value = true
  }

  const bisectOpen = ref(false)
  const reflogOpen = ref(false)
  const repoSwitcherOpen = ref(false)
  const createPrOpen = ref(false)
  const helpOpen = ref(false)
  // Sprint F-P5 — Commit message 검색 modal (`git log --grep` 동등). ⌘⇧F.
  const commitSearchOpen = ref(false)

  // Sprint C3 — Compare modal + Sprint c38 fix MED-3 — initial mode (diff / range).
  const compareOpen = ref(false)
  const compareInitialRef1 = ref<string | null>(null)
  const compareInitialRef2 = ref<string | null>(null)
  const compareInitialMode = ref<'diff' | 'range'>('diff')
  function openCompare(
    ref1?: string | null,
    ref2?: string | null,
    mode: 'diff' | 'range' = 'diff',
  ) {
    compareInitialRef1.value = ref1 ?? null
    compareInitialRef2.value = ref2 ?? null
    compareInitialMode.value = mode
    compareOpen.value = true
  }

  /** ⌘W 로 일괄 닫기 — 7 modal 동시 close. 외부 등록 modal 은 자체 ESC 처리. */
  function closeAllModals() {
    syncTemplateOpen.value = false
    bisectOpen.value = false
    reflogOpen.value = false
    repoSwitcherOpen.value = false
    createPrOpen.value = false
    helpOpen.value = false
    commitSearchOpen.value = false
  }

  return {
    syncTemplateOpen,
    syncTemplateInitialSha,
    openSyncTemplate,
    bisectOpen,
    reflogOpen,
    repoSwitcherOpen,
    createPrOpen,
    helpOpen,
    commitSearchOpen,
    compareOpen,
    compareInitialRef1,
    compareInitialRef2,
    compareInitialMode,
    openCompare,
    closeAllModals,
  }
}
