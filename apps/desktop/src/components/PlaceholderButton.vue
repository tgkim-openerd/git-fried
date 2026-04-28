<script setup lang="ts">
// Sprint 22-12 E-9 — v0.4 placeholder 패턴 (design §8-4 hard constraint).
//
// 🔜 v0.4 / v1.0 예정 기능 placeholder 표시 정책:
//   - disabled 회색 + cursor-not-allowed
//   - 우상단 작은 ETA 뱃지 ("v0.4")
//   - title attribute 로 hover hint ("v0.4 예정 — {detail}")
//   - 클릭 시 toast.info ("이 기능은 v0.4 에서 추가됩니다 — 진행 상황은 plan/05 참조")
//
// 사용 예:
//   <PlaceholderButton label="OAuth 로그인" eta="v1.5" detail="GitHub OAuth + Custom URL scheme" />
//   <PlaceholderButton label="Cloud sync" eta="v0.4" icon="☁" />
//
// design §8-4 거부 정책 (❌ skip 기능, ~10개) 은 본 컴포넌트로 표시 X — 화면에 등장 자체 금지.
// 본 컴포넌트는 ✅ 흡수 예정 (🔜) 에만 사용.
import { computed } from 'vue'
import { useToast } from '@/composables/useToast'

const props = withDefaults(
  defineProps<{
    /** 버튼 라벨 (예: "OAuth 로그인"). */
    label: string
    /** 예정 버전 (예: "v0.4", "v0.5", "v1.0", "v1.5"). */
    eta?: string
    /** hover 시 추가 detail (선택, 예: "GitHub OAuth + Custom URL scheme"). */
    detail?: string
    /** 좌측 아이콘 (선택, 1 글자 이모지 권장). */
    icon?: string
    /** 사이즈: sm (기본 — Sidebar / panel) / md (Settings 카테고리) */
    size?: 'sm' | 'md'
    /** click 시 toast.info 표시 여부 (기본 true). */
    showToast?: boolean
  }>(),
  {
    eta: 'v0.4',
    detail: undefined,
    icon: undefined,
    size: 'sm',
    showToast: true,
  },
)

const toast = useToast()

const tooltip = computed(() => {
  const lines: string[] = [`🔜 ${props.eta} 예정`]
  if (props.detail) lines.push(props.detail)
  lines.push('진행 상황: docs/plan/05-roadmap-v0.1-v1.0.md')
  return lines.join('\n')
})

function onClick() {
  if (!props.showToast) return
  toast.info(
    `${props.label} — ${props.eta} 예정`,
    `이 기능은 ${props.eta} 에서 추가됩니다.\n진행 상황은 docs/plan/05 (roadmap) 참조.`,
  )
}
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border text-muted-foreground/70 cursor-not-allowed select-none"
    :class="
      size === 'md'
        ? 'px-3 py-1.5 text-sm'
        : 'px-2 py-1 text-xs'
    "
    :title="tooltip"
    :aria-label="`${label} (${eta} 예정)`"
    @click="onClick"
  >
    <span v-if="icon" class="opacity-60">{{ icon }}</span>
    <span class="opacity-80">{{ label }}</span>
    <span
      class="ml-0.5 rounded bg-muted px-1 py-0.5 text-[10px] font-bold uppercase tracking-wider opacity-90"
    >
      🔜 {{ eta }}
    </span>
  </button>
</template>
