<script setup lang="ts">
// Conventional Commit 빌더 + 일반 입력 모드 토글.
// 사용자 실측 데이터 기준 (`docs/plan/02 §3 W1`):
//   - feat / fix / chore / refactor / docs / perf / test / ci 80%+ 일관 사용
//   - 한글 메시지 55~72%
// → 디폴트 빌더 모드, 자유 입력 토글 가능.
import { computed, ref } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { commit as ipcCommit } from '@/api/git'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import {
  buildConventional,
  CONVENTIONAL_TYPES,
  type ConventionalType,
} from '@/types/git'

const props = defineProps<{ repoId: number | null; ahead: number; behind: number }>()
const emit = defineEmits<{
  committed: []
}>()

const mode = ref<'conventional' | 'free'>('conventional')
const type = ref<ConventionalType>('feat')
const scope = ref('')
const breaking = ref(false)
const subject = ref('')
const body = ref('')
const footer = ref('')
const freeMessage = ref('')
const signoff = ref(false)
const noVerify = ref(false)
const invalidate = useInvalidateRepoQueries()

const finalMessage = computed(() => {
  if (mode.value === 'free') return freeMessage.value
  return buildConventional({
    type: type.value,
    scope: scope.value,
    breaking: breaking.value,
    subject: subject.value,
    body: body.value,
    footer: footer.value,
  })
})

const subjectLength = computed(() => subject.value.length)
const subjectWarn = computed(() => subjectLength.value > 72)

const commitMut = useMutation({
  mutationFn: () => {
    if (props.repoId == null) return Promise.reject(new Error('no repo'))
    return ipcCommit({
      repoId: props.repoId,
      message: finalMessage.value,
      signoff: signoff.value,
      noVerify: noVerify.value,
    })
  },
  onSuccess: (res) => {
    if (res.success) {
      // 입력 초기화
      subject.value = ''
      body.value = ''
      footer.value = ''
      freeMessage.value = ''
      breaking.value = false
      invalidate(props.repoId)
      emit('committed')
    } else {
      alert(`commit 실패 (exit ${res.exitCode}):\n${res.stderr}`)
    }
  },
  onError: (e) => alert(`에러: ${String(e)}`),
})

function canCommit(): boolean {
  return finalMessage.value.trim().length > 0 && props.repoId != null
}
</script>

<template>
  <div class="flex flex-col gap-2 border-t border-border p-3">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2 text-xs">
        <button
          type="button"
          class="rounded-md border border-input px-2 py-0.5"
          :class="mode === 'conventional' ? 'bg-accent text-accent-foreground' : ''"
          @click="mode = 'conventional'"
        >
          Conventional
        </button>
        <button
          type="button"
          class="rounded-md border border-input px-2 py-0.5"
          :class="mode === 'free' ? 'bg-accent text-accent-foreground' : ''"
          @click="mode = 'free'"
        >
          Free-form
        </button>
      </div>
      <div class="text-[11px] text-muted-foreground">
        ↑ {{ ahead }} / ↓ {{ behind }}
      </div>
    </div>

    <!-- Conventional 빌더 -->
    <template v-if="mode === 'conventional'">
      <div class="grid grid-cols-[120px_1fr_60px] gap-1">
        <select
          v-model="type"
          class="rounded-md border border-input bg-background px-2 py-1 text-xs"
        >
          <option v-for="t in CONVENTIONAL_TYPES" :key="t" :value="t">{{ t }}</option>
        </select>
        <input
          v-model="scope"
          placeholder="scope (선택)"
          class="rounded-md border border-input bg-background px-2 py-1 text-xs"
        />
        <label class="flex items-center justify-center gap-1 text-xs">
          <input v-model="breaking" type="checkbox" class="accent-destructive" />
          !
        </label>
      </div>
      <input
        v-model="subject"
        placeholder="subject (한글 OK)"
        class="rounded-md border border-input bg-background px-2 py-1 text-sm"
        :class="subjectWarn ? 'border-amber-500' : ''"
      />
      <div class="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>형식: type(scope)!: subject</span>
        <span :class="subjectWarn ? 'text-amber-500' : ''">{{ subjectLength }}/72</span>
      </div>
      <textarea
        v-model="body"
        placeholder="body (선택, 빈 줄 분리)"
        rows="3"
        class="rounded-md border border-input bg-background px-2 py-1 text-sm font-mono"
      />
      <textarea
        v-model="footer"
        placeholder="footer — Closes: #123 / BREAKING CHANGE: ... (선택)"
        rows="2"
        class="rounded-md border border-input bg-background px-2 py-1 text-xs font-mono"
      />
    </template>

    <!-- Free 모드 -->
    <template v-else>
      <textarea
        v-model="freeMessage"
        placeholder="커밋 메시지 (자유 형식)"
        rows="6"
        class="rounded-md border border-input bg-background px-2 py-1 text-sm font-mono"
      />
    </template>

    <!-- 미리보기 -->
    <details class="rounded-md border border-border bg-muted/30 px-2 py-1 text-xs">
      <summary class="cursor-pointer text-muted-foreground">최종 메시지 미리보기</summary>
      <pre class="mt-1 whitespace-pre-wrap font-mono text-[11px]">{{ finalMessage || '(비어있음)' }}</pre>
    </details>

    <!-- 옵션 + commit 버튼 -->
    <div class="flex items-center justify-between text-xs">
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-1">
          <input v-model="signoff" type="checkbox" />
          signoff
        </label>
        <label class="flex items-center gap-1">
          <input v-model="noVerify" type="checkbox" />
          --no-verify
        </label>
      </div>
      <button
        type="button"
        class="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
        :disabled="!canCommit() || commitMut.isPending.value"
        @click="commitMut.mutate()"
      >
        {{ commitMut.isPending.value ? '커밋 중...' : 'Commit (⌘Enter)' }}
      </button>
    </div>
  </div>
</template>
