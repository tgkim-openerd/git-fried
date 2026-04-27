<script setup lang="ts">
// 공용 LoadingSpinner — `docs/plan/22 §5 Q-4`.
//
// 사용 패턴:
//   <LoadingSpinner v-if="query.isFetching.value" label="불러오는 중..." />
//   <LoadingSpinner size="sm" />
//   <LoadingSpinner inline label="저장 중" />
//
// size: sm | md | lg
// inline: true 면 inline-flex (버튼 안에 사용)
withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg'
    label?: string
    inline?: boolean
  }>(),
  {
    size: 'md',
    label: '',
    inline: false,
  },
)

const sizeClassMap = {
  sm: 'h-3 w-3 border',
  md: 'h-5 w-5 border-2',
  lg: 'h-8 w-8 border-2',
} as const

const labelSizeMap = {
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
} as const
</script>

<template>
  <div
    :class="
      inline
        ? 'inline-flex items-center gap-1.5'
        : 'flex items-center justify-center gap-2 p-2'
    "
    role="status"
    :aria-label="label || '로딩 중'"
  >
    <span
      class="inline-block animate-spin rounded-full border-muted-foreground/30 border-t-primary"
      :class="sizeClassMap[size]"
    />
    <span
      v-if="label"
      class="text-muted-foreground"
      :class="labelSizeMap[size]"
    >
      {{ label }}
    </span>
  </div>
</template>
