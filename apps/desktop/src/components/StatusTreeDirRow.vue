<script setup lang="ts">
// Sprint c89-B Backlog 4.1 (plan/35 §6.3 template-LOC god) — StatusPanel template
// 4 위치 dir row 중복 (staged / unstaged / untracked / conflicted) 의 SOT 추출.
//
// Pattern 14 (domain prefix) + Pattern 12 (uniformity exception qualifier):
//   - 3 그룹 동일 default variant (muted-foreground hover:bg-accent/30)
//   - 1 그룹 destructive variant (text-destructive hover:bg-destructive/10)
//
// 변경 시 단일 SOT — Pattern 11 group collapse 가 inline 으론 안 됐던 영역.

import { useI18n } from 'vue-i18n'

const props = defineProps<{
  /** 디렉토리 깊이 (들여쓰기 12px × depth + 4px) */
  depth: number
  /** 접힘 상태 (▶ 접힘 / ▼ 펼침) */
  collapsed: boolean
  /** 디렉토리 마지막 component (예: `src`) */
  name: string
  /** 디렉토리 전체 경로 (toggle 시 emit + tooltip) */
  path: string
  /** conflict 그룹은 destructive variant — text-destructive / hover bg destructive/10 */
  variant?: 'default' | 'destructive'
}>()

const emit = defineEmits<{
  toggle: [path: string]
}>()

const { t } = useI18n()

function onToggle() {
  emit('toggle', props.path)
}
</script>

<template>
  <li
    :class="[
      'flex cursor-pointer select-none items-center gap-1 rounded px-1 py-0.5',
      variant === 'destructive' ? 'text-destructive hover:bg-destructive/10' : 'hover:bg-accent/30',
    ]"
    :style="{ paddingLeft: `${depth * 12 + 4}px` }"
    :title="t('status.dirToggleTitle', { path })"
    @click="onToggle"
  >
    <span :class="['text-[10px]', variant === 'destructive' ? '' : 'text-muted-foreground']">
      {{ collapsed ? '▶' : '▼' }}
    </span>
    <span
      :class="['font-mono text-[11px]', variant === 'destructive' ? '' : 'text-muted-foreground']"
    >
      {{ name }}/
    </span>
  </li>
</template>
