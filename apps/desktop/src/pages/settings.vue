<script setup lang="ts">
// 설정 페이지 — Sprint B10 (`docs/plan/11 §23`).
//
// GitKraken Preferences 트리 60% 흡수 골격:
//   - Profiles (이미 ProfilesSection)
//   - Forge Accounts / Integrations (이미 ForgeSetup)
//   - General — 진행 중 (Auto-Fetch / Default branch / Auto-Prune)
//   - UI Customization — 진행 중 (Date locale / Hide Launchpad / Avatars)
//   - Editor / Terminal — 위임 (Zoom 은 ⌘=/-/0, Tab 폰트는 v1.x)
//   - About — 단순 텍스트
//
// 영속화: localStorage (DB 통합은 v1.x). Cloud / Org / Marketing 항목은 거부.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ForgeSetup from '@/components/ForgeSetup.vue'
import GitKrakenImportModal from '@/components/GitKrakenImportModal.vue'
// Sprint c35 — plan/26 Phase 2: 차별점 패널.
import IdentityCard from '@/components/IdentityCard.vue'
import ProfilesSection from '@/components/ProfilesSection.vue'
import RepoSpecificForm from '@/components/RepoSpecificForm.vue'
// Sprint c40 — settings template 분해 (5 sub-component).
import SettingsGeneral from '@/components/SettingsGeneral.vue'
import SettingsUiCustomization from '@/components/SettingsUiCustomization.vue'
import SettingsEditor from '@/components/SettingsEditor.vue'
import SettingsMaintenance from '@/components/SettingsMaintenance.vue'
import SettingsPluginIntegration from '@/components/SettingsPluginIntegration.vue'
// Plan #42 H-1 — Conflict Prevention Settings UI 노출 (Sprint c96+).
import SettingsConflictPrevention from '@/components/SettingsConflictPrevention.vue'
// Plan #42 H-2 — LFS Settings UI 노출 (LfsPanel wrap).
import SettingsLfs from '@/components/SettingsLfs.vue'
// Plan #42 H-3 — Encoding identity-core UI (한글 안전 가이드).
import SettingsEncoding from '@/components/SettingsEncoding.vue'
// Plan #42 H-4 — Commit Settings (push-after / skip hooks / squash / template).
import SettingsCommit from '@/components/SettingsCommit.vue'
// Plan #42 M-3 — Issue Tracker Settings (forge 1급 + 외부 tracker 결정 안내).
import SettingsIssueTracker from '@/components/SettingsIssueTracker.vue'
// Plan #42 M-1 — Git Hooks manager (read-only scan, Sprint c99).
import SettingsGitHooks from '@/components/SettingsGitHooks.vue'
// Plan #42 M-2 — Sparse Checkout repo manager (Sprint c100).
import SettingsSparseCheckout from '@/components/SettingsSparseCheckout.vue'
import { useUiState } from '@/composables/useUiState'
import { resetAllSettings } from '@/composables/useUserSettings'
import { confirmDialog } from '@/composables/useConfirm'

type Category =
  | 'profiles'
  | 'forge'
  | 'general'
  | 'ui'
  | 'editor'
  | 'repoSpecific'
  | 'conflictPrevention'
  | 'lfs'
  | 'encoding'
  | 'commit'
  | 'issueTracker'
  | 'gitHooks'
  | 'sparseCheckout'
  | 'maintenance'
  | 'migrate'
  | 'about'
  | 'plugin'

// Sprint 22-15 M1 — Settings 2-level 6 그룹 (plan/24 §5 C-7 Q1 / design §8-1 hard constraint).
// v1.0 12+ 카테고리 확장 대비 평면 9 → grouping 6.
interface CategoryGroup {
  id: string
  label: string
  items: { id: Category; label: string; futureRelease?: boolean }[]
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: 'account',
    label: '계정',
    items: [
      { id: 'profiles', label: 'Profiles' },
      { id: 'forge', label: 'Forge 계정 (PAT)' },
    ],
  },
  {
    id: 'workspace',
    label: '워크스페이스',
    items: [
      { id: 'repoSpecific', label: 'Repository-Specific' },
      // Plan #42 H-1 (Sprint c96+) — GitKraken Settings 의 Repo-Specific
      // Conflict Prevention 의 git-fried 매핑. global default 우선 (per-repo
      // override 는 다음 sprint M-1.1).
      { id: 'conflictPrevention', label: 'Conflict Prevention' },
      // Plan #42 H-2 — GitKraken Settings 의 Repo-Specific LFS 매핑.
      // LfsPanel (280 LOC, lfs_commands.rs 9 IPC) 를 Settings 진입점으로 노출.
      { id: 'lfs', label: 'Git LFS' },
      // Plan #42 H-3 — Encoding identity-core 가이드 (한글 안전).
      // RepoSpecificForm 의 i18n.commitEncoding/logOutputEncoding 안내.
      { id: 'encoding', label: 'Encoding (한글 안전)' },
      // Plan #42 H-4 — Commit Settings (4 toggle + template).
      // UI/persistence 만, mutation 측 실 적용은 M-1.2.
      { id: 'commit', label: 'Commit' },
      // Plan #42 M-3 — Issue Tracker (forge 1급 + 외부 tracker 결정 안내).
      { id: 'issueTracker', label: 'Issue Tracker' },
      // Plan #42 M-1 — Git Hooks manager (read-only scan, Sprint c99).
      { id: 'gitHooks', label: 'Git Hooks' },
      // Plan #42 M-2 — Sparse Checkout repo manager (Sprint c100).
      { id: 'sparseCheckout', label: 'Sparse Checkout' },
    ],
  },
  {
    id: 'editor',
    label: '에디터·터미널',
    items: [{ id: 'editor', label: 'Editor / Terminal (★ AI CLI)' }],
  },
  {
    id: 'ui',
    label: 'UI',
    items: [{ id: 'ui', label: 'UI Customization' }],
  },
  {
    id: 'maintenance',
    label: '유지보수',
    items: [{ id: 'maintenance', label: 'gc / fsck / LFS' }],
  },
  // Sprint 22-19 E-8 — design §8-3 Plugin/Integration slot.
  // 현재 placeholder 상태 (외부 도구 연결, v0.5+). 카테고리 자체를 미리 노출해 미래 확장 자리 확보.
  {
    id: 'plugin',
    label: 'Plugin',
    items: [{ id: 'plugin', label: '외부 도구 연결 (v0.5 예정)', futureRelease: true }],
  },
  {
    id: 'start',
    label: '시작·마이그레이션',
    items: [
      { id: 'general', label: 'General' },
      { id: 'migrate', label: 'GitKraken 마이그레이션' },
      { id: 'about', label: 'About' },
    ],
  },
]

// Sprint c31 — group label 은 i18n settings.categories.* 키로 매핑.
// plan/30 P1-8 — items.label 도 settings.items.* 로 i18n 마이그 (Round 6 EN 16+ hardcoded ko 해소).
const GROUP_I18N_KEY: Record<string, string> = {
  account: 'settings.categories.account',
  workspace: 'settings.categories.workspace',
  editor: 'settings.categories.editor',
  ui: 'settings.categories.ui',
  maintenance: 'settings.categories.maintenance',
  plugin: 'settings.categories.plugin',
  start: 'settings.categories.start',
}
const ITEM_I18N_KEY: Record<string, string> = {
  profiles: 'settings.items.profiles',
  forge: 'settings.items.forge',
  repoSpecific: 'settings.items.repoSpecific',
  conflictPrevention: 'settings.items.conflictPrevention',
  lfs: 'settings.items.lfs',
  encoding: 'settings.items.encoding',
  commit: 'settings.items.commit',
  issueTracker: 'settings.items.issueTracker',
  gitHooks: 'settings.items.gitHooks',
  sparseCheckout: 'settings.items.sparseCheckout',
  editor: 'settings.items.editor',
  ui: 'settings.items.ui',
  maintenance: 'settings.items.maintenance',
  plugin: 'settings.items.plugin',
  general: 'settings.items.general',
  migrate: 'settings.items.migrate',
  about: 'settings.items.about',
}

const { t } = useI18n()

const active = ref<Category>('profiles')

// R2-S2 — 카테고리 nav 검색 (번역 라벨 substring 매칭).
const navQuery = ref('')
const filteredGroups = computed(() => {
  const q = navQuery.value.trim().toLowerCase()
  if (!q) return CATEGORY_GROUPS
  return CATEGORY_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((c) =>
      t(ITEM_I18N_KEY[c.id] ?? c.label)
        .toLowerCase()
        .includes(q),
    ),
  })).filter((g) => g.items.length > 0)
})

// R6-002 — 설정 전체 기본값 복원.
async function onResetAll() {
  const ok = await confirmDialog({
    title: t('settings.resetAllTitle'),
    message: t('settings.resetAllMessage'),
    danger: true,
  })
  if (ok) resetAllSettings()
}

// ===== GitKraken 마이그레이션 =====
const importGkOpen = ref(false)

// 유지보수 / General / UI / Editor 영역은 c40 후속에서 sub-component 로 이전.

// ===== About =====
const uiState = useUiState()
const buildInfo = computed(() => ({
  // Sprint c31 PR-B — version 0.0.0 → 0.3.0 동기 (tauri.conf.json + Cargo.toml + package.json).
  version: '0.3.0',
  zoomPx: uiState.zoomPx.value,
  sidebarVisible: uiState.sidebarVisible.value,
  detailVisible: uiState.detailVisible.value,
}))
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <!-- Sprint 22-15 M1 — 좌측 카테고리 nav (2-level 6 그룹).
         design §8-1 hard constraint: v1.0 12+ 카테고리 확장 대비.
    -->
    <nav
      class="w-52 shrink-0 overflow-auto border-r border-border bg-card py-4 text-sm"
      :aria-label="t('a11y.ariaLabel.settingsCategory')"
    >
      <h1 class="px-4 pb-2 text-base font-semibold">{{ t('settings.title') }}</h1>
      <!-- R2-S2 — 카테고리 검색 -->
      <div class="px-3 pb-2">
        <input
          v-model="navQuery"
          type="search"
          :placeholder="t('settings.navSearchPlaceholder')"
          class="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          :aria-label="t('settings.navSearchPlaceholder')"
        />
      </div>
      <p v-if="filteredGroups.length === 0" class="px-4 py-2 text-xs text-muted-foreground">
        {{ t('settings.navSearchEmpty') }}
      </p>
      <ul class="flex flex-col gap-1">
        <li v-for="g in filteredGroups" :key="g.id">
          <div
            class="px-4 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80"
          >
            {{ t(GROUP_I18N_KEY[g.id] ?? g.label) }}
          </div>
          <ul>
            <li v-for="c in g.items" :key="c.id">
              <button
                type="button"
                class="w-full px-4 py-1 pl-6 text-left text-[13px]"
                :class="[
                  c.futureRelease
                    ? 'cursor-not-allowed text-muted-foreground/50'
                    : 'hover:bg-accent/40',
                  active === c.id && !c.futureRelease
                    ? 'bg-accent text-accent-foreground font-semibold'
                    : c.futureRelease
                      ? ''
                      : 'text-muted-foreground',
                ]"
                :data-testid="`settings-category-${c.id}`"
                :aria-pressed="active === c.id"
                :aria-disabled="c.futureRelease ? 'true' : undefined"
                :aria-label="`${t(GROUP_I18N_KEY[g.id] ?? g.label)} > ${t(ITEM_I18N_KEY[c.id] ?? c.label)}`"
                :title="c.futureRelease ? 'v0.5 출시 예정 — 현재 비활성' : undefined"
                @click="!c.futureRelease && (active = c.id)"
              >
                {{ t(ITEM_I18N_KEY[c.id] ?? c.label) }}
              </button>
            </li>
          </ul>
        </li>
      </ul>
      <!-- R6-002 — 설정 기본값 복원 -->
      <div class="mt-4 border-t border-border px-3 pt-3">
        <button
          type="button"
          class="w-full rounded-md border border-input px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
          @click="onResetAll"
        >
          ↺ {{ t('settings.resetAll') }}
        </button>
      </div>
    </nav>

    <!-- 우측 콘텐츠 -->
    <section class="flex-1 overflow-auto p-6">
      <ProfilesSection v-if="active === 'profiles'" />
      <ForgeSetup v-else-if="active === 'forge'" />

      <!-- General -->
      <SettingsGeneral v-else-if="active === 'general'" />

      <!-- UI Customization -->
      <SettingsUiCustomization v-else-if="active === 'ui'" />

      <!-- Editor / Terminal -->
      <SettingsEditor v-else-if="active === 'editor'" />

      <!-- Repository-Specific -->
      <RepoSpecificForm v-else-if="active === 'repoSpecific'" />

      <!-- Plan #42 H-1 — Conflict Prevention -->
      <SettingsConflictPrevention v-else-if="active === 'conflictPrevention'" />

      <!-- Plan #42 H-2 — Git LFS (LfsPanel wrap) -->
      <SettingsLfs v-else-if="active === 'lfs'" />

      <!-- Plan #42 H-3 — Encoding 한글 안전 가이드 -->
      <SettingsEncoding v-else-if="active === 'encoding'" />

      <!-- Plan #42 H-4 — Commit 4 toggle + template -->
      <SettingsCommit v-else-if="active === 'commit'" />

      <!-- Plan #42 M-3 — Issue Tracker forge 1급 안내 -->
      <SettingsIssueTracker
        v-else-if="active === 'issueTracker'"
        @navigate="(target) => (active = target)"
      />

      <!-- Plan #42 M-1 — Git Hooks manager (read-only scan) -->
      <SettingsGitHooks v-else-if="active === 'gitHooks'" />

      <!-- Plan #42 M-2 — Sparse Checkout repo manager -->
      <SettingsSparseCheckout v-else-if="active === 'sparseCheckout'" />

      <!-- 유지보수 -->
      <SettingsMaintenance v-else-if="active === 'maintenance'" />

      <!-- 마이그레이션 -->
      <div v-else-if="active === 'migrate'" class="flex max-w-2xl flex-col gap-4">
        <h2 class="text-lg font-semibold">마이그레이션</h2>
        <p class="text-xs text-muted-foreground">
          기존 git client 의 로컬 데이터 (레포 / 워크스페이스 / 즐겨찾기 / 활성 탭) 를 git-fried 로
          가져옵니다. PAT (토큰) 은 보안상 별도 재입력이 필요합니다.
        </p>

        <div class="rounded border border-border bg-muted/20 p-4 text-sm">
          <h3 class="font-semibold">📦 GitKraken</h3>
          <p class="mt-1 text-xs text-muted-foreground">
            <code>%APPDATA%/.gitkraken/</code> 에서 자동 탐지 → 로컬 레포 path / Workspace /
            즐겨찾기 / 활성 탭 import.
          </p>
          <button
            type="button"
            class="mt-3 rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:opacity-90"
            @click="importGkOpen = true"
          >
            GitKraken 가져오기
          </button>
        </div>

        <p class="text-[10px] text-muted-foreground">
          v1.x 추가 후보: Sourcetree / Fork / GitUp / SmartGit.
        </p>
      </div>

      <!-- Sprint 22-19 E-8 — Plugin / Integration slot (design §8-3 hard constraint).
           외부 도구 연결 placeholder. v0.5+ 에서 plugin API 도입 시 본 영역 채워짐.
           c40 sub-component 분리 — SettingsPluginIntegration.vue.
      -->
      <SettingsPluginIntegration v-else-if="active === 'plugin'" />

      <!-- About -->
      <div v-else-if="active === 'about'" class="flex max-w-2xl flex-col gap-4">
        <h2 class="text-lg font-semibold">About git-fried</h2>
        <p class="text-sm text-muted-foreground">
          GitKraken 대체 데스크탑 git client — Tauri 2 + Vue 3 + Rust. Gitea 1급, 한글 안전, AI CLI
          위임.
        </p>
        <!-- Sprint c35 plan/26 Phase 2 — 차별점 패널 (3 정체성 + dogfood 통계) -->
        <IdentityCard />
        <ul class="space-y-1 rounded border border-border bg-muted/20 p-3 text-xs">
          <li>
            버전: <span class="font-mono">{{ buildInfo.version }}</span>
          </li>
          <li>
            Zoom: <span class="font-mono">{{ buildInfo.zoomPx }}px</span>
          </li>
          <li>Sidebar: {{ buildInfo.sidebarVisible ? 'visible' : 'hidden' }}</li>
          <li>Detail panel: {{ buildInfo.detailVisible ? 'visible' : 'hidden' }}</li>
        </ul>
        <p class="text-[10px] text-muted-foreground">
          ? 키보드 단축키 도움말. ⌘P Command Palette. ⌘\` Terminal.
        </p>
      </div>
    </section>

    <GitKrakenImportModal :open="importGkOpen" @close="importGkOpen = false" />
  </div>
</template>
