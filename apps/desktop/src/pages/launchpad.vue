<script setup lang="ts">
// Launchpad — 워크스페이스 모든 레포 PR 통합 보드.
// GitKraken Cloud Workspace 의 로컬 first 버전.
//
// 핵심 가치 (`docs/plan/02 §3 W1`): 회사 50+ 레포 PR 전체 조망 + bot/사람 분리.
//
// Sprint A4 추가: Pin / Snooze / Saved Views (`docs/plan/11 §14`).
import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { bulkListPrs } from '@/api/git'
import type { BulkResult, PrState, PullRequest } from '@/api/git'
import { useReposStore } from '@/stores/repos'
import { describeError } from '@/api/errors'
import {
  useLaunchpadMeta,
  useSavedViews,
  LAUNCHPAD_VIEW_KIND,
} from '@/composables/useLaunchpadMeta'
import { useToast } from '@/composables/useToast'
import { formatDateLocalized } from '@/composables/useUserSettings'
import UserAvatar from '@/components/UserAvatar.vue'

const store = useReposStore()
const toast = useToast()
const stateFilter = ref<PrState | null>('open')
const showBots = ref(false)
type Tab = 'active' | 'pinned' | 'snoozed'
const tab = ref<Tab>('active')

const { data, isFetching, error, refetch } = useQuery({
  queryKey: computed(() => [
    'launchpad-prs',
    store.activeWorkspaceId,
    stateFilter.value,
  ]),
  queryFn: () => bulkListPrs(store.activeWorkspaceId, stateFilter.value),
  staleTime: 30_000,
})

const meta = useLaunchpadMeta()
const savedViews = useSavedViews(LAUNCHPAD_VIEW_KIND)

interface FlatRow {
  repoName: string
  pr: PullRequest
}

function isBot(pr: PullRequest): boolean {
  const u = pr.author.username.toLowerCase()
  return (
    u.endsWith('-bot') ||
    u.endsWith('[bot]') ||
    u === 'release-please' ||
    u === 'dependabot' ||
    u === 'renovate' ||
    u === 'github-actions' ||
    u.includes('bot')
  )
}

const flatRows = computed<FlatRow[]>(() => {
  if (!data.value) return []
  const out: FlatRow[] = []
  for (const r of data.value) {
    if (!r.success || !r.data) continue
    for (const pr of r.data) {
      out.push({ repoName: r.repoName, pr })
    }
  }
  return out
})

const humanPrs = computed(() => flatRows.value.filter((r) => !isBot(r.pr)))
const botPrs = computed(() => flatRows.value.filter((r) => isBot(r.pr)))

const pinnedRows = computed(() =>
  humanPrs.value.filter((r) => meta.isPinned(r.pr)),
)
const snoozedRows = computed(() =>
  humanPrs.value.filter((r) => meta.snoozeRemaining(r.pr) != null),
)
const activeNotSnoozedRows = computed(() => {
  // tab='active' 의 메인 리스트: pinned 우선, 그 다음 일반 (snoozed 제외).
  const list = humanPrs.value.filter(
    (r) => meta.snoozeRemaining(r.pr) == null,
  )
  return list.slice().sort((a, b) => {
    const ap = meta.isPinned(a.pr) ? 1 : 0
    const bp = meta.isPinned(b.pr) ? 1 : 0
    if (ap !== bp) return bp - ap // pinned 먼저
    return b.pr.updatedAt - a.pr.updatedAt // 최신 갱신 먼저
  })
})

const failedRepos = computed<BulkResult<PullRequest[]>[]>(() =>
  (data.value ?? []).filter((r) => !r.success),
)

const stats = computed(() => ({
  total: flatRows.value.length,
  human: humanPrs.value.length,
  bot: botPrs.value.length,
  pinned: pinnedRows.value.length,
  snoozed: snoozedRows.value.length,
  reposWithPrs: new Set(flatRows.value.map((r) => r.repoName)).size,
  reposScanned: data.value?.length ?? 0,
  failed: failedRepos.value.length,
}))

function fmtDate(unix: number): string {
  return formatDateLocalized(unix, {
    month: '2-digit',
    day: '2-digit',
  })
}

function fmtRemaining(sec: number): string {
  if (sec < 60) return `${sec}초`
  if (sec < 3600) return `${Math.floor(sec / 60)}분`
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간`
  return `${Math.floor(sec / 86400)}일`
}

function stateColor(s: PrState): string {
  switch (s) {
    case 'open':
      return 'text-emerald-500'
    case 'merged':
      return 'text-violet-500'
    case 'closed':
      return 'text-rose-500'
    case 'draft':
      return 'text-muted-foreground'
  }
}

function togglePin(pr: PullRequest) {
  meta.pinMut.mutate(
    { pr, pinned: !meta.isPinned(pr) },
    {
      onError: (e) => toast.error('Pin 실패', describeError(e)),
    },
  )
}

interface SnoozeOption {
  label: string
  sec: number
}
const SNOOZE_OPTIONS: SnoozeOption[] = [
  { label: '1시간', sec: 3600 },
  { label: '하루', sec: 86400 },
  { label: '일주일', sec: 604800 },
  { label: '한 달', sec: 2592000 },
]

const snoozeMenuFor = ref<string | null>(null)
function rowKey(row: FlatRow): string {
  return `${row.pr.forgeKind}|${row.pr.owner}|${row.pr.repo}|${row.pr.number}`
}
function openSnoozeMenu(row: FlatRow) {
  const k = rowKey(row)
  snoozeMenuFor.value = snoozeMenuFor.value === k ? null : k
}
function applySnooze(row: FlatRow, opt: SnoozeOption) {
  meta.snoozeFor(row.pr, opt.sec)
  snoozeMenuFor.value = null
}
function unsnooze(row: FlatRow) {
  meta.clearSnooze(row.pr)
}

// Saved views — 매우 단순한 v1 UI: 현재 filter 를 이름 받아 저장 + 목록 클릭 시
// 적용. v1.x 에서 더 풍부한 filter set 가능.
const newViewName = ref('')
function saveCurrentView() {
  const name = newViewName.value.trim()
  if (!name) return
  const filterJson = JSON.stringify({
    state: stateFilter.value,
    showBots: showBots.value,
    tab: tab.value,
  })
  savedViews.saveMut.mutate(
    { name, filterJson },
    {
      onSuccess: () => {
        toast.success('View 저장', name)
        newViewName.value = ''
      },
      onError: (e) => toast.error('View 저장 실패', describeError(e)),
    },
  )
}
function applyView(v: { filterJson: string }) {
  try {
    const obj = JSON.parse(v.filterJson) as {
      state?: PrState | null
      showBots?: boolean
      tab?: Tab
    }
    if (obj.state !== undefined) stateFilter.value = obj.state
    if (obj.showBots !== undefined) showBots.value = obj.showBots
    if (obj.tab !== undefined) tab.value = obj.tab
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <header class="flex items-center justify-between border-b border-border bg-card px-4 py-2">
      <div class="flex items-center gap-3">
        <h1 class="text-base font-semibold">Launchpad</h1>
        <span class="text-xs text-muted-foreground">
          {{ stats.reposWithPrs }}/{{ stats.reposScanned }} 레포 ·
          PR {{ stats.human }}+{{ stats.bot }}봇
          <span v-if="stats.pinned > 0" class="ml-1 text-amber-500">⭐{{ stats.pinned }}</span>
          <span v-if="stats.snoozed > 0" class="ml-1 text-sky-500">💤{{ stats.snoozed }}</span>
          <span v-if="stats.failed > 0" class="ml-1 text-amber-500">
            · {{ stats.failed }}개 실패
          </span>
        </span>
      </div>
      <div class="flex items-center gap-2 text-xs">
        <div class="flex gap-1">
          <button
            v-for="s in [null, 'open', 'closed', 'merged'] as (PrState | null)[]"
            :key="String(s)"
            type="button"
            class="rounded-md border border-input px-2 py-0.5"
            :class="
              stateFilter === s
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground'
            "
            @click="stateFilter = s"
          >
            {{ s ?? 'all' }}
          </button>
        </div>
        <label class="ml-2 flex items-center gap-1">
          <input v-model="showBots" type="checkbox" />
          봇 PR 표시
        </label>
        <button
          type="button"
          class="rounded-md border border-input px-2 py-0.5 hover:bg-accent disabled:opacity-50"
          :disabled="isFetching"
          @click="refetch()"
        >
          {{ isFetching ? '...' : '↻' }}
        </button>
      </div>
    </header>

    <!-- Tab 분리 + Saved Views -->
    <div class="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-1 text-xs">
      <div class="flex gap-1">
        <button
          v-for="t in (['active', 'pinned', 'snoozed'] as Tab[])"
          :key="t"
          type="button"
          class="rounded px-2 py-0.5"
          :class="
            tab === t
              ? 'bg-accent text-accent-foreground font-semibold'
              : 'text-muted-foreground hover:bg-accent/40'
          "
          @click="tab = t"
        >
          {{ t === 'active' ? 'Active' : t === 'pinned' ? `⭐ ${stats.pinned}` : `💤 ${stats.snoozed}` }}
        </button>
      </div>

      <div class="ml-auto flex items-center gap-1">
        <span class="text-muted-foreground">View:</span>
        <button
          v-for="v in savedViews.views.value"
          :key="v.id"
          type="button"
          class="group rounded border border-border px-1.5 py-0.5 hover:bg-accent/40"
          @click="applyView(v)"
        >
          {{ v.name }}
          <span
            class="ml-1 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100"
            @click.stop="savedViews.deleteMut.mutate(v.id)"
            >✕</span
          >
        </button>
        <input
          v-model="newViewName"
          placeholder="현재 필터 저장"
          class="w-32 rounded border border-input bg-background px-1.5 py-0.5"
          @keyup.enter="saveCurrentView"
        />
        <button
          v-if="newViewName.trim()"
          type="button"
          class="rounded border border-border px-1.5 py-0.5 hover:bg-accent/40"
          @click="saveCurrentView"
        >
          +
        </button>
      </div>
    </div>

    <div
      v-if="error"
      class="m-3 rounded border border-destructive bg-destructive/10 p-2 text-xs whitespace-pre-wrap"
    >
      {{ describeError(error) }}
    </div>

    <div class="flex-1 overflow-auto p-4">
      <!-- 사람 PR (Active / Pinned / Snoozed 탭별) -->
      <section v-if="tab === 'active' && activeNotSnoozedRows.length" class="mb-6">
        <h2 class="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
          PR ({{ activeNotSnoozedRows.length }})
          <span v-if="stats.snoozed > 0" class="ml-2 text-[10px] normal-case">
            💤 {{ stats.snoozed }}개 snoozed (탭 전환)
          </span>
        </h2>
        <div class="overflow-hidden rounded-md border border-border">
          <table class="w-full text-sm">
            <thead class="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th class="w-8 px-2 py-1.5 text-left font-normal">📌</th>
                <th class="w-40 px-2 py-1.5 text-left font-normal">레포</th>
                <th class="w-12 px-2 py-1.5 text-left font-normal">#</th>
                <th class="px-2 py-1.5 text-left font-normal">제목</th>
                <th class="w-28 px-2 py-1.5 text-left font-normal">작성자</th>
                <th class="w-32 px-2 py-1.5 text-left font-normal">브랜치</th>
                <th class="w-16 px-2 py-1.5 text-left font-normal">상태</th>
                <th class="w-16 px-2 py-1.5 text-left font-normal">갱신</th>
                <th class="w-16 px-2 py-1.5 text-center font-normal">💤</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in activeNotSnoozedRows"
                :key="`${row.repoName}-${row.pr.number}`"
                class="border-t border-border/50 hover:bg-accent/30"
                :class="meta.isPinned(row.pr) ? 'bg-amber-500/5' : ''"
              >
                <td class="px-2 py-1 text-center">
                  <button
                    type="button"
                    :class="meta.isPinned(row.pr) ? 'text-amber-500' : 'text-muted-foreground/50 hover:text-foreground'"
                    :title="meta.isPinned(row.pr) ? 'Unpin' : 'Pin'"
                    @click="togglePin(row.pr)"
                  >
                    {{ meta.isPinned(row.pr) ? '⭐' : '☆' }}
                  </button>
                </td>
                <td class="truncate px-2 py-1 font-mono text-xs">{{ row.repoName }}</td>
                <td class="px-2 py-1 font-mono text-xs text-muted-foreground">
                  #{{ row.pr.number }}
                </td>
                <td class="px-2 py-1">
                  <a
                    :href="row.pr.htmlUrl"
                    target="_blank"
                    rel="noopener"
                    class="hover:underline"
                  >
                    {{ row.pr.title }}
                  </a>
                  <template v-for="l in row.pr.labels" :key="l.name">
                    <span
                      class="ml-1 rounded px-1 py-0.5 text-[10px]"
                      :style="{
                        backgroundColor: l.color + '33',
                        color: l.color,
                      }"
                    >
                      {{ l.name }}
                    </span>
                  </template>
                </td>
                <td class="truncate px-2 py-1 text-xs">
                  <span class="inline-flex items-center gap-1">
                    <UserAvatar
                      :username="row.pr.author.username"
                      :avatar-url="row.pr.author.avatarUrl"
                      size-class="w-4 h-4"
                    />
                    {{ row.pr.author.username }}
                  </span>
                </td>
                <td class="truncate px-2 py-1 font-mono text-[10px] text-muted-foreground">
                  {{ row.pr.headBranch }}
                </td>
                <td :class="['px-2 py-1 text-[10px] uppercase', stateColor(row.pr.state)]">
                  {{ row.pr.state }}
                </td>
                <td class="px-2 py-1 text-[10px] text-muted-foreground">
                  {{ fmtDate(row.pr.updatedAt) }}
                </td>
                <td class="relative px-2 py-1 text-center">
                  <button
                    type="button"
                    class="text-muted-foreground/50 hover:text-foreground"
                    title="Snooze"
                    @click="openSnoozeMenu(row)"
                  >
                    💤
                  </button>
                  <div
                    v-if="snoozeMenuFor === rowKey(row)"
                    class="absolute right-0 top-full z-10 mt-1 w-32 rounded-md border border-border bg-card text-xs shadow-lg"
                  >
                    <ul class="py-1">
                      <li
                        v-for="opt in SNOOZE_OPTIONS"
                        :key="opt.sec"
                        class="cursor-pointer px-3 py-1 text-left hover:bg-accent/40"
                        @click="applySnooze(row, opt)"
                      >
                        {{ opt.label }}
                      </li>
                    </ul>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Pinned 탭 -->
      <section v-if="tab === 'pinned'" class="mb-6">
        <h2 class="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
          ⭐ Pinned ({{ pinnedRows.length }})
        </h2>
        <div v-if="pinnedRows.length === 0" class="rounded border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          핀 된 PR 없음. Active 탭의 ☆ 클릭으로 핀.
        </div>
        <ul v-else class="rounded-md border border-border">
          <li
            v-for="row in pinnedRows"
            :key="`pin-${row.repoName}-${row.pr.number}`"
            class="flex items-center gap-2 border-b border-border/50 px-2 py-1.5 last:border-0 hover:bg-accent/30"
          >
            <button
              type="button"
              class="text-amber-500"
              title="Unpin"
              @click="togglePin(row.pr)"
            >
              ⭐
            </button>
            <span class="font-mono text-xs">{{ row.repoName }}</span>
            <span class="text-xs text-muted-foreground">#{{ row.pr.number }}</span>
            <a
              :href="row.pr.htmlUrl"
              target="_blank"
              rel="noopener"
              class="flex-1 truncate text-sm hover:underline"
            >
              {{ row.pr.title }}
            </a>
            <span :class="['text-[10px] uppercase', stateColor(row.pr.state)]">
              {{ row.pr.state }}
            </span>
          </li>
        </ul>
      </section>

      <!-- Snoozed 탭 -->
      <section v-if="tab === 'snoozed'" class="mb-6">
        <h2 class="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
          💤 Snoozed ({{ snoozedRows.length }})
        </h2>
        <div v-if="snoozedRows.length === 0" class="rounded border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          Snooze 된 PR 없음. Active 탭의 💤 클릭으로 snooze.
        </div>
        <ul v-else class="rounded-md border border-border">
          <li
            v-for="row in snoozedRows"
            :key="`snooze-${row.repoName}-${row.pr.number}`"
            class="flex items-center gap-2 border-b border-border/50 px-2 py-1.5 last:border-0 hover:bg-accent/30"
          >
            <button
              type="button"
              class="text-sky-500"
              title="Snooze 해제"
              @click="unsnooze(row)"
            >
              💤
            </button>
            <span class="font-mono text-xs">{{ row.repoName }}</span>
            <span class="text-xs text-muted-foreground">#{{ row.pr.number }}</span>
            <a
              :href="row.pr.htmlUrl"
              target="_blank"
              rel="noopener"
              class="flex-1 truncate text-sm hover:underline"
            >
              {{ row.pr.title }}
            </a>
            <span class="text-[10px] text-sky-500">
              {{ fmtRemaining(meta.snoozeRemaining(row.pr) ?? 0) }} 남음
            </span>
          </li>
        </ul>
      </section>

      <!-- 봇 PR -->
      <section v-if="showBots && botPrs.length && tab === 'active'" class="mb-6">
        <h2 class="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
          🤖 봇 PR ({{ botPrs.length }})
        </h2>
        <div class="overflow-hidden rounded-md border border-border">
          <table class="w-full text-sm">
            <tbody>
              <tr
                v-for="row in botPrs"
                :key="`${row.repoName}-${row.pr.number}-bot`"
                class="border-t border-border/50 hover:bg-accent/30"
              >
                <td class="px-2 py-1 font-mono text-xs">{{ row.repoName }}</td>
                <td class="px-2 py-1 font-mono text-xs text-muted-foreground w-12">
                  #{{ row.pr.number }}
                </td>
                <td class="px-2 py-1 truncate">
                  <a :href="row.pr.htmlUrl" target="_blank" rel="noopener" class="hover:underline">
                    {{ row.pr.title }}
                  </a>
                </td>
                <td class="px-2 py-1 text-xs text-muted-foreground w-28">
                  <span class="inline-flex items-center gap-1">
                    <UserAvatar
                      :username="row.pr.author.username"
                      :avatar-url="row.pr.author.avatarUrl"
                      size-class="w-4 h-4"
                    />
                    {{ row.pr.author.username }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 실패한 레포 -->
      <section v-if="failedRepos.length" class="mb-6">
        <h2 class="mb-2 text-xs uppercase tracking-wider text-amber-500">
          ⚠ 조회 실패 ({{ failedRepos.length }})
        </h2>
        <ul class="rounded-md border border-amber-500/30 bg-amber-500/5">
          <li
            v-for="r in failedRepos"
            :key="r.repoId"
            class="border-b border-amber-500/20 px-3 py-1.5 text-xs last:border-0"
          >
            <span class="font-mono">{{ r.repoName }}</span>
            <span class="ml-2 text-muted-foreground">
              {{ r.error?.split('\n')[0] || '?' }}
            </span>
          </li>
        </ul>
        <p class="mt-1 text-[10px] text-muted-foreground">
          힌트: forge 계정 (PAT) 미등록이거나 forge_kind=unknown 인 레포는 자동 skip 됩니다.
          설정 → Forge 계정 에서 등록.
        </p>
      </section>

      <div
        v-if="!isFetching && stats.total === 0 && failedRepos.length === 0"
        class="mt-12 text-center text-sm text-muted-foreground"
      >
        PR 없음. 워크스페이스 / 필터 / Forge 계정 등록 상태 확인.
      </div>
    </div>
  </div>
</template>
