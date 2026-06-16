<script setup lang="ts">
// Clone with options modal — `docs/plan/14 §6 E1+E2` Sprint C14-2 +
//   plan/29 E4 Sprint c38-3 (Preset 4축).
//
// 기본: URL + 부모 폴더 + 폴더명. preset 4종 (full / shallow / monorepo / sparseDirs)
// 으로 빠른 시작 + advanced 토글 시 sparse / shallow / single-branch / filter 미세 조정.
// auto_register=true 면 clone 후 자동으로 git-fried workspace 에 add_repo.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { cloneRepo, cancelGitOp, type CloneOptions } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import BaseModal from './BaseModal.vue'

const { t } = useI18n()
const props = defineProps<{ open: boolean; workspaceId: number | null }>()
const emit = defineEmits<{ close: [] }>()

const toast = useToast()
const qc = useQueryClient()

// plan #45 M4c — 진행 중 clone 취소용 job_id. mutate 마다 새로 생성 → cancelGitOp 로 중단.
const cloneJobId = ref<string | null>(null)

const url = ref('')
const parentPath = ref('')
const folderName = ref('')
const showAdvanced = ref(false)

// Sprint c38 / plan/29 E4 — Preset 4축. 'custom' 은 advanced 토글 후 자유 입력.
type ClonePreset = 'full' | 'shallow' | 'monorepo' | 'sparseDirs' | 'custom'
const preset = ref<ClonePreset>('full')

// sparse paths 입력은 1줄 1path
const sparseText = ref('')
const depth = ref<number | null>(null)
const shallowSince = ref('')
const singleBranch = ref('')
const bare = ref(false)
// Sprint c38 / plan/29 E4 — partial clone filter (`--filter=<spec>`).
const filter = ref<string>('')

const targetPath = computed(() => {
  const p = parentPath.value.trim().replace(/[/\\]+$/, '')
  const f = folderName.value.trim()
  if (!p || !f) return ''
  return `${p}/${f}`
})

// URL 입력 시 폴더명 자동 추정 (`https://example.com/owner/foo.git` → `foo`)
watch(url, (v) => {
  if (folderName.value) return // 사용자가 명시적으로 입력한 후에는 안 바꿈
  const m = v
    .trim()
    .replace(/\.git$/, '')
    .split(/[/:]/)
    .pop()
  if (m) folderName.value = m
})

const sparseList = computed<string[]>(() => {
  return sparseText.value
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
})

/**
 * Sprint c38 / plan/29 E4 — Preset 선택 시 옵션 필드 자동 채우기.
 *
 * - full         : 모든 옵션 비움 (전체 clone).
 * - shallow      : depth=1.
 * - monorepo     : --sparse + --filter=blob:none + --single-branch=main (사용자가 sparse paths 추가 가능).
 * - sparseDirs   : sparse paths 입력 활성화 (사용자가 채움).
 * - custom       : 손대지 않음 (advanced 토글로 자유 조정).
 *
 * 'custom' 외 변경 시 advanced 토글은 자동 펼쳐 사용자가 어떤 옵션이 적용됐는지 인지 가능.
 */
function applyPreset(p: ClonePreset) {
  preset.value = p
  if (p === 'custom') return
  // 우선 모두 초기화 (custom 입력 잔재 제거).
  sparseText.value = ''
  depth.value = null
  shallowSince.value = ''
  singleBranch.value = ''
  filter.value = ''
  switch (p) {
    case 'full':
      // no-op
      break
    case 'shallow':
      depth.value = 1
      break
    case 'monorepo':
      // sparse paths 는 사용자가 advanced 영역에서 추가 (placeholder + sparseDirs preset 권장).
      filter.value = 'blob:none'
      singleBranch.value = 'main'
      // monorepo preset 도 sparse paths 직접 입력 가능하도록 advanced 펼침.
      showAdvanced.value = true
      break
    case 'sparseDirs':
      // 사용자가 sparseText 직접 입력. advanced 펼쳐 입력란 노출.
      showAdvanced.value = true
      break
  }
}

const cloneMut = useMutation({
  mutationFn: () => {
    const opts: CloneOptions = {}
    // Sprint c38 / plan/29 E4 — preset 또는 advanced 입력 어느 쪽이든 채워진 값을 모두 반영.
    // custom preset 인 경우에도 입력된 advanced 값을 그대로 보냄.
    if (sparseList.value.length > 0) opts.sparsePaths = sparseList.value
    if (depth.value && depth.value > 0) opts.depth = depth.value
    const s = shallowSince.value.trim()
    if (s) opts.shallowSince = s
    const b = singleBranch.value.trim()
    if (b) opts.singleBranch = b
    if (bare.value) opts.bare = true
    const f = filter.value.trim()
    if (f) opts.filter = f
    // plan #45 M4c — 취소 가능 clone: 새 job_id 생성 후 전달. cancelClone() 이 이 id 로 중단.
    cloneJobId.value = crypto.randomUUID()
    return cloneRepo(
      url.value.trim(),
      targetPath.value,
      opts,
      true,
      props.workspaceId,
      cloneJobId.value,
    )
  },
  onSettled: () => {
    cloneJobId.value = null
  },
  onSuccess: (r) => {
    toast.success(
      t('clone.successTitle'),
      r.registeredRepo
        ? t('clone.successAutoRegistered', { name: r.registeredRepo.name })
        : (r.warning ?? t('clone.successPathOnly')),
    )
    qc.invalidateQueries({ queryKey: ['repos'] })
    reset()
    emit('close')
  },
  onError: (e) => toast.error(t('clone.failedTitle'), describeError(e)),
})

function reset() {
  url.value = ''
  parentPath.value = ''
  folderName.value = ''
  showAdvanced.value = false
  preset.value = 'full'
  sparseText.value = ''
  depth.value = null
  shallowSince.value = ''
  singleBranch.value = ''
  bare.value = false
  filter.value = ''
}

function close() {
  reset()
  emit('close')
}

// plan #45 M4c — 진행 중 clone 취소 (M4b cancel_git_op IPC → BE git child kill).
// 취소 시 clone IPC 가 "취소됨" 에러 반환 → cloneMut.onError 로 사용자 피드백.
async function cancelClone() {
  const id = cloneJobId.value
  if (id) await cancelGitOp(id)
}

const canSubmit = computed(
  () => url.value.trim().length > 0 && targetPath.value.length > 0 && !cloneMut.isPending.value,
)
</script>

<template>
  <BaseModal
    :open="open"
    max-width="xl"
    title="⬇ 레포 clone"
    panel-class="max-h-[85vh]"
    @close="close"
  >
    <form class="p-4 text-sm" @submit.prevent="cloneMut.mutate()">
      <label class="block">
        <span class="text-xs font-medium">URL</span>
        <input
          v-model="url"
          required
          placeholder="https://github.com/owner/repo.git 또는 git@host:owner/repo.git"
          class="mt-1 w-full rounded border border-input bg-background px-2 py-1 font-mono text-[12px]"
        />
      </label>

      <div class="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <label class="block">
          <span class="text-xs font-medium">{{ t('cloneModal.parentFolder') }}</span>
          <input
            v-model="parentPath"
            required
            placeholder="D:/01.Work/01.Projects"
            class="mt-1 w-full rounded border border-input bg-background px-2 py-1 font-mono text-[12px]"
          />
        </label>
        <label class="block">
          <span class="text-xs font-medium">{{ t('cloneModal.folderName') }}</span>
          <input
            v-model="folderName"
            required
            placeholder="repo"
            class="mt-1 w-40 rounded border border-input bg-background px-2 py-1 font-mono text-[12px]"
          />
        </label>
      </div>

      <p v-if="targetPath" class="mt-1 text-3xs text-muted-foreground">
        {{ t('clone.targetPathLabel') }} <span class="font-mono">{{ targetPath }}</span>
      </p>

      <!-- Sprint c38 / plan/29 E4 — Preset 라디오 (4축 + custom). -->
      <fieldset class="mt-4 rounded border border-border bg-muted/10 p-2">
        <legend class="px-1 text-3xs font-medium text-muted-foreground">
          {{ t('clone.presetLegend') }}
        </legend>
        <div class="grid grid-cols-2 gap-1 text-xs sm:grid-cols-5">
          <label
            v-for="p in ['full', 'shallow', 'monorepo', 'sparseDirs', 'custom'] as const"
            :key="p"
            class="flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 hover:bg-accent/40"
            :class="preset === p ? 'bg-accent/60 ring-1 ring-primary/40' : ''"
            :title="t(`clone.preset.${p}Title`)"
          >
            <input
              type="radio"
              name="clone-preset"
              :value="p"
              :checked="preset === p"
              @change="applyPreset(p)"
            />
            <span>{{ t(`clone.preset.${p}`) }}</span>
          </label>
        </div>
      </fieldset>

      <!-- 고급 옵션 -->
      <button
        type="button"
        class="mt-4 inline-flex items-center rounded px-2 py-1 min-h-[24px] text-xs text-muted-foreground hover:bg-accent/40"
        @click="showAdvanced = !showAdvanced"
      >
        {{ showAdvanced ? '▾' : '▸' }} {{ t('clone.advancedToggle') }}
      </button>

      <div
        v-if="showAdvanced"
        class="mt-2 flex flex-col gap-3 rounded border border-border bg-muted/20 p-3"
      >
        <label class="block">
          <span class="text-xs font-medium">
            E1 Sparse-checkout cone paths
            <span class="ml-1 text-3xs text-muted-foreground">(1줄 1path)</span>
          </span>
          <textarea
            v-model="sparseText"
            rows="3"
            placeholder="apps/desktop&#10;packages/shared"
            class="mt-1 w-full rounded border border-input bg-background px-2 py-1 font-mono text-2xs"
          />
        </label>

        <div class="grid grid-cols-2 gap-2">
          <label class="block">
            <span class="text-xs font-medium">E2 Depth (shallow)</span>
            <input
              v-model.number="depth"
              type="number"
              min="1"
              placeholder="1 = 최근 1 commit"
              class="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-xs"
            />
          </label>
          <label class="block">
            <span class="text-xs font-medium">Shallow since (date)</span>
            <input
              v-model="shallowSince"
              placeholder="2024-01-01"
              class="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-xs"
            />
          </label>
        </div>

        <label class="block">
          <span class="text-xs font-medium">Single branch (한 브랜치만)</span>
          <input
            v-model="singleBranch"
            placeholder="main"
            class="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-xs"
          />
        </label>

        <label class="block">
          <span class="text-xs font-medium">
            {{ t('clone.filterLabel') }}
            <span class="ml-1 text-3xs text-muted-foreground">
              {{ t('clone.filterHint') }}
            </span>
          </span>
          <input
            v-model="filter"
            placeholder="blob:none"
            class="mt-1 w-full rounded border border-input bg-background px-2 py-1 font-mono text-2xs"
          />
        </label>

        <label class="flex items-center gap-2 text-xs">
          <input v-model="bare" type="checkbox" />
          <span>{{ t('clone.bareLabel') }}</span>
        </label>
      </div>
    </form>

    <template #footer>
      <div class="flex justify-end gap-2 text-xs">
        <button
          type="button"
          class="rounded border border-border px-3 py-1.5 min-h-[32px] hover:bg-muted/40"
          @click="close"
        >
          취소
        </button>
        <!-- plan #45 M4c — clone 진행 중 취소 버튼 (BE git child kill via cancel_git_op). -->
        <button
          v-if="cloneMut.isPending.value"
          type="button"
          class="rounded border border-red-500/50 px-3 py-1.5 min-h-[32px] text-red-700 hover:bg-red-500/10 dark:text-red-400"
          title="진행 중인 clone 을 중단합니다"
          @click="cancelClone"
        >
          클론 취소
        </button>
        <button
          type="button"
          class="rounded bg-primary px-3 py-1.5 min-h-[32px] text-primary-foreground hover:opacity-90 disabled:opacity-50"
          :disabled="!canSubmit"
          @click="cloneMut.mutate()"
        >
          {{ cloneMut.isPending.value ? '클론 중...' : 'Clone' }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>
