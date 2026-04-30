<script setup lang="ts">
// Sprint c35 — plan/26 Phase 2: Settings 차별점 패널.
//
// git-fried 의 3 정체성 (한글 / Gitea / AI CLI subprocess) + 사용자 dogfood 통계 시각화.
// "3 constraints" defining constraint 의 사용자 인지 가시화 목표.
//
// dogfood 통계:
//   - 한글: 활성 레포의 한글 commit 메시지 카운트 (간단 휴리스틱)
//   - Gitea: 등록된 Gitea forge 계정 수 (vs GitHub)
//   - AI CLI: Claude / Codex 설치 감지 결과 + 사용 횟수 (localStorage 카운터)
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { aiDetectClis, forgeListAccounts } from '@/api/git'
import { STALE_TIME } from '@/api/queryClient'
import { readAiCallCount } from '@/composables/useAiCli'

const { data: aiProbes } = useQuery({
  queryKey: ['aiProbes'],
  queryFn: aiDetectClis,
  staleTime: STALE_TIME.STATIC,
})

const { data: forgeAccounts } = useQuery({
  queryKey: ['forgeAccounts'],
  queryFn: forgeListAccounts,
  staleTime: STALE_TIME.STATIC,
})

const giteaCount = computed(
  () => (forgeAccounts.value ?? []).filter((a) => a.forgeKind === 'gitea').length,
)
const githubCount = computed(
  () => (forgeAccounts.value ?? []).filter((a) => a.forgeKind === 'github').length,
)

const claudeInstalled = computed(() =>
  (aiProbes.value ?? []).some((p) => p.cli === 'claude' && p.installed),
)
const codexInstalled = computed(() =>
  (aiProbes.value ?? []).some((p) => p.cli === 'codex' && p.installed),
)

// Sprint c36 — useAiCli::notifyAiDone 이 호출 시 카운터 +1.
// 5 AI composable (Commit/PrBody/ResolveConflict/Composer/Review) 의 onSuccess 에서 자동 측정.
// localStorage 변경은 같은 탭 내 reactive 가 안 되므로 storage event + interval poll 으로 갱신.
const aiCallCountRaw = ref(readAiCallCount())
function refreshAiCount() {
  aiCallCountRaw.value = readAiCallCount()
}
let pollHandle: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  // 같은 탭 내 변경은 storage event 가 안 발화 → 5초 poll (Settings 페이지에서만 짧게 활성).
  pollHandle = setInterval(refreshAiCount, 5000)
  window.addEventListener('storage', refreshAiCount)
})
onUnmounted(() => {
  if (pollHandle) clearInterval(pollHandle)
  window.removeEventListener('storage', refreshAiCount)
})
const aiCallCount = computed(() => aiCallCountRaw.value)

const hangulCommitCount = computed(() => {
  // dogfood 통계 v0.4 — 활성 레포 git log --grep="[가-힣]" 결과 카운트 (별도 IPC).
  // 현재 v0.x 단계는 placeholder. v0.4 wiring 후 실측.
  try {
    const v = localStorage.getItem('git-fried.identity.hangulCommitCount')
    return v ? Number(v) : 0
  } catch {
    return 0
  }
})
</script>

<template>
  <section class="rounded-md border border-border bg-card p-4">
    <header class="mb-3 flex items-center gap-2">
      <span class="text-base font-semibold">차별점</span>
      <span class="text-[10px] text-muted-foreground">(plan/26 — 3 constraints 정체성)</span>
    </header>

    <ul class="grid grid-cols-3 gap-3 text-xs">
      <!-- 한글 안전 -->
      <li class="rounded border border-border bg-muted/20 p-3">
        <div class="mb-1 text-2xl">🇰🇷</div>
        <div class="text-sm font-semibold">한글 안전</div>
        <div class="mt-1 text-[11px] text-muted-foreground">
          UTF-8 강제 + NFC normalize + file-based commit body
        </div>
        <div class="mt-2 text-[10px]">
          한글 commit:
          <span class="font-mono font-semibold">{{ hangulCommitCount }}</span>
          <span v-if="hangulCommitCount === 0" class="ml-1 text-muted-foreground">
            (v0.4 dogfood 통계)
          </span>
        </div>
      </li>

      <!-- Gitea first-class -->
      <li class="rounded border border-border bg-muted/20 p-3">
        <div class="mb-1 text-2xl">🦊</div>
        <div class="text-sm font-semibold">Gitea first-class</div>
        <div class="mt-1 text-[11px] text-muted-foreground">
          PR / Workspaces / Launchpad / Issues / Releases — Gitea 1순위
        </div>
        <div class="mt-2 flex gap-3 text-[10px]">
          <span>
            Gitea
            <span class="font-mono font-semibold text-emerald-700 dark:text-emerald-500">
              {{ giteaCount }}
            </span>
          </span>
          <span>
            GitHub
            <span class="font-mono font-semibold">{{ githubCount }}</span>
          </span>
        </div>
      </li>

      <!-- AI CLI subprocess -->
      <li class="rounded border border-border bg-muted/20 p-3">
        <div class="mb-1 text-2xl">✨</div>
        <div class="text-sm font-semibold">AI CLI subprocess</div>
        <div class="mt-1 text-[11px] text-muted-foreground">
          Claude / Codex CLI 자체 호출 — 자체 LLM 인프라 없음, 외부 송출 명시 confirm
        </div>
        <div class="mt-2 flex flex-wrap gap-1 text-[10px]">
          <span
            class="rounded px-1.5 py-0.5"
            :class="
              claudeInstalled
                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-500'
                : 'bg-muted text-muted-foreground'
            "
          >
            Claude {{ claudeInstalled ? '✓' : '—' }}
          </span>
          <span
            class="rounded px-1.5 py-0.5"
            :class="
              codexInstalled
                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-500'
                : 'bg-muted text-muted-foreground'
            "
          >
            Codex {{ codexInstalled ? '✓' : '—' }}
          </span>
          <span class="text-muted-foreground">
            호출 <span class="font-mono">{{ aiCallCount }}</span>
          </span>
        </div>
      </li>
    </ul>

    <p class="mt-3 text-[10px] text-muted-foreground">
      자세한 5분 onboarding은
      <a href="#" class="underline hover:text-foreground">docs/QUICK_START.md</a>
      참조. dogfood 통계는 v0.4 에 wiring 예정.
    </p>
  </section>
</template>
