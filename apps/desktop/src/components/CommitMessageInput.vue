<script setup lang="ts">
// Conventional Commit 빌더 + 일반 입력 모드 토글.
// 사용자 실측 데이터 기준 (`docs/plan/02 §3 W1`):
//   - feat / fix / chore / refactor / docs / perf / test / ci 80%+ 일관 사용
//   - 한글 메시지 55~72%
// → 디폴트 빌더 모드, 자유 입력 토글 가능.
import { computed, ref, watch } from 'vue'
import { useMutation, useQuery } from '@tanstack/vue-query'
import {
  aiCommitMessage,
  aiDetectClis,
  commit as ipcCommit,
  lastCommitMessage,
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
  isConventionalType,
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
// Sprint c25-2 §3-2 — Amend 토글. ON 시 last_commit_message prefill, --amend 로 commit.
const amend = ref(false)
const invalidate = useInvalidateRepoQueries()

// Amend ON 시 마지막 commit 메시지를 빈 입력에 prefill.
// 이미 입력 중이면 덮어쓰지 않음 (사용자 입력 보호).
watch(
  [amend, () => props.repoId],
  async ([on, id]) => {
    if (!on || id == null) return
    // SEC-006 fix — 이미 push 된 commit 의 amend 는 force-push 필요 (history rewrite).
    // ahead === 0 && upstream 존재 = 마지막 commit 이 원격에도 있음 → 강제 confirm.
    if (props.ahead === 0) {
      if (
        !confirm(
          '⚠ Amend 경고 — 이미 push 된 commit 일 수 있습니다\n\n' +
            '• ahead = 0 (모든 local commit 이 원격에 push 됨)\n' +
            '• Amend 시 마지막 commit hash 변경 → 동료의 fetch 충돌\n' +
            '• 해결: push 후 force-push (--force-with-lease) 필요\n\n' +
            'Amend 를 진행하시겠습니까?',
        )
      ) {
        amend.value = false
        return
      }
    }
    const hasInput =
      mode.value === 'free' ? freeMessage.value.trim().length > 0 : subject.value.trim().length > 0
    if (hasInput) return
    try {
      const last = await lastCommitMessage(id)
      if (!last) return
      // 첫 줄 + 본문 분리 후 conventional 패턴 매칭 시도.
      const lines = last.split(/\r?\n/)
      const m = lines[0].match(/^(\w+)(?:\(([^)]+)\))?(!?):\s*(.+)$/)
      if (m && isConventionalType(m[1])) {
        type.value = m[1]
        scope.value = m[2] || ''
        breaking.value = m[3] === '!'
        subject.value = m[4]
        const bodyStart = lines.findIndex((l, i) => i > 0 && l.trim() === '')
        if (bodyStart > 0) {
          body.value = lines
            .slice(bodyStart + 1)
            .join('\n')
            .trim()
        }
        mode.value = 'conventional'
      } else {
        mode.value = 'free'
        freeMessage.value = last
      }
    } catch (e) {
      toast.error('마지막 커밋 메시지 조회 실패', describeError(e))
    }
  },
  { immediate: false },
)

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
      amend: amend.value,
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
      // Amend 성공 시 토글 해제 (다음 commit 은 일반 commit 로).
      amend.value = false
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
    if (!confirm('⚠ staged diff 가 외부 LLM 으로 송출됩니다.\n회사 보안정책을 확인하셨나요?')) {
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
      if (m && isConventionalType(m[1])) {
        type.value = m[1]
        scope.value = m[2] || ''
        breaking.value = m[3] === '!'
        subject.value = m[4]
        const bodyStart = lines.findIndex((l, i) => i > 0 && l.trim() === '')
        if (bodyStart > 0) {
          body.value = lines
            .slice(bodyStart + 1)
            .join('\n')
            .trim()
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

async function dispatchStageAndCommit() {
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
}
useShortcut('stageAndCommit', dispatchStageAndCommit)
</script>

<template>
  <div class="flex flex-col gap-2 border-t border-border p-3">
    <!-- Sprint c30 / GitKraken UX (Phase 2b) — "Commit" 헤더 라벨.
         GitKraken 스크린샷 3 의 우측 패널 하단 commit form 위 라벨 흡수. -->
    <div
      class="flex items-center justify-between border-b border-border/50 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground"
    >
      <span class="font-semibold">⊙ Commit</span>
      <span class="font-mono">↑ {{ ahead }} / ↓ {{ behind }}</span>
    </div>

    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2 text-xs">
        <button
          type="button"
          class="rounded-md border border-input px-2 py-0.5"
          :class="mode === 'conventional' ? 'bg-accent text-accent-foreground' : ''"
          aria-label="Conventional Commits 모드 (type/scope/subject)"
          :aria-pressed="mode === 'conventional'"
          @click="mode = 'conventional'"
        >
          Conventional
        </button>
        <button
          type="button"
          class="rounded-md border border-input px-2 py-0.5"
          :class="mode === 'free' ? 'bg-accent text-accent-foreground' : ''"
          aria-label="자유 형식 commit 메시지 모드"
          :aria-pressed="mode === 'free'"
          @click="mode = 'free'"
        >
          Free-form
        </button>
      </div>
      <!-- Sprint c30 / GitKraken UX (Phase 2b) — "Compose with AI" prominent 버튼.
           기존 작은 ✨ AI 텍스트 → 라벨 명시. Conventional/Free 토글 옆 위치. -->
      <button
        v-if="availableCli"
        type="button"
        data-testid="compose-with-ai"
        class="rounded-md border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-500 hover:bg-violet-500/20 disabled:opacity-50"
        :disabled="!repoId || aiMut.isPending.value"
        :title="`${availableCli} CLI 로 staged diff 분석 → commit 메시지 생성`"
        :aria-label="`Compose with AI (${availableCli})`"
        @click="aiMut.mutate()"
      >
        {{ aiMut.isPending.value ? '✨ 생성 중...' : '✨ Compose with AI' }}
      </button>
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
      <pre class="mt-1 whitespace-pre-wrap font-mono text-[11px]">{{
        finalMessage || '(비어있음)'
      }}</pre>
    </details>

    <!-- Sprint c25-2 §3-2 — Amend previous commit (GitKraken 호환) -->
    <label
      class="flex items-center gap-1.5 rounded-md border border-input px-2 py-1 text-xs"
      :class="amend ? 'border-amber-500/60 bg-amber-500/5' : ''"
      :title="
        amend
          ? '⚠ --amend ON — 마지막 커밋이 새 메시지로 덮어써짐. push 됐다면 force-push 필요.'
          : '체크 시 마지막 커밋 메시지 prefill + git commit --amend 로 동작'
      "
    >
      <input v-model="amend" type="checkbox" :disabled="!repoId" class="accent-amber-500" />
      <span :class="amend ? 'font-semibold text-amber-500' : ''"> Amend previous commit </span>
      <span v-if="amend" class="text-[10px] text-muted-foreground">— 마지막 커밋 수정</span>
    </label>

    <!-- 옵션 + commit 버튼.
         Sprint c30 / GitKraken UX (Phase 2b) — AI 버튼은 헤더로 이동. -->
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
        :title="amend ? 'Amend (⌘Enter) — 마지막 커밋 덮어쓰기' : 'Commit (⌘Enter)'"
        @click="commitWith(noVerify)"
      >
        {{
          commitMut.isPending.value
            ? amend
              ? 'Amend 중...'
              : '커밋 중...'
            : amend
              ? 'Amend (⌘Enter)'
              : 'Commit (⌘Enter)'
        }}
      </button>
    </div>

    <!-- Sprint c25-2 §3-2 — 'Stage Changes to Commit' combo CTA (대형 primary).
         GitKraken 의 우측 패널 하단 큰 버튼과 1:1 매칭. ⌘⇧Enter 와 동일 동작. -->
    <button
      type="button"
      class="mt-1 flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:bg-emerald-600/50 disabled:cursor-not-allowed"
      :disabled="!canCommit() || commitMut.isPending.value"
      :title="
        amend
          ? '⌘⇧Enter — 모든 변경 stage + amend (마지막 커밋 덮어쓰기)'
          : '⌘⇧Enter — 모든 변경 stage + commit'
      "
      @click="dispatchStageAndCommit"
    >
      <span class="text-base leading-none">⤓</span>
      <span>
        {{ amend ? 'Stage All & Amend' : 'Stage Changes to Commit' }}
      </span>
      <span class="text-[10px] opacity-75">⌘⇧Enter</span>
    </button>

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
      <pre class="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px]">{{
        lastResult.stderr || lastResult.stdout || '(출력 없음)'
      }}</pre>
      <p class="mt-2 text-[10px] text-muted-foreground">
        💡 Pre-commit hook 이 실패하면 보통 lint / format / typecheck 가 막은 것입니다. 에디터에서
        수정 후 다시 commit. <strong>--no-verify 우회는 권장하지 않음</strong>
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
