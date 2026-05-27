<script setup lang="ts">
// Launchpad — 워크스페이스 모든 레포 PR 통합 보드.
// GitKraken Cloud Workspace 의 로컬 first 버전.
//
// 핵심 가치 (`docs/plan/02 §3 W1`): 회사 50+ 레포 PR 전체 조망 + bot/사람 분리.
//
// Sprint A4 추가: Pin / Snooze / Saved Views (`docs/plan/11 §14`).
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PrState } from '@/api/git'
import { useReposStore } from '@/stores/repos'
import { describeError } from '@/api/errors'
import {
  useLaunchpadMeta,
  useSavedViews,
  LAUNCHPAD_VIEW_KIND,
} from '@/composables/useLaunchpadMeta'
import { useLaunchpadFilter } from '@/composables/useLaunchpadFilter'
// /analyze 후속 (2026-05-04) — launchpad.vue (620 LOC) row derivation 분리.
import { useLaunchpadRows } from '@/composables/useLaunchpadRows'
// Sprint c40 — snooze + saved views + togglePin/rowKey 분리.
import { useLaunchpadActions, SNOOZE_OPTIONS, type Tab } from '@/composables/useLaunchpadActions'
import {
  formatDateLocalized,
  formatRelativeTime,
  useUiSettingsStore,
} from '@/composables/useUserSettings'
import UserAvatar from '@/components/UserAvatar.vue'

const { t } = useI18n()
const store = useReposStore()
const stateFilter = ref<PrState | null>('open')
const showBots = ref(false)
const tab = ref<Tab>('active')

// === Sprint C14-2 F2 (`docs/plan/14 §7 F2`): PR Filter syntax ===
// Sprint c30 / HIGH 2 — composables/useLaunchpadFilter.ts 로 추출 (검색 파서 + 매처).
// FILTER_HELPERS / appendFilter 는 그대로 유지 (UI 보존).
const meta = useLaunchpadMeta()
const savedViews = useSavedViews(LAUNCHPAD_VIEW_KIND)

const {
  searchQuery,
  matches: matchesQuery,
  appendFilter,
  helpers: FILTER_HELPERS,
} = useLaunchpadFilter(() => ({
  isPinned: (pr) => meta.isPinned(pr),
  snoozeRemaining: (pr) => meta.snoozeRemaining(pr),
  isBot,
}))

// /analyze 후속 — query + 9 derived computed + isBot 휴리스틱 캡슐화.
// (data / flatRows / humanPrs 는 template 미참조이지만 composable 캐시 용도로 보관)
const {
  isFetching,
  error,
  refetch,
  botPrs,
  pinnedRows,
  snoozedRows,
  activeNotSnoozedRows,
  failedRepos,
  stats,
  isBot,
} = useLaunchpadRows({
  workspaceId: () => store.activeWorkspaceId,
  stateFilter: () => stateFilter.value,
  matches: matchesQuery,
  isPinned: (pr) => meta.isPinned(pr),
  snoozeRemaining: (pr) => meta.snoozeRemaining(pr),
})

// c58 — UiSettings.commitTimeFormat 통합 (plan/30 P3-3 후속).
const ui = useUiSettingsStore()
function fmtDate(unix: number): string {
  const fmt = ui.value.commitTimeFormat
  const abs = formatDateLocalized(unix, { month: '2-digit', day: '2-digit' })
  if (fmt === 'absolute') return abs
  const rel = formatRelativeTime(unix, t)
  if (fmt === 'relative') return rel
  return `${rel} (${abs})`
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

// Sprint c40 — togglePin + snooze 메뉴 + saved views composable 위임.
const {
  togglePin,
  snoozeMenuFor,
  openSnoozeMenu,
  applySnooze,
  unsnooze,
  newViewName,
  saveCurrentView,
  applyView,
  rowKey,
} = useLaunchpadActions({
  meta,
  savedViews,
  stateFilterRef: stateFilter,
  showBotsRef: showBots,
  tabRef: tab,
})
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <header class="flex items-center justify-between border-b border-border bg-card px-4 py-2">
      <div class="flex items-center gap-3">
        <h1 class="text-base font-semibold">Launchpad</h1>
        <span class="text-xs text-muted-foreground">
          {{ stats.reposWithPrs }}/{{ stats.reposScanned }} 레포 · PR {{ stats.human }}+{{
            stats.bot
          }}봇
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
            class="rounded-md border border-input px-2.5 py-1 min-h-[28px] text-xs"
            :class="
              stateFilter === s ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
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
          class="flex items-center justify-center rounded-md border border-input min-h-[28px] min-w-[28px] px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-50"
          :disabled="isFetching"
          :aria-label="t('common.refresh')"
          @click="refetch()"
        >
          {{ isFetching ? '...' : '↻' }}
        </button>
      </div>
    </header>

    <!-- Sprint C14-2 F2 — PR 검색 (filter syntax) -->
    <div
      class="flex flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-4 py-1.5 text-xs"
    >
      <input
        v-model="searchQuery"
        placeholder="검색: title 또는 author:tg state:open repo:foo is:pinned ..."
        class="min-w-[280px] flex-1 rounded border border-input bg-background px-2 py-0.5"
      />
      <div class="flex flex-wrap gap-1">
        <button
          v-for="h in FILTER_HELPERS"
          :key="h.label"
          type="button"
          class="rounded border border-border px-2 py-1 min-h-[24px] text-xs text-muted-foreground hover:bg-accent/40"
          :title="`'${h.insert}' 추가`"
          @click="appendFilter(h.insert)"
        >
          {{ h.label }}
        </button>
        <button
          v-if="searchQuery"
          type="button"
          class="rounded border border-destructive/40 px-2 py-1 min-h-[24px] text-xs text-destructive hover:bg-destructive/10"
          @click="searchQuery = ''"
        >
          ✕ clear
        </button>
      </div>
    </div>

    <!-- Tab 분리 + Saved Views -->
    <div class="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-1 text-xs">
      <div class="flex gap-1">
        <button
          v-for="t in ['active', 'pinned', 'snoozed'] as Tab[]"
          :key="t"
          type="button"
          class="rounded px-2.5 py-1 min-h-[28px] text-xs"
          :class="
            tab === t
              ? 'bg-accent text-accent-foreground font-semibold'
              : 'text-muted-foreground hover:bg-accent/40'
          "
          @click="tab = t"
        >
          {{
            t === 'active'
              ? 'Active'
              : t === 'pinned'
                ? `⭐ ${stats.pinned}`
                : `💤 ${stats.snoozed}`
          }}
        </button>
      </div>

      <div class="ml-auto flex items-center gap-1">
        <span class="text-muted-foreground">View:</span>
        <div
          v-for="v in savedViews.views.value"
          :key="v.id"
          class="group flex items-center rounded border border-border hover:bg-accent/40"
        >
          <button
            type="button"
            class="rounded-l px-2 py-1 min-h-[24px] text-xs"
            @click="applyView(v)"
          >
            {{ v.name }}
          </button>
          <button
            type="button"
            class="flex items-center justify-center rounded-r min-h-[24px] min-w-[24px] px-1 text-[11px] text-muted-foreground opacity-0 hover:bg-destructive/20 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
            :aria-label="t('launchpad.deleteSavedView', { name: v.name })"
            @click.stop="savedViews.deleteMut.mutate(v.id)"
          >
            ✕
          </button>
        </div>
        <input
          v-model="newViewName"
          placeholder="현재 필터 저장"
          class="w-32 rounded border border-input bg-background px-2 py-1 min-h-[28px] text-xs"
          @keyup.enter="saveCurrentView"
        />
        <button
          v-if="newViewName.trim()"
          type="button"
          class="flex items-center justify-center rounded border border-border min-h-[24px] min-w-[24px] px-2 py-1 text-xs hover:bg-accent/40"
          :aria-label="t('common.add')"
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
            💤 {{ t('launchpad.snoozedHint', { n: stats.snoozed }) }}
          </span>
        </h2>
        <div class="overflow-hidden rounded-md border border-border">
          <table class="w-full text-sm">
            <thead class="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th class="w-8 px-2 py-1.5 text-left font-normal">📌</th>
                <th class="w-40 px-2 py-1.5 text-left font-normal">
                  {{ t('launchpad.header.repo') }}
                </th>
                <th class="w-12 px-2 py-1.5 text-left font-normal">#</th>
                <th class="px-2 py-1.5 text-left font-normal">{{ t('launchpad.header.title') }}</th>
                <th class="w-28 px-2 py-1.5 text-left font-normal">
                  {{ t('launchpad.header.author') }}
                </th>
                <th class="w-32 px-2 py-1.5 text-left font-normal">
                  {{ t('launchpad.header.branch') }}
                </th>
                <th class="w-16 px-2 py-1.5 text-left font-normal">
                  {{ t('launchpad.header.status') }}
                </th>
                <th class="w-16 px-2 py-1.5 text-left font-normal">
                  {{ t('launchpad.header.updated') }}
                </th>
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
                    :class="
                      meta.isPinned(row.pr)
                        ? 'text-amber-500'
                        : 'text-muted-foreground/50 hover:text-foreground'
                    "
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
                  <a :href="row.pr.htmlUrl" target="_blank" rel="noopener" class="hover:underline">
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
                    <ul class="py-1" role="menu">
                      <li
                        v-for="opt in SNOOZE_OPTIONS"
                        :key="opt.sec"
                        class="cursor-pointer px-3 py-1 text-left hover:bg-accent/40 focus:bg-accent/40 focus:outline-none"
                        role="menuitem"
                        tabindex="0"
                        @click="applySnooze(row, opt)"
                        @keydown.enter.self="applySnooze(row, opt)"
                        @keydown.space.self.prevent="applySnooze(row, opt)"
                      >
                        {{ t(opt.label) }}
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
        <div
          v-if="pinnedRows.length === 0"
          class="rounded border border-dashed border-border p-6 text-center text-xs text-muted-foreground"
        >
          핀 된 PR 없음. Active 탭의 ☆ 클릭으로 핀.
        </div>
        <ul v-else class="rounded-md border border-border">
          <li
            v-for="row in pinnedRows"
            :key="`pin-${row.repoName}-${row.pr.number}`"
            class="flex items-center gap-2 border-b border-border/50 px-2 py-1.5 last:border-0 hover:bg-accent/30"
          >
            <button type="button" class="text-amber-500" title="Unpin" @click="togglePin(row.pr)">
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
        <div
          v-if="snoozedRows.length === 0"
          class="rounded border border-dashed border-border p-6 text-center text-xs text-muted-foreground"
        >
          Snooze 된 PR 없음. Active 탭의 💤 클릭으로 snooze.
        </div>
        <ul v-else class="rounded-md border border-border">
          <li
            v-for="row in snoozedRows"
            :key="`snooze-${row.repoName}-${row.pr.number}`"
            class="flex items-center gap-2 border-b border-border/50 px-2 py-1.5 last:border-0 hover:bg-accent/30"
          >
            <button type="button" class="text-sky-500" title="Snooze 해제" @click="unsnooze(row)">
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
          힌트: forge 계정 (PAT) 미등록이거나 forge_kind=unknown 인 레포는 자동 skip 됩니다. 설정 →
          Forge 계정 에서 등록.
        </p>
      </section>

      <div
        v-if="!isFetching && stats.total === 0 && failedRepos.length === 0"
        class="mt-12 text-center text-sm text-muted-foreground"
      >
        <p>{{ t('launchpad.emptyText') }}</p>
        <!-- UXF-30 — 빈 상태에 다음 단계 CTA -->
        <div class="mt-3 flex items-center justify-center gap-2">
          <RouterLink
            to="/settings"
            class="rounded-md border border-input px-3 py-1 text-xs hover:bg-accent"
          >
            {{ t('launchpad.emptyForgeSettings') }}
          </RouterLink>
          <RouterLink
            to="/repositories"
            class="rounded-md border border-input px-3 py-1 text-xs hover:bg-accent"
          >
            {{ t('launchpad.emptyRepoMgmt') }}
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>
