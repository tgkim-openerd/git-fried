// Sprint c54+++ — Mini sidebar (LOCAL/REMOTE) 우클릭 컨텍스트 메뉴 helper.
//
// Pattern 9 caller-decision **변형 (delegate sister)** — c52 useTagInteraction / c53 useRemoteInteraction
// 와 책임 layout 차이:
//   - 1st/2nd sister (Tag/Remote): composable 이 자체 액션 보유 (deleteTagLocal / removeRemoteSafely 등)
//   - 3rd sister (Branch): useBranchActions 에 모든 액션 위임 + state (hide/solo) 만 흡수.
//     본 wrapper 는 onContextMenu 1 함수만 export — buildItems delegate + ctxMenu.openAt thin wrapper.
//
// 적용 조건 (delegate sister 변형 — vue3-composable-extraction skill 후보):
//   1. 위임 대상 composable 이 self-contained (모든 액션 + 콘피그러블 callbacks)
//   2. caller 별 boilerplate (state 주입 / hide·solo 콜백 wiring) 가 반복
//   3. caller LOC −80% 이상 절감
//
// 책임:
//   - composable: ContextMenu items 빌드 (useBranchActions.buildItems delegate) + hide/solo state 흡수
//   - caller (Mini*): ctxMenu ref + repoId getter 만 주입. compare 는 optional.
//
// GitKraken parity 격차 해소 (사용자 보고 c54+++):
//   기존: MiniBranchList / MiniRemoteBranchList 우클릭 시 컨텍스트 메뉴 0건 — BranchPanel 전체 진입 후만 가능.
//   현재: 사이드바 직접 우클릭 → 20 액션 (Checkout / Branch ops / Merge·Rebase / Worktree / Cherry pick /
//        Reset ▶ / Tag 2 / Push·Upstream / Visibility / Compare / Copy 4) 메뉴 표시.
//
// 사용 예시:
//   const ctxMenu = useTemplateRef<ContextMenuExpose>('ctxMenu')
//   const { onBranchContextMenu } = useBranchInteraction({
//     ctxMenu,
//     repoId: () => store.activeRepoId,
//   })
//   <li @contextmenu="onBranchContextMenu($event, branchInfo)">...</li>
//   <ContextMenu ref="ctxMenu" />
import type { Ref } from 'vue'
import { useBranchActions } from '@/composables/useBranchActions'
import { useRefVisibility } from '@/composables/useHiddenRefs'
import { useGraphRefVisibility } from '@/composables/useGraphRefVisibility'
import type { BranchInfo } from '@/api/git'
import type { ContextMenuExpose } from '@/components/ContextMenu.vue'

interface UseBranchInteractionOpts {
  /** ContextMenu 컴포넌트 ref (template ref) */
  ctxMenu: Ref<ContextMenuExpose | null>
  /** repoId getter (`() => store.activeRepoId`) — null 시 액션 noop + toast warning */
  repoId: () => number | null
  /** Compare 콜백 (optional — BranchPanel 만 fullscreen compare 지원, Mini* 는 미지원 OK) */
  onCompare?: (branch: BranchInfo) => void
}

export function useBranchInteraction(opts: UseBranchInteractionOpts) {
  const branchActions = useBranchActions(opts.repoId)
  // hide/solo state — useRefVisibility (hidden set) + useGraphRefVisibility (toggle helpers).
  const { hiddenSet, soloRef } = useRefVisibility(opts.repoId)
  const { hideRefByName, toggleSoloRef } = useGraphRefVisibility(opts.repoId)

  function onBranchContextMenu(ev: MouseEvent, branch: BranchInfo) {
    ev.preventDefault()
    ev.stopPropagation()
    const items = branchActions.buildItems(branch, {
      isHidden: (name) => hiddenSet.value.has(name),
      isSolo: (name) => soloRef.value === name,
      onToggleHide: (br) => hideRefByName(br.name),
      onToggleSolo: (br) => toggleSoloRef(br.name),
      onCompare: opts.onCompare,
    })
    opts.ctxMenu.value?.openAt(ev, items)
  }

  return { onBranchContextMenu }
}
