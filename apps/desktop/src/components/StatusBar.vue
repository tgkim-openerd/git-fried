<script setup lang="ts">
// 하단 status bar — Sprint B2 (`docs/plan/11 §25`) + F2 (✨ AI 미리 해결).
//
// 인디케이터:
//   1. ▣ "Up to Date with <target>" 또는 ⚠ "Conflict in N files" — Conflict
//      Prediction (target-branch 한정, 로컬 fetch + merge-tree dry-run).
//      ⚠ 발생 시 옆에 ✨ 버튼으로 aiExplainBranch (head vs target) 호출.
//   2. Launchpad badge (활성 PR meta count — pinned + active snooze 외).
//   3. Sync 진행 (별도 SyncBar 가 상단에 있으니 여기는 prediction + Launchpad 만).
import { computed, ref, watch } from 'vue'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { aiExplainBranch, predictTargetConflict } from '@/api/git'
import { describeError } from '@/api/errors'
import { STALE_TIME } from '@/api/queryClient'
import { useReposStore } from '@/stores/repos'
import { useLaunchpadMeta } from '@/composables/useLaunchpadMeta'
import { useGeneralSettings } from '@/composables/useUserSettings'
import { useNotification } from '@/composables/useNotification'
import { useStatus } from '@/composables/useStatus'
import { useAiCli, confirmAiSend, notifyAiDone } from '@/composables/useAiCli'
import { dispatchShortcut, type ShortcutAction } from '@/composables/useShortcuts'
import AiResultModal from './AiResultModal.vue'

const store = useReposStore()
const meta = useLaunchpadMeta()
const general = useGeneralSettings()
const notification = useNotification()
const status = useStatus(() => store.activeRepoId)
const ai = useAiCli()

const predictionEnabled = computed(
  () => store.activeRepoId != null && general.value.conflictDetection,
)

const predictionQuery = useQuery({
  queryKey: computed(() => ['conflict-prediction', store.activeRepoId]),
  queryFn: () => {
    if (store.activeRepoId == null) {
      return Promise.resolve(null)
    }
    return predictTargetConflict(store.activeRepoId, null)
  },
  enabled: predictionEnabled,
  staleTime: STALE_TIME.STATIC,
  // refetchInterval 도 false 가능 — 설정 disabled 시 자동 정지.
  refetchInterval: computed(() => (predictionEnabled.value ? 60_000 : false)),
})

const prediction = computed(() => predictionQuery.data.value ?? null)

const launchpadCount = computed(() => meta.activeQuery.data.value?.length ?? 0)

// Sprint D3 — Conflict 상태 명확한 변화 (ok ↔ conflict) 시 OS notification.
let lastOk: boolean | null = null
watch(prediction, (next) => {
  if (!next) return
  const ok = next.ok
  if (lastOk !== null && lastOk !== ok) {
    if (!ok) {
      void notification.notify(
        '⚠ 충돌 발생 예측',
        `${next.target}: ${next.conflictFiles.length}개 파일`,
      )
    } else {
      void notification.notify('✓ 충돌 해소', `${next.target} 와 동기화 가능`)
    }
  }
  lastOk = ok
})

// Sprint F2 — ⚠ 옆 ✨ 버튼: 충돌 예상 영역 분석 (aiExplainBranch).
const explainOpen = ref(false)
const explainContent = ref('')
const explainError = ref<string | null>(null)

const explainMut = useMutation({
  mutationFn: () => {
    const repoId = store.activeRepoId
    const head = status.data.value?.branch ?? null
    const target = prediction.value?.target ?? null
    if (repoId == null || !head || !target) {
      return Promise.reject(new Error('레포/브랜치/target 미확정'))
    }
    if (ai.available.value == null) {
      return Promise.reject(new Error('Claude/Codex CLI 미설치'))
    }
    if (!confirmAiSend()) return Promise.reject(new Error('cancelled'))
    return aiExplainBranch(repoId, ai.available.value, head, target, true)
  },
  onSuccess: (out) => {
    if (out.success) {
      explainContent.value = out.text
      explainError.value = null
      const head = status.data.value?.branch ?? '?'
      const target = prediction.value?.target ?? '?'
      notifyAiDone('AI 충돌 미리보기', `${head} vs ${target}`)
    } else {
      explainContent.value = ''
      explainError.value = out.stderr || out.text || '응답 실패'
    }
  },
  onError: (e) => {
    const m = describeError(e)
    if (m.includes('cancelled')) {
      explainOpen.value = false
      return
    }
    explainContent.value = ''
    explainError.value = m
  },
})

function suggestResolution() {
  explainOpen.value = true
  explainContent.value = ''
  explainError.value = null
  explainMut.mutate()
}

// Phase 10-3 — 단축키 contextual hint (footer 중앙).
// macOS = ⌘, others = Ctrl. SSR-safe (navigator 미존재 → Ctrl).
const isMac = computed<boolean>(() => {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad/.test(navigator.platform)
})
const modKey = computed(() => (isMac.value ? '⌘' : 'Ctrl'))

interface ShortcutHint {
  combo: string
  label: string
  action?: ShortcutAction
}
const shortcutHints = computed<ShortcutHint[]>(() => [
  { combo: `${modKey.value}+P`, label: 'Palette' },
  { combo: `${modKey.value}+1~7`, label: 'View' },
  { combo: `${modKey.value}+K`, label: '우측', action: 'toggleDetail' },
  { combo: '?', label: '도움말', action: 'help' },
])
function onShortcutClick(h: ShortcutHint) {
  if (!h.action) return
  dispatchShortcut(h.action)
}
</script>

<template>
  <footer
    class="flex items-center gap-3 border-t border-border bg-muted/30 px-3 py-1 text-[11px] text-muted-foreground"
  >
    <!-- Conflict prediction -->
    <span v-if="store.activeRepoId == null">레포 미선택</span>
    <span
      v-else-if="predictionQuery.isFetching.value && !prediction"
      class="text-muted-foreground/70"
    >
      target 충돌 예측 중...
    </span>
    <span
      v-else-if="prediction?.note && prediction.ok && prediction.conflictFiles.length === 0"
      class="text-muted-foreground/70"
      :title="prediction.note"
    >
      ⓘ 예측 불가 ({{ prediction.target }})
    </span>
    <span
      v-else-if="prediction?.ok"
      class="text-emerald-500"
      :title="`merge-tree 시뮬레이션 결과 충돌 없음 (target=${prediction.target})`"
    >
      ▣ Up to Date with {{ prediction.target }}
    </span>
    <span
      v-else-if="prediction"
      class="text-amber-500"
      :title="prediction.conflictFiles.join('\n')"
    >
      ⚠ Conflict in {{ prediction.conflictFiles.length }} 파일 ({{ prediction.target }})
    </span>
    <button
      v-if="prediction && !prediction.ok && ai.available.value && status.data.value?.branch"
      type="button"
      class="rounded border border-border px-1.5 py-0.5 text-[10px] text-amber-500 hover:bg-accent/40 disabled:opacity-50"
      :disabled="explainMut.isPending.value"
      :title="`✨ ${ai.available.value} — 충돌 예상 영역 분석 (${status.data.value.branch} vs ${prediction.target})`"
      :aria-label="`AI (${ai.available.value}) — 충돌 예상 분석`"
      @click="suggestResolution"
    >
      ✨ {{ explainMut.isPending.value ? '...' : 'AI' }}
    </button>

    <!-- Phase 10-3 — 단축키 hint (중앙). action 매핑된 항목은 클릭 시 dispatchShortcut. -->
    <div
      class="ml-auto flex items-center gap-2 text-[10px] opacity-70 hover:opacity-100"
      data-testid="status-bar-shortcuts"
    >
      <button
        v-for="h in shortcutHints"
        :key="h.combo"
        type="button"
        class="flex items-center gap-1 rounded transition-colors"
        :class="h.action ? 'cursor-pointer hover:text-foreground' : 'cursor-default'"
        :disabled="!h.action"
        :title="h.action ? `${h.combo} — ${h.label} (클릭 가능)` : `${h.combo} — ${h.label}`"
        @click="onShortcutClick(h)"
      >
        <kbd
          class="rounded border border-border bg-muted/50 px-1 py-0 font-mono text-[9px] tracking-tight"
        >
          {{ h.combo }}
        </kbd>
        <span>{{ h.label }}</span>
      </button>
    </div>

    <!-- Launchpad badge -->
    <RouterLink
      v-if="launchpadCount > 0"
      to="/launchpad"
      class="rounded border border-border px-1.5 py-0.5 hover:bg-accent/40"
      title="Launchpad — pinned + 활성 snooze"
      :aria-label="`Launchpad — ${launchpadCount}개 pinned + 활성 snooze PR`"
    >
      ⭐💤 {{ launchpadCount }}
    </RouterLink>
  </footer>

  <AiResultModal
    :open="explainOpen"
    title="충돌 예상 영역 분석"
    :content="explainContent"
    :loading="explainMut.isPending.value"
    :error="explainError"
    @close="explainOpen = false"
  />
</template>
