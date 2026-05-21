// Sprint c79-B — BranchPanel 194 → <150 LOC 잠복 god comp 추출.
//
// 3 mutation (switch/create/delete) + 3 handler (onSwitch/onCreate/onDelete) 통합.
// caller-decision: 입력 ref (newBranchName) 는 caller 가 보유, 본 composable 은 mutate 만 담당.
//
// 책임:
//   - switchMut / createMut / deleteMut 의 useMutation 정의 + onSuccess invalidate + onError toast
//   - onSwitch (HEAD guard) / onCreate (newName trim guard) / onDelete (force confirm)
//
// 패턴 정착 (c60 useStashPopMutation / useStageMutations / usePrMutations 와 동일).
import { type Ref, type MaybeRefOrGetter, toRef } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { createBranch, deleteBranch, switchBranch, type BranchInfo } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { confirmDialog } from '@/composables/useConfirm'
import { useI18n } from 'vue-i18n'

interface UseBranchPanelMutationsOpts {
  /** repoId getter — null 시 모든 액션 noop */
  repoId: MaybeRefOrGetter<number | null>
  /** 신규 브랜치 이름 입력 ref — onCreate 성공 시 빈 문자열로 reset (caller 가 v-model) */
  newBranchName: Ref<string>
  /** B4-07 — 신규 브랜치 base ref 입력 ref (선택, 비우면 현재 HEAD 기준) */
  newBranchBase?: Ref<string>
}

/**
 * `origin/foo` → `foo` (remote → local 작업명)
 */
export function localName(name: string): string {
  const parts = name.split('/')
  if (parts.length > 1) return parts.slice(1).join('/')
  return name
}

export function useBranchPanelMutations(opts: UseBranchPanelMutationsOpts) {
  const { t } = useI18n()
  const toast = useToast()
  const invalidate = useInvalidateRepoQueries()
  const repoId = toRef(opts.repoId)

  const switchMut = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => switchBranch(id, name, false),
    onSuccess: () => invalidate(repoId.value),
    onError: (e) => toast.error(t('branch.toastSwitchFailed'), describeError(e)),
  })

  const createMut = useMutation({
    mutationFn: ({ id, name, start }: { id: number; name: string; start?: string }) =>
      createBranch(id, name, start),
    onSuccess: () => {
      opts.newBranchName.value = ''
      if (opts.newBranchBase) opts.newBranchBase.value = ''
      invalidate(repoId.value)
    },
    onError: (e) => toast.error(t('branch.toastCreateFailed'), describeError(e)),
  })

  const deleteMut = useMutation({
    mutationFn: ({ id, name, force }: { id: number; name: string; force: boolean }) =>
      deleteBranch(id, name, force),
    onSuccess: () => invalidate(repoId.value),
    onError: (e) => toast.error(t('branch.toastDeleteFailed'), describeError(e)),
  })

  function onSwitch(b: BranchInfo) {
    const id = repoId.value
    if (id == null) return
    if (b.isHead) return
    switchMut.mutate({ id, name: localName(b.name) })
  }

  function onCreate() {
    const id = repoId.value
    if (id == null) return
    const name = opts.newBranchName.value.trim()
    if (!name) return
    const start = opts.newBranchBase?.value.trim() || undefined
    createMut.mutate({ id, name, start })
  }

  async function onDelete(b: BranchInfo) {
    const id = repoId.value
    if (id == null) return
    const force = b.ahead > 0
    const ok = await confirmDialog({
      title: t('confirm.deleteBranchTitle'),
      message:
        t('confirm.deleteBranchMessage', { name: b.name }) +
        (force ? '\n⚠ ' + t('confirm.deleteBranchForceHint') : ''),
      danger: true,
    })
    if (!ok) return
    deleteMut.mutate({ id, name: localName(b.name), force })
  }

  // useBranchDragDrop 가 caller 로부터 switchAsync 받음 → mutate Async 직접 노출.
  const switchAsync = (id: number, name: string) => switchMut.mutateAsync({ id, name })

  // mutation 객체 자체도 노출 — template 에서 isPending 등 reactive state 접근.
  return { onSwitch, onCreate, onDelete, switchAsync, switchMut, createMut, deleteMut }
}
