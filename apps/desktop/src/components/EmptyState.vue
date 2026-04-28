<script setup lang="ts">
// 공용 EmptyState — `docs/plan/22 §5 Q-4`.
//
// 사용 패턴:
//   <EmptyState icon="📭" title="PR 없음" description="현재 브랜치에 열린 PR 이 없습니다." />
//   <EmptyState icon="🌳" title="브랜치 없음">
//     <template #action>
//       <button @click="createBranch">+ 새 브랜치</button>
//     </template>
//   </EmptyState>
withDefaults(
  defineProps<{
    icon?: string
    title: string
    description?: string
    /** size: 'sm' (compact panel) | 'md' (default) */
    size?: 'sm' | 'md'
  }>(),
  {
    icon: '',
    description: '',
    size: 'md',
  },
)
</script>

<template>
  <div
    class="flex flex-col items-center justify-center text-center"
    :class="size === 'sm' ? 'gap-1 p-4' : 'gap-2 p-8'"
    role="status"
  >
    <div
      v-if="icon"
      :class="size === 'sm' ? 'text-2xl' : 'text-4xl opacity-60'"
      aria-hidden="true"
    >
      {{ icon }}
    </div>
    <p
      class="font-semibold text-foreground"
      :class="size === 'sm' ? 'text-xs' : 'text-sm'"
    >
      {{ title }}
    </p>
    <p
      v-if="description"
      class="text-muted-foreground"
      :class="size === 'sm' ? 'text-[10px]' : 'text-xs'"
    >
      {{ description }}
    </p>
    <div v-if="$slots.action" class="mt-2">
      <slot name="action" />
    </div>
  </div>
</template>
