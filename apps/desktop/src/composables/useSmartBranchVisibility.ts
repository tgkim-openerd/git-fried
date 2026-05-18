// SB-014 (UltraPlan v0.4 sidebar microgap Sprint c95, 2026-05-18) — Smart Branch
// Visibility (GitKraken parity S3 — gear icon → auto-filter "checked-out + merge
// target + upstreams").
//
// 큰 monorepo 환경 (50+ branch) 에서 수동 hide 부담 회피.
// 자동 visible set = HEAD + HEAD 의 upstream (origin/X) + mergeTarget + mergeTarget 의 upstream.
//
// 의존성 layering (Codex audit 합류):
//   - useHiddenRefs (persistent layer, DB 저장) — 사용자 명시 hide
//   - useSoloRef (session layer, in-memory) — 사용자 명시 solo
//   - useSmartBranchVisibility (computed layer, derived) — auto filter
//
// 우선순위: smart 는 가장 외곽 computed only — inner 2 layer 를 read 만, 덮어쓰지 않음.
// 즉 사용자가 명시 unhide 한 branch 는 smart 가 hide 안 함 (additive layer).
//
// Pattern 9 caller-decision: 본 composable 은 smart visible set 만 계산 + uiSettings 노출.
// 실제 sidebar 의 isVisible 판단은 caller (BranchPanel / MiniBranchList) — hidden ∧ ¬smartVisible.

import { computed, type ComputedRef } from 'vue'
import type { BranchInfo } from '@/api/git'
import { useUiSettingsStore } from '@/composables/useUserSettings'

/** Default merge target 후보 — auto-detect 시 첫 매칭 사용. */
const DEFAULT_MERGE_TARGETS = ['main', 'master', 'develop', 'trunk']

export interface SmartVisibilityApi {
  /** 현재 Smart Visibility 활성 여부 (uiSettings 기반). */
  enabled: ComputedRef<boolean>
  /** 효과적인 merge target name (사용자 설정 우선, 없으면 auto-detect). */
  effectiveTarget: ComputedRef<string | null>
  /** Smart visible set — HEAD + upstream + mergeTarget + mergeTarget upstream. */
  smartVisibleSet: ComputedRef<Set<string>>
  /** ref name 이 smart filter 통과인지. enabled=false 면 항상 true (no filtering). */
  isSmartVisible: (name: string) => boolean
}

export function useSmartBranchVisibility(
  branchesRef: ComputedRef<BranchInfo[] | undefined> | (() => BranchInfo[] | undefined),
): SmartVisibilityApi {
  const uiSettings = useUiSettingsStore()

  const branches = computed(() => {
    return typeof branchesRef === 'function' ? branchesRef() : branchesRef.value
  })

  const enabled = computed(() => uiSettings.value.smartBranchVisibility?.enabled === true)

  const effectiveTarget = computed<string | null>(() => {
    const explicit = uiSettings.value.smartBranchVisibility?.mergeTarget
    if (explicit && explicit.trim()) return explicit.trim()
    // Auto-detect — 첫 매칭 default target.
    const list = branches.value ?? []
    const names = new Set(list.filter((b) => b.kind === 'local').map((b) => b.name))
    for (const candidate of DEFAULT_MERGE_TARGETS) {
      if (names.has(candidate)) return candidate
    }
    return null
  })

  const smartVisibleSet = computed<Set<string>>(() => {
    const set = new Set<string>()
    const list = branches.value ?? []
    if (list.length === 0) return set

    // 1. 현재 checked-out branch (HEAD).
    const head = list.find((b) => b.isHead && b.kind === 'local')
    if (head) {
      set.add(head.name)
      // HEAD 의 upstream (예: origin/feat/x).
      if (head.upstream) set.add(head.upstream)
    }

    // 2. Merge target (main/master/develop 자동 감지 또는 사용자 설정).
    const target = effectiveTarget.value
    if (target) {
      set.add(target)
      // Merge target 의 upstream.
      const targetBranch = list.find((b) => b.kind === 'local' && b.name === target)
      if (targetBranch?.upstream) set.add(targetBranch.upstream)
    }

    return set
  })

  function isSmartVisible(name: string): boolean {
    // Smart filter 비활성 → 모든 ref visible (no-op).
    if (!enabled.value) return true
    return smartVisibleSet.value.has(name)
  }

  return {
    enabled,
    effectiveTarget,
    smartVisibleSet,
    isSmartVisible,
  }
}
