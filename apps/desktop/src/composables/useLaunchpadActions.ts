// Sprint c40 god comp 분리 — launchpad.vue (570 LOC) 의 snooze 메뉴 + saved
// views 영역을 composable 로 추출. (/analyze 후속 — useLaunchpadMeta /
// useLaunchpadFilter / useLaunchpadRows 와 동일 패턴).
//
// 책임:
//   - togglePin (pin 토글 + onError toast)
//   - SNOOZE_OPTIONS 4종 + snoozeMenuFor ref + openSnoozeMenu / applySnooze /
//     unsnooze
//   - saveCurrentView / applyView (saved views v1 UI)
//   - rowKey 생성 (forgeKind|owner|repo|number)
//
// 사용:
//   const { togglePin, SNOOZE_OPTIONS, snoozeMenuFor, openSnoozeMenu,
//           applySnooze, unsnooze, newViewName, saveCurrentView, applyView,
//           rowKey } = useLaunchpadActions({
//     meta, savedViews, stateFilterRef, showBotsRef, tabRef,
//   })
//
// LOC 절감: launchpad.vue script 영역 96-167 (~ 70 LOC) → ~15 LOC destructure.
import { ref, type Ref } from 'vue'
import type { PrState, PullRequest } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import type { useLaunchpadMeta, useSavedViews } from '@/composables/useLaunchpadMeta'

export interface SnoozeOption {
  label: string
  sec: number
}

export const SNOOZE_OPTIONS: SnoozeOption[] = [
  { label: '1시간', sec: 3600 },
  { label: '하루', sec: 86400 },
  { label: '일주일', sec: 604800 },
  { label: '한 달', sec: 2592000 },
]

export interface RowLike {
  pr: PullRequest
}

export type Tab = 'active' | 'pinned' | 'snoozed'

export interface UseLaunchpadActionsOptions {
  meta: ReturnType<typeof useLaunchpadMeta>
  savedViews: ReturnType<typeof useSavedViews>
  stateFilterRef: Ref<PrState | null>
  showBotsRef: Ref<boolean>
  tabRef: Ref<Tab>
}

export function useLaunchpadActions(opts: UseLaunchpadActionsOptions) {
  const toast = useToast()
  const { meta, savedViews, stateFilterRef, showBotsRef, tabRef } = opts

  function rowKey(row: RowLike): string {
    return `${row.pr.forgeKind}|${row.pr.owner}|${row.pr.repo}|${row.pr.number}`
  }

  function togglePin(pr: PullRequest) {
    meta.pinMut.mutate(
      { pr, pinned: !meta.isPinned(pr) },
      {
        onError: (e) => toast.error('Pin 실패', describeError(e)),
      },
    )
  }

  const snoozeMenuFor = ref<string | null>(null)
  function openSnoozeMenu(row: RowLike) {
    const k = rowKey(row)
    snoozeMenuFor.value = snoozeMenuFor.value === k ? null : k
  }
  function applySnooze(row: RowLike, opt: SnoozeOption) {
    meta.snoozeFor(row.pr, opt.sec)
    snoozeMenuFor.value = null
  }
  function unsnooze(row: RowLike) {
    meta.clearSnooze(row.pr)
  }

  const newViewName = ref('')
  function saveCurrentView() {
    const name = newViewName.value.trim()
    if (!name) return
    const filterJson = JSON.stringify({
      state: stateFilterRef.value,
      showBots: showBotsRef.value,
      tab: tabRef.value,
    })
    savedViews.saveMut.mutate(
      { name, filterJson },
      {
        onSuccess: () => {
          toast.success('View 저장', name)
          newViewName.value = ''
        },
        onError: (e) => toast.error('View 저장 실패', describeError(e)),
      },
    )
  }
  function applyView(v: { filterJson: string }) {
    try {
      const obj = JSON.parse(v.filterJson) as {
        state?: PrState | null
        showBots?: boolean
        tab?: Tab
      }
      if (obj.state !== undefined) stateFilterRef.value = obj.state
      if (obj.showBots !== undefined) showBotsRef.value = obj.showBots
      if (obj.tab !== undefined) tabRef.value = obj.tab
    } catch {
      /* ignore */
    }
  }

  return {
    togglePin,
    snoozeMenuFor,
    openSnoozeMenu,
    applySnooze,
    unsnooze,
    newViewName,
    saveCurrentView,
    applyView,
    rowKey,
  }
}
