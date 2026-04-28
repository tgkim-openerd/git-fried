<script setup lang="ts">
// Sprint 22-17 E-1 — Skeleton 단위 블록 (design 04 §4-2).
//
// loading 상태에서 LoadingSpinner 보다 영역 점유 시각이 안정적인 placeholder.
// 사용처:
//   - BranchPanel / PrPanel / StashPanel / IssuesPanel ... 의 row list 로딩
//   - CommitGraph row (별도 sprint, virtualizer 영향 큼)
//
// props:
//   - count: 반복 개수 (기본 4)
//   - height: row 높이 ('sm' = 16px / 'md' = 24px / 'lg' = 32px)
//   - widthRange: 각 row 의 width % range (default: 50% ~ 95%, deterministic seed = i)
//
// design 04 §4-2:
//   - background: muted token
//   - animate-pulse (Tailwind)
//   - duration 1.5s (Tailwind 기본)
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    count?: number
    height?: 'sm' | 'md' | 'lg'
    widthRange?: [number, number]
  }>(),
  {
    count: 4,
    height: 'md',
    widthRange: () => [50, 95],
  },
)

const heightClass = computed(() => {
  switch (props.height) {
    case 'sm':
      return 'h-4'
    case 'lg':
      return 'h-8'
    case 'md':
    default:
      return 'h-6'
  }
})

// deterministic width per index — random 보다 페이지 reload 시 안정적.
function widthFor(idx: number): string {
  const [min, max] = props.widthRange
  const range = max - min
  // sin 기반 pseudo-noise (idx 다른 위상)
  const noise = (Math.sin(idx * 12.9898) + 1) / 2 // 0~1
  const w = min + noise * range
  return `${w.toFixed(0)}%`
}
</script>

<template>
  <div
    class="flex flex-col gap-2"
    role="status"
    aria-label="로딩 중..."
    aria-live="polite"
  >
    <div
      v-for="i in count"
      :key="i"
      class="rounded bg-muted animate-pulse"
      :class="heightClass"
      :style="{ width: widthFor(i - 1) }"
    />
    <span class="sr-only">데이터 불러오는 중...</span>
  </div>
</template>
