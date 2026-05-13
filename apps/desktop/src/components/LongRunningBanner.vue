<script setup lang="ts">
// Long-running operation banner (Sprint E-4 / docs/plan/24 §7-1).
//
// 30초 넘는 IPC 작업이 있을 때 우상단에 표시. 단계별 색상/메시지:
//   - over30s (30s~1m): subtle amber — "오래 걸리고 있습니다"
//   - over1m  (1m~4m):  amber emphasized — "장시간 작업 진행 중"
//   - over4m  (4m+):    red — "매우 오래 걸리고 있습니다"
//
// 다중 작업이면 가장 오래된 작업 표시 + 추가 카운트 배지.
// invokeWithTimeout 가 long-running prefix 자동 감지 → useLongRunningProgress 등록.

import { computed } from 'vue'
import { useLongRunningProgress } from '@/composables/useLongRunningProgress'

const { visibleOperations, dohertyOperations } = useLongRunningProgress()

const oldest = computed(() => visibleOperations.value[0] ?? null)
const extraCount = computed(() => Math.max(0, visibleOperations.value.length - 1))

// v0.5 #14 — Doherty stage 만 별도 micro spinner 영역.
// 큰 banner 가 idle 일 때만 표시 (over30s+ 가 active 면 큰 banner 우선).
const dohertyCount = computed(() => dohertyOperations.value.length)
const showDohertyMicro = computed(() => oldest.value == null && dohertyCount.value > 0)

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return m > 0 ? `${m}분 ${s}초` : `${s}초`
}

const stageMessage = computed(() => {
  if (!oldest.value) return ''
  // v0.4 #8 — doherty / idle stage 는 큰 banner 표시 안 함 (Doherty 단계는 micro spinner 영역).
  // default 가 doherty/idle 흡수 — case 명시 불필요.
  switch (oldest.value.stage) {
    case 'over30s':
      return '평소보다 오래 걸리고 있습니다'
    case 'over1m':
      return '장시간 작업 진행 중'
    case 'over4m':
      return '매우 오래 걸리고 있습니다 — 네트워크/디스크 확인 권장'
    default:
      return ''
  }
})

const stageClasses = computed(() => {
  if (!oldest.value) return ''
  switch (oldest.value.stage) {
    case 'over30s':
      return 'border-amber-500/40 bg-amber-500/5 text-amber-200'
    case 'over1m':
      return 'border-amber-500/70 bg-amber-500/10 text-amber-100'
    case 'over4m':
      return 'border-red-500/70 bg-red-500/10 text-red-100 animate-pulse'
    default:
      return ''
  }
})
</script>

<template>
  <!-- 큰 banner (over30s+) -->
  <Transition name="fade">
    <div
      v-if="oldest && stageMessage"
      role="status"
      aria-live="polite"
      :class="[
        'fixed right-4 top-14 z-40 flex max-w-md items-start gap-3 rounded-md border px-3 py-2 text-xs shadow-lg backdrop-blur',
        stageClasses,
      ]"
    >
      <span
        class="mt-0.5 inline-block h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-current"
      />
      <div class="flex-1 leading-relaxed">
        <div class="font-semibold">{{ stageMessage }}</div>
        <div class="mt-0.5 truncate font-mono text-[10px] opacity-80">
          {{ oldest.label }} · {{ formatElapsed(oldest.elapsedMs) }}
        </div>
        <div v-if="extraCount > 0" class="mt-0.5 text-[10px] opacity-70">
          외 {{ extraCount }}개 작업 진행 중
        </div>
      </div>
    </div>
  </Transition>

  <!-- v0.5 #14 (UltraPlan plan/31) — Doherty micro spinner (큰 banner idle 시만).
       Doherty Threshold (400ms+) 초과 작업 1+ 시 표시. role=status + aria-live=polite. -->
  <Transition name="fade">
    <div
      v-if="showDohertyMicro"
      role="status"
      aria-live="polite"
      class="fixed right-4 top-14 z-30 flex items-center gap-2 rounded-md border border-border bg-card/80 px-2 py-1 text-[10px] text-muted-foreground shadow backdrop-blur"
    >
      <span class="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      <span>처리 중{{ dohertyCount > 1 ? ` · ${dohertyCount}` : '' }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
