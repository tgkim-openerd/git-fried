<script setup lang="ts">
// Conventional Commit 빌더 + 일반 입력 모드 토글.
// 사용자 실측 데이터 기준 (`docs/plan/02 §3 W1`):
//   - feat / fix / chore / refactor / docs / perf / test / ci 80%+ 일관 사용
//   - 한글 메시지 55~72%
// → 디폴트 빌더 모드, 자유 입력 토글 가능.
import { computed, ref } from 'vue'
import { useMutation, useQuery } from '@tanstack/vue-query'
import {
  aiCommitMessage,
  aiDetectClis,
  commit as ipcCommit,
  stageAll as apiStageAll,
} from '@/api/git'
import { describeError } from '@/api/errors'
import { STALE_TIME } from '@/api/queryClient'
import { useToast } from '@/composables/useToast'
import { useShortcut } from '@/composables/useShortcuts'
import { notifyAiDone } from '@/composables/useAiCli'
import { visualWidth } from '@/utils/visualWidth'
import type { AiCli } from '@/api/git'
import type { CommitResult } from '@/types/git'
import { useInvalidateRepoQueries } from '@/composables/useStatus'

const toast = useToast()
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

// Sprint 22-7 Q-3: visualWidth 를 utils/visualWidth.ts 로 추출 (DRY 재사용).
// ASCII=1, 한글/CJK/emoji=2 — terminal cell 기준. 한글 36자 ≈ 영문 72자.
const subjectLength = computed(() => visualWidth(subject.value))
const subjectWarn = computed(() => subjectLength.value > 72)

// commit 실패 결과 (hook 출력) — alert 대신 inline panel.
// 사용자 lefthook + husky + lint-staged 출력이 stderr 로 옴.
const lastResult = ref<CommitResult | null>(null)

function commitWith(noVerifyOverride: boolean) {
  if (props.repoId == null) return
  commitMut.mutate({ noVerify: noVerifyOverride })
}

const commitMut = useMutation({
  mutationFn: ({ noVerify: nv }: { noVerify: boolean }) => {
    if (props.repoId == null) return Promise.reject(new Error('no repo'))
    return ipcCommit({
      repoId: props.repoId,
      message: finalMessage.value,
      signoff: signoff.value,
      noVerify: nv,
    })
  },
  onSuccess: (res) => {
    if (res.success) {
      lastResult.value = null
      subject.value = ''
      body.value = ''
      footer.value = ''
      freeMessage.value = ''
      breaking.value = false
      invalidate(props.repoId)
      emit('committed')
    } else {
      // pre-commit hook 실패 등 — inline panel 로 표시
      lastResult.value = res
      // R-2A C5 (`docs/plan/22 §2 C5`): conflict marker 가 stderr 에 보이면
      // 사용자에게 어디 충돌인지 안내. git 은 "<<<<<<<" 라인이 남으면 거부.
      const merged = `${res.stdout ?? ''}\n${res.stderr ?? ''}`
      const conflictHints = [
        /<{4,7}\s*HEAD/, // <<<<<<< HEAD
        /needs merge/i,
        /unmerged paths/i,
        /conflicting files/i,
        /you have unmerged files/i,
      ]
      if (conflictHints.some((re) => re.test(merged))) {
        toast.warning(
          '⚠ Conflict marker 가 남아 있습니다',
          'StatusPanel 의 "Conflicted" 섹션에서 충돌 파일을 열어 ours/theirs 를 선택하고 stage 하세요. (또는 우측 패널의 ⚔ Merge editor)',
        )
      }
    }
  },
  onError: (e) => toast.error('커밋 호출 실패', describeError(e)),
})

function canCommit(): boolean {
  return finalMessage.value.trim().length > 0 && props.repoId != null
}

// hook 출력에서 husky / lefthook 마커 감지
function hookKind(stderr: string): string | null {
  if (/husky/i.test(stderr)) return 'husky'
  if (/lefthook/i.test(stderr)) return 'lefthook'
  if (/pre-commit/i.test(stderr)) return 'pre-commit'
  return null
}

// === AI commit message (Claude / Codex CLI) ===
const { data: aiProbes } = useQuery({
  queryKey: ['aiProbes'],
  queryFn: aiDetectClis,
  staleTime: STALE_TIME.STATIC,
})
const availableCli = computed<AiCli | null>(() => {
  const p = aiProbes.value
  if (!p) return null
  if (p.find((x) => x.cli === 'claude' && x.installed)) return 'claude'
  if (p.find((x) => x.cli === 'codex' && x.installed)) return 'codex'
  return null
})

const aiMut = useMutation({
  mutationFn: () => {
    if (props.repoId == null || availableCli.value == null) {
      return Promise.reject(new Error('AI 사용 불가'))
    }
    if (
      !confirm(
        '⚠ staged diff 가 외부 LLM 으로 송출됩니다.\n회사 보안정책을 확인하셨나요?',
      )
    ) {
      return Promise.reject(new Error('cancelled'))
    }
    return aiCommitMessage(props.repoId, availableCli.value, true)
  },
  onSuccess: (out) => {
    if (out.success) {
      notifyAiDone('AI commit message 생성', out.text.split(/\r?\n/)[0])
      const lines = out.text.trim().split(/\r?\n/)
      // 첫 줄 = subject. 빈 줄 이후 = body
      mode.value = 'free'
      freeMessage.value = out.text.trim()
      // conventional 모드 채울 수도 있음
      const m = lines[0].match(/^(\w+)(?:\(([^)]+)\))?(!?):\s*(.+)$/)
      if (m && CONVENTIONAL_TYPES.includes(m[1] as ConventionalType)) {
        type.value = m[1] as ConventionalType
        scope.value = m[2] || ''
        breaking.value = m[3] === '!'
        subject.value = m[4]
        const bodyStart = lines.findIndex((l, i) => i > 0 && l.trim() === '')
        if (bodyStart > 0) {
          body.value = lines.slice(bodyStart + 1).join('\n').trim()
        }
        mode.value = 'conventional'
      }
    } else {
      toast.error('AI 응답 실패', out.stderr || out.text)
    }
  },
  onError: (e) => {
    const msg = describeError(e)
    if (msg.includes('cancelled')) return
    toast.error('AI 호출 실패', msg)
  },
})

// Sprint B5 — ⌘⇧Enter (stage all + commit) / ⌘⇧M (focus message).
const subjectRef = ref<HTMLInputElement | null>(null)
const freeRef = ref<HTMLTextAreaElement | null>(null)

useShortcut('focusMessage', () => {
  if (mode.value === 'free') {
    freeRef.value?.focus()
  } else {
    subjectRef.value?.focus()
  }
})

useShortcut('stageAndCommit', async () => {
  if (props.repoId == null) return
  if (!canCommit()) {
    toast.error('커밋 불가', '메시지가 비어있거나 레포 미선택')
    return
  }
  try {
    await apiStageAll(props.repoId)
    invalidate(props.repoId)
    commitMut.mutate({ noVerify: noVerify.value })
  } catch (e) {
    toast.error('Stage all 실패', describeError(e))
  }
})
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
        ref="subjectRef"
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
        ref="freeRef"
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
      <div class="flex gap-1">
        <button
          v-if="availableCli"
          type="button"
          class="rounded-md border border-input px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
          :disabled="!repoId || aiMut.isPending.value"
          :title="`${availableCli} CLI 사용`"
          @click="aiMut.mutate()"
        >
          {{ aiMut.isPending.value ? '✨...' : '✨ AI' }}
        </button>
        <button
          type="button"
          class="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
          :disabled="!canCommit() || commitMut.isPending.value"
          @click="commitWith(noVerify)"
        >
          {{ commitMut.isPending.value ? '커밋 중...' : 'Commit (⌘Enter)' }}
        </button>
      </div>
    </div>

    <!-- Pre-commit hook 실패 결과 패널 -->
    <div
      v-if="lastResult && !lastResult.success"
      class="rounded-md border border-rose-500/40 bg-rose-500/5 p-2 text-xs"
    >
      <div class="mb-1 flex items-center justify-between">
        <span class="font-semibold text-rose-500">
          ✕ Commit 실패 (exit {{ lastResult.exitCode }})
          <span
            v-if="hookKind(lastResult.stderr)"
            class="ml-1 rounded bg-rose-500/20 px-1 text-[10px]"
          >
            {{ hookKind(lastResult.stderr) }}
          </span>
        </span>
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground"
          @click="lastResult = null"
        >
          ✕
        </button>
      </div>
      <pre
        class="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px]"
      >{{ lastResult.stderr || lastResult.stdout || '(출력 없음)' }}</pre>
      <p class="mt-2 text-[10px] text-muted-foreground">
        💡 Pre-commit hook 이 실패하면 보통 lint / format / typecheck 가 막은 것입니다.
        에디터에서 수정 후 다시 commit. <strong>--no-verify 우회는 권장하지 않음</strong>
        (CI 실패 / 코드 품질 저하).
      </p>
      <div class="mt-2 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-md border border-rose-500/40 px-2 py-1 text-rose-500 hover:bg-rose-500/10"
          @click="commitWith(true)"
        >
          ⚠ --no-verify 로 강제 commit
        </button>
        <button
          type="button"
          class="rounded-md border border-input px-2 py-1 hover:bg-accent"
          @click="commitWith(noVerify)"
        >
          재시도
        </button>
      </div>
    </div>
  </div>
</template>
