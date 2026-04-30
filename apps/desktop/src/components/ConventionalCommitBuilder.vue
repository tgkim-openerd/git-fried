<script setup lang="ts">
// Sprint c31 god comp 분리 5/N — CommitMessageInput.vue 의 Conventional 빌더 분리.
//
// type / scope / breaking grid + subject input + 50/72 progress bar + body + footer.
// subjectLength / subjectZone / subjectPct 자체 computed (subject prop 만 의존).
//
// 부모 (CommitMessageInput) 는 v-model 6개 (defineModel) 와 subjectRef expose 만 노출.
import { computed, useTemplateRef } from 'vue'
import { CONVENTIONAL_TYPES, type ConventionalType } from '@/types/git'
import { visualWidth } from '@/utils/visualWidth'

// v-model 6 페어 — Vue 3.4+ defineModel 패턴 (기존 ref 와 양방향 바인딩).
const type = defineModel<ConventionalType>('type', { required: true })
const scope = defineModel<string>('scope', { required: true })
const breaking = defineModel<boolean>('breaking', { required: true })
const subject = defineModel<string>('subject', { required: true })
const body = defineModel<string>('body', { required: true })
const footer = defineModel<string>('footer', { required: true })

// === Subject 길이 / 50/72 progress bar ===
const subjectLength = computed(() => visualWidth(subject.value))
const subjectWarn = computed(() => subjectLength.value > 72)
// Phase 10 MEDIUM 1 — Conventional commits convention (이상 50자 / 한계 72자)
const subjectZone = computed<'ideal' | 'warn' | 'over'>(() => {
  if (subjectLength.value > 72) return 'over'
  if (subjectLength.value > 50) return 'warn'
  return 'ideal'
})
const subjectPct = computed(() => Math.min(100, Math.round((subjectLength.value / 72) * 100)))

// 부모가 commit 직후 subject focus 처리 가능하게 expose.
const subjectRef = useTemplateRef<HTMLInputElement>('subjectRef')
defineExpose({ subjectRef })
</script>

<template>
  <div class="contents">
    <div class="grid grid-cols-[120px_1fr_60px] gap-1">
      <select
        v-model="type"
        class="rounded-md border border-input bg-background px-2 py-1 text-xs"
        aria-label="Conventional commit type"
      >
        <option v-for="t in CONVENTIONAL_TYPES" :key="t" :value="t">{{ t }}</option>
      </select>
      <input
        v-model="scope"
        placeholder="scope (선택)"
        class="rounded-md border border-input bg-background px-2 py-1 text-xs"
        aria-label="Conventional commit scope (선택)"
      />
      <label class="flex items-center justify-center gap-1 text-xs">
        <input
          v-model="breaking"
          type="checkbox"
          class="accent-destructive"
          aria-label="BREAKING CHANGE 표시"
        />
        !
      </label>
    </div>
    <input
      ref="subjectRef"
      v-model="subject"
      placeholder="subject (한글 OK)"
      class="rounded-md border border-input bg-background px-2 py-1 text-sm"
      :class="subjectWarn ? 'border-amber-500' : ''"
      aria-label="Conventional commit subject"
    />
    <!-- Phase 10 MEDIUM 1 — 50/72 progress bar -->
    <div class="flex flex-col gap-0.5">
      <div class="relative h-1 w-full overflow-hidden rounded bg-muted">
        <!-- 50/72 marker (≈69.4%) -->
        <div
          class="absolute top-0 bottom-0 w-px bg-foreground/30"
          :style="{ left: 'calc(50 / 72 * 100%)' }"
          aria-hidden="true"
        ></div>
        <div
          class="h-full transition-all"
          :class="{
            'bg-emerald-500': subjectZone === 'ideal',
            'bg-amber-500': subjectZone === 'warn',
            'bg-rose-500': subjectZone === 'over',
          }"
          :style="{ width: `${subjectPct}%` }"
        ></div>
      </div>
      <div class="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>형식: type(scope)!: subject (이상 ≤50, 한계 ≤72)</span>
        <span
          :class="{
            'text-diff-add': subjectZone === 'ideal' && subjectLength > 0,
            'text-warning-amber': subjectZone === 'warn',
            'text-danger-rose': subjectZone === 'over',
          }"
        >
          {{ subjectLength }}/72
        </span>
      </div>
    </div>
    <textarea
      v-model="body"
      placeholder="body (선택, 빈 줄 분리)"
      rows="3"
      class="rounded-md border border-input bg-background px-2 py-1 text-sm font-mono"
      aria-label="Conventional commit body (선택)"
    />
    <textarea
      v-model="footer"
      placeholder="footer — Closes: #123 / BREAKING CHANGE: ... (선택)"
      rows="2"
      class="rounded-md border border-input bg-background px-2 py-1 text-xs font-mono"
      aria-label="Conventional commit footer (선택)"
    />
  </div>
</template>
