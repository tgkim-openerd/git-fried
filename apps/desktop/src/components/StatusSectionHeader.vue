<script setup lang="ts">
// Sprint c30 / HIGH 1 — StatusPanel 4 섹션 (Staged / Modified / Untracked / Conflicted)
// 의 sticky header 패턴 추출. 단, list 본체는 섹션마다 다른 row 액션을 가지므로
// StatusPanel.vue 에 그대로 둠. 본 컴포넌트는 header 만 담당.
//
// 4 섹션 매핑:
//   Staged    — bulkLabel="모두 unstage" + ⌘⇧U 단축키 힌트
//   Modified  — bulkLabel="모두 stage"
//   Untracked — bulk 없음
//   Conflicted — bulk 없음 + destructive (text-destructive)
//
// UI 보존 원칙:
//   - sticky top-0 z-10 + 우클릭 = 접기/펴기 동작 동일
//   - 클릭 영역: outer div + inner span 둘 다 토글 (UX 동등)
//   - "모두 X" 버튼은 click.stop 으로 outer 토글 차단
defineProps<{
  title: string
  count: number
  collapsed: boolean
  bulkLabel?: string
  bulkTitle?: string
  bulkAriaLabel?: string
  /** Conflicted 섹션의 빨간색 헤더 사용. */
  destructive?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:collapsed', v: boolean): void
  (e: 'bulk'): void
}>()

function toggle(current: boolean) {
  emit('update:collapsed', !current)
}
</script>

<template>
  <div
    class="sticky top-0 z-10 mb-1 flex cursor-pointer select-none items-center justify-between border-b border-border/40 bg-card"
    title="우클릭 = 섹션 접기/펴기"
    @contextmenu.prevent="toggle(collapsed)"
    @click="toggle(collapsed)"
  >
    <span
      class="text-xs uppercase tracking-wider"
      :class="destructive ? 'text-destructive' : 'text-muted-foreground'"
    >
      {{ collapsed ? '▶' : '▼' }} {{ title }} ({{ count }})
    </span>
    <button
      v-if="bulkLabel"
      type="button"
      class="text-xs text-muted-foreground hover:text-foreground"
      :title="bulkTitle"
      :aria-label="bulkAriaLabel"
      @click.stop="emit('bulk')"
    >
      {{ bulkLabel }}
    </button>
  </div>
</template>
