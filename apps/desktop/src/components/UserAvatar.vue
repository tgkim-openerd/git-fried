<script setup lang="ts">
// 사용자 아바타 — Settings 의 avatarStyle (initial / gravatar) 따라 분기.
//
// - initial: username 첫 글자 + 안정적 hash-color.
// - gravatar: ForgeAuthor.avatarUrl 사용 (forge 가 이미 Gravatar / GitHub
//   avatar URL 제공). 미설정 또는 로드 실패 시 initial 로 fallback.
import { computed, ref } from 'vue'
import { useUiSettingsStore } from '@/composables/useUserSettings'

const props = defineProps<{
  username: string
  /** Forge 가 제공하는 avatar URL (있으면 gravatar 모드에서 사용). */
  avatarUrl?: string | null
  /** w-{n} h-{n} 같은 Tailwind 폭/높이. 기본 w-5 h-5. */
  sizeClass?: string
}>()

const settings = useUiSettingsStore()
const imgError = ref(false)

const useImage = computed(
  () =>
    settings.value.avatarStyle === 'gravatar' &&
    !!props.avatarUrl &&
    !imgError.value,
)

const initial = computed(() => {
  const u = props.username || '?'
  // 한글 한 글자 / 영문 1~2자.
  const first = u.charAt(0).toUpperCase()
  return first
})

/** username hash → 9 색 중 하나 (안정). */
const hashColor = computed(() => {
  const palette = [
    '#0ea5e9',
    '#22c55e',
    '#f59e0b',
    '#a78bfa',
    '#f43f5e',
    '#10b981',
    '#06b6d4',
    '#ef4444',
    '#6b7280',
  ]
  const u = props.username || ''
  let h = 0
  for (let i = 0; i < u.length; i++) {
    h = (h * 31 + u.charCodeAt(i)) | 0
  }
  return palette[Math.abs(h) % palette.length]
})

const sizeCls = computed(() => props.sizeClass ?? 'w-5 h-5')
</script>

<template>
  <span
    :class="[
      sizeCls,
      'inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-semibold uppercase text-white align-middle',
    ]"
    :style="useImage ? undefined : { backgroundColor: hashColor }"
    :title="username"
  >
    <img
      v-if="useImage"
      :src="avatarUrl ?? ''"
      :alt="username"
      :class="[sizeCls, 'rounded-full object-cover']"
      @error="imgError = true"
    />
    <span v-else>{{ initial }}</span>
  </span>
</template>
