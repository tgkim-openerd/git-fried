<script setup lang="ts">
// Conventional Commit 빌더 + 일반 입력 모드 토글.
// 사용자 실측 데이터 기준 (`docs/plan/02 §3 W1`):
//   - feat / fix / chore / refactor / docs / perf / test / ci 80%+ 일관 사용
//   - 한글 메시지 55~72%
// → 디폴트 빌더 모드, 자유 입력 토글 가능.
import { computed, ref } from 'vue'
import { stageAll as apiStageAll } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useShortcut } from '@/composables/useShortcuts'
// Sprint c31 god comp 분리 5/N — Conventional 빌더 분리.
import ConventionalCommitBuilder from './ConventionalCommitBuilder.vue'
// Sprint c32 god comp 분리 8/N — AI commit message 영역 (probes / mutation / parser) 분리.
import { useAiCommitMessage } from '@/composables/useAiCommitMessage'
// Sprint c33 god comp 분리 10/N — commit mutation + lastResult panel 영역 분리.
import { useCommitMutation, hookKind } from '@/composables/useCommitMutation'
// Sprint c79-C — Amend 토글 ON 시 마지막 commit prefill 영역 (50 LOC) 분리.
import { useAmendPrefill } from '@/composables/useAmendPrefill'
// Plan #42 H-4 → M-1.2 부분 wire (Codex 4차 audit 권고) — Settings 의 commitSkipHooks
// default 값을 noVerify checkbox 초기값으로 적용. 사용자 form 안 override 가능.
import { useGeneralSettings } from '@/composables/useUserSettings'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const general = useGeneralSettings()

const toast = useToast()
import { buildConventional, type ConventionalType } from '@/types/git'

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
// Plan #42 H-4 / M-1.2 wire — Settings.commitTemplate 으로 freeMessage 초기 prefill.
// 사용자가 form 진입 시 template 가 미리 적용된 상태. 빈 template 은 effect 없음.
const freeMessage = ref(general.value.commitTemplate)
const signoff = ref(false)
// Plan #42 H-4 / M-1.2 부분 wire — Settings.commitSkipHooks default 적용.
// Codex 5차 audit `a0a801fa629a5bed5` MED 명시 — **one-time init 의도** (mount 시
// 1회). 사용자 form 안에서 checkbox 해제 가능 (사용자 의도 우선). Settings 의
// commitSkipHooks 변경 후 form 이 이미 mount 됐으면 sync 안 됨 (의도).
const noVerify = ref(general.value.commitSkipHooks)
// Sprint c25-2 §3-2 — Amend 토글. ON 시 last_commit_message prefill, --amend 로 commit.
const amend = ref(false)
const invalidate = useInvalidateRepoQueries()

// c79-C — Amend ON 시 prefill (SEC-006 push confirm + Conventional 매칭) 영역 composable 위임.
useAmendPrefill({
  amend,
  repoId: () => props.repoId,
  ahead: () => props.ahead,
  mode,
  type,
  scope,
  breaking,
  subject,
  body,
  freeMessage,
})

const finalMessage = computed(() => {
  const raw =
    mode.value === 'free'
      ? freeMessage.value
      : buildConventional({
          type: type.value,
          scope: scope.value,
          breaking: breaking.value,
          subject: subject.value,
          body: body.value,
          footer: footer.value,
        })
  // Plan #42 H-4 / M-1.2 wire — Settings.commitRemoveComments true 시 git comment 라인 strip.
  // Codex 5차 audit `a0a801fa629a5bed5` MED 해소 — `^#` 전체 대신 `^# ` (스페이스 포함)
  // 또는 단독 `^#$` 만 strip (git commit-msg 의 default comment 패턴 일관).
  // markdown heading `# Title` 도 strip 되지만 일반 `#tag` / `#issue123` 같은 라인은 보존.
  if (general.value.commitRemoveComments) {
    return raw
      .split('\n')
      .filter((line) => !/^#(\s|$)/.test(line))
      .join('\n')
      .trim()
  }
  return raw
})

// Sprint c31 — subjectLength / subjectZone / subjectPct / subjectWarn 모두
// ConventionalCommitBuilder.vue 내부로 이전 (subject prop 만 의존).

// commit 실패 결과 (hook 출력) — alert 대신 inline panel.
// 사용자 lefthook + husky + lint-staged 출력이 stderr 로 옴.
const cmtMut = useCommitMutation({
  repoId: () => props.repoId,
  finalMessage: () => finalMessage.value,
  signoff: () => signoff.value,
  amend,
  resetForm: () => {
    subject.value = ''
    body.value = ''
    footer.value = ''
    // Plan #42 M-1.2 wire — Codex 5차 audit `a0a801fa629a5bed5` HIGH 해소.
    // commit 성공 후 다음 commit draft 에 template 재적용 (이전: '' 으로 비움 → template 소멸).
    freeMessage.value = general.value.commitTemplate
    breaking.value = false
  },
  onCommitted: () => emit('committed'),
})
const lastResult = cmtMut.lastResult
const commitMut = cmtMut.commitMut

function commitWith(noVerifyOverride: boolean) {
  cmtMut.commit(noVerifyOverride)
}

function canCommit(): boolean {
  return finalMessage.value.trim().length > 0 && props.repoId != null
}

// === Sprint c32 god comp 분리 8/N — useAiCommitMessage composable ===
// aiProbes / availableCli / generate (confirm + IPC) / parseAiResult (Conventional 매칭) 모두
// composable 내부. 부모는 결과 받아 ref 갱신만.
const aiCm = useAiCommitMessage(() => props.repoId, {
  onResult: (parsed) => {
    // free 모드 fallback 우선 채움
    mode.value = 'free'
    freeMessage.value = parsed.freeMessage
    // Conventional 패턴 매치 시 type/scope/breaking/subject/body 갱신 + mode 전환
    if (parsed.conventional) {
      type.value = parsed.conventional.type
      scope.value = parsed.conventional.scope
      breaking.value = parsed.conventional.breaking
      subject.value = parsed.conventional.subject
      body.value = parsed.conventional.body
      mode.value = 'conventional'
    }
  },
  onError: (e) => {
    toast.error(t('commitInput.errAiFailed'), describeError(e))
  },
})
const availableCli = aiCm.availableCli
const aiMut = aiCm.generate

// Sprint B5 — ⌘⇧Enter (stage all + commit) / ⌘⇧M (focus message).
// Sprint c31 — Conventional 모드 subjectRef 는 ConventionalCommitBuilder defineExpose 통해 접근.
const builderRef = ref<InstanceType<typeof ConventionalCommitBuilder> | null>(null)
const freeRef = ref<HTMLTextAreaElement | null>(null)

useShortcut('focusMessage', () => {
  if (mode.value === 'free') {
    freeRef.value?.focus()
  } else {
    builderRef.value?.subjectRef?.focus()
  }
})

// UXF-21 — stageAll → commit 2단계 중 stageAll 구간 pending 표시 + 중복 클릭 차단.
const staging = ref(false)
async function dispatchStageAndCommit() {
  if (props.repoId == null || staging.value) return
  if (!canCommit()) {
    toast.error(t('commitInput.errCommitInvalid'), t('commitInput.errCommitInvalidBody'))
    return
  }
  staging.value = true
  try {
    await apiStageAll(props.repoId)
    invalidate(props.repoId)
    commitMut.mutate({ noVerify: noVerify.value })
  } catch (e) {
    toast.error(t('commitInput.errStageAllFailed'), describeError(e))
  } finally {
    staging.value = false
  }
}
useShortcut('stageAndCommit', dispatchStageAndCommit)
</script>

<template>
  <div class="flex flex-col gap-2 border-t border-border p-3">
    <!-- Sprint c30 / GitKraken UX (Phase 2b) — "Commit" 헤더 라벨.
         GitKraken 스크린샷 3 의 우측 패널 하단 commit form 위 라벨 흡수. -->
    <div
      class="flex items-center justify-between border-b border-border/50 pb-1 text-2xs uppercase tracking-wider text-muted-foreground"
    >
      <span class="font-semibold">⊙ Commit</span>
      <span class="font-mono">↑ {{ ahead }} / ↓ {{ behind }}</span>
    </div>

    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2 text-xs">
        <button
          type="button"
          class="rounded-md border border-input px-2.5 py-1 min-h-[24px]"
          :class="mode === 'conventional' ? 'bg-accent text-accent-foreground' : ''"
          aria-label="Conventional Commits 모드 (type/scope/subject)"
          :aria-pressed="mode === 'conventional'"
          @click="mode = 'conventional'"
        >
          Conventional
        </button>
        <button
          type="button"
          class="rounded-md border border-input px-2.5 py-1 min-h-[24px]"
          :class="mode === 'free' ? 'bg-accent text-accent-foreground' : ''"
          :aria-label="t('a11y.ariaLabel.commitMessageFree')"
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
        class="rounded-md border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 min-h-[28px] text-xs font-medium text-violet-700 dark:text-violet-500 hover:bg-violet-500/20 disabled:opacity-50"
        :disabled="!repoId || aiMut.isPending.value"
        :title="`${availableCli} CLI 로 staged diff 분석 → commit 메시지 생성`"
        :aria-label="`Compose with AI (${availableCli})`"
        @click="aiMut.mutate()"
      >
        {{ aiMut.isPending.value ? '✨ 생성 중...' : '✨ Compose with AI' }}
      </button>
    </div>

    <!-- Conventional 빌더 (Sprint c31 god comp 분리 5/N — ConventionalCommitBuilder.vue) -->
    <ConventionalCommitBuilder
      v-if="mode === 'conventional'"
      ref="builderRef"
      v-model:type="type"
      v-model:scope="scope"
      v-model:breaking="breaking"
      v-model:subject="subject"
      v-model:body="body"
      v-model:footer="footer"
    />

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
      <summary class="cursor-pointer text-muted-foreground">
        {{ t('commitInputExtra.previewLabel') }}
      </summary>
      <pre class="mt-1 whitespace-pre-wrap font-mono text-2xs">{{
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
      <span :class="amend ? 'font-semibold text-warning-amber' : ''"> Amend previous commit </span>
      <span v-if="amend" class="text-3xs text-muted-foreground">{{
        t('commitInputExtra.amendLabel')
      }}</span>
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
        class="rounded-md bg-primary px-3 py-1.5 min-h-[28px] text-xs font-medium text-primary-foreground disabled:opacity-50"
        :disabled="!canCommit() || commitMut.isPending.value"
        :title="amend ? t('commitInput.amendTitle') : t('commitInput.commitTitle')"
        @click="commitWith(noVerify)"
      >
        {{
          commitMut.isPending.value
            ? amend
              ? t('commitInput.amending')
              : t('commitInput.committing')
            : amend
              ? t('commitInput.amendBtn')
              : t('commitInput.commitBtn')
        }}
      </button>
    </div>

    <!-- Sprint c25-2 §3-2 — 'Stage Changes to Commit' combo CTA (대형 primary).
         GitKraken 의 우측 패널 하단 큰 버튼과 1:1 매칭. ⌘⇧Enter 와 동일 동작. -->
    <button
      type="button"
      class="mt-1 flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:bg-emerald-600/50 disabled:cursor-not-allowed"
      :disabled="!canCommit() || commitMut.isPending.value || staging"
      :title="amend ? t('commitInput.stageAmendTitle') : t('commitInput.stageCommitTitle')"
      @click="dispatchStageAndCommit"
    >
      <span class="text-base leading-none">⤓</span>
      <span>
        {{
          staging
            ? t('commitInput.staging')
            : commitMut.isPending.value
              ? amend
                ? t('commitInput.amending')
                : t('commitInput.committing')
              : amend
                ? t('commitInput.stageAndAmend')
                : t('commitInput.stageAndCommit')
        }}
      </span>
      <span class="text-3xs opacity-75">⌘⇧Enter</span>
    </button>

    <!-- Pre-commit hook 실패 결과 패널 -->
    <div
      v-if="lastResult && !lastResult.success"
      class="rounded-md border border-rose-500/40 bg-rose-500/5 p-2 text-xs"
    >
      <div class="mb-1 flex items-center justify-between">
        <span class="font-semibold text-danger-rose">
          ✕ Commit 실패 (exit {{ lastResult.exitCode }})
          <span
            v-if="hookKind(lastResult.stderr)"
            class="ml-1 rounded bg-rose-500/20 px-1 text-3xs"
          >
            {{ hookKind(lastResult.stderr) }}
          </span>
        </span>
        <button
          type="button"
          class="flex items-center justify-center rounded min-h-[24px] min-w-[24px] p-1 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
          :aria-label="t('common.close')"
          @click="cmtMut.clearLastResult()"
        >
          ✕
        </button>
      </div>
      <pre class="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-2xs">{{
        lastResult.stderr || lastResult.stdout || '(출력 없음)'
      }}</pre>
      <p class="mt-2 text-3xs text-muted-foreground">
        💡 Pre-commit hook 이 실패하면 보통 lint / format / typecheck 가 막은 것입니다. 에디터에서
        수정 후 다시 commit. <strong>--no-verify 우회는 권장하지 않음</strong>
        (CI 실패 / 코드 품질 저하).
      </p>
      <div class="mt-2 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-md border border-rose-500/40 px-2.5 py-1.5 min-h-[28px] text-danger-rose hover:bg-rose-500/10"
          @click="commitWith(true)"
        >
          ⚠ --no-verify 로 강제 commit
        </button>
        <button
          type="button"
          class="rounded-md border border-input px-2.5 py-1.5 min-h-[28px] hover:bg-accent"
          @click="commitWith(noVerify)"
        >
          재시도
        </button>
      </div>
    </div>
  </div>
</template>
