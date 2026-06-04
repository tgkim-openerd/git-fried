<script setup lang="ts">
// Sprint c89-A — CommitGraph template-LOC god 추출 (Pattern 14 도메인 prefix).
// 동일 ref-pill 블록이 CommitGraph 안에 3 위치 (sticky overlay / branchTag column / message column)
// 에서 24+ 라인씩 중복되어 있었음. 단일 책임 컴포넌트로 SOT 화.
//
// Sprint c52/c51 — GitKraken parity refs UI:
//  - body: ref 이름 + Solo toggle (single-click)
//  - hide button (🙈): hover 시에만 노출 (.ref-pill-hide opacity 0 → 1)

defineProps<{
  /** ref 이름 (branch / tag / HEAD detached SHA short) */
  name: string
  /** 현재 Solo 활성 ref (단일). 일치 시 Solo 해제 UX. */
  soloRef: string | null
  /** refPillClass(name) 결과 — kind 별 색상 (branch/local/remote/tag/HEAD). */
  pillClass: string
  /** 외부 spacing 추가 (예: message column 의 'ml-1.5'). */
  extraClass?: string
  /** false 시 shrink-0 미적용 (message column 내 inline flow 허용). */
  shrink?: boolean
}>()

const emit = defineEmits<{
  solo: [name: string]
  hide: [name: string]
}>()

function onSolo(name: string) {
  emit('solo', name)
}
function onHide(name: string) {
  emit('hide', name)
}
</script>

<template>
  <span
    class="ref-pill inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-3xs whitespace-nowrap"
    :class="[pillClass, extraClass, shrink !== false ? 'shrink-0' : '']"
  >
    <button
      type="button"
      class="ref-pill-body max-w-[9rem] cursor-pointer truncate hover:underline"
      :title="
        soloRef === name
          ? `Solo 해제: ${name}`
          : `이 ref 만 표시 (Solo): ${name}\n🙈 = 그래프에서 숨김`
      "
      :aria-label="soloRef === name ? `'${name}' Solo 해제` : `'${name}' 만 그래프에 표시`"
      @click.stop="onSolo(name)"
    >
      {{ name }}
    </button>
    <button
      type="button"
      class="ref-pill-hide opacity-0 transition-opacity hover:text-foreground"
      :title="`그래프에서 숨김: ${name}`"
      :aria-label="`'${name}' 그래프에서 숨김`"
      @click.stop="onHide(name)"
    >
      🙈
    </button>
  </span>
</template>

<style scoped>
/* Sprint K — branch ref hover 시에만 🙈 노출. CommitGraph 의 동명 룰 이주. */
.ref-pill:hover .ref-pill-hide {
  opacity: 1;
}
</style>
