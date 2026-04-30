<script setup lang="ts">
// Sprint c31 / plan/24 Sprint B Tooltip primitive — reka-ui Tooltip wrapper.
//
// 사용:
//   <BaseTooltip text="Undo (⌘Z)" placement="bottom">
//     <button>...</button>
//   </BaseTooltip>
//
// 또는 keyboard hint 명시:
//   <BaseTooltip text="이전 hunk" kbd="Alt+↑" placement="top">
//     <button>↑</button>
//   </BaseTooltip>
//
// 기본 동작:
//   - hover 200ms delay 후 표시 (사용자 잠시 머물 때만)
//   - keyboard focus 시 즉시 표시 (a11y)
//   - ESC 로 dismiss
//   - viewport edge 자동 회피 (reka-ui 내장)
//
// design: plan/24 §3 Sprint B / docs/design-context/04-interaction-patterns.md
import {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipPortal,
  TooltipContent,
  TooltipArrow,
} from 'reka-ui'

withDefaults(
  defineProps<{
    text: string
    /** 추가 키보드 hint (예: "⌘Z" / "Alt+↑"). 표시되면 ` · ${kbd}` 형식. */
    kbd?: string
    /** 'top' | 'right' | 'bottom' | 'left' (default 'top') */
    placement?: 'top' | 'right' | 'bottom' | 'left'
    /** hover delay (ms). default 200. focus 는 즉시. */
    delay?: number
    /** disabled 시 tooltip 자체 비활성화 (a11y — disabled trigger 는 tooltip 안 띄움 권장) */
    disabled?: boolean
  }>(),
  {
    placement: 'top',
    delay: 200,
    disabled: false,
  },
)
</script>

<template>
  <TooltipProvider :delay-duration="delay" disable-hoverable-content>
    <TooltipRoot v-if="!disabled">
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :side="placement"
          :side-offset="6"
          class="z-50 max-w-xs rounded border border-border bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-popover"
          role="tooltip"
        >
          <span>{{ text }}</span>
          <span v-if="kbd" class="ml-1 text-muted-foreground"> · {{ kbd }}</span>
          <TooltipArrow class="fill-popover" :width="8" :height="4" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
    <slot v-else />
  </TooltipProvider>
</template>
