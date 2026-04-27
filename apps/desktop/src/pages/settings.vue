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
import ForgeSetup from '@/components/ForgeSetup.vue'
import GitKrakenImportModal from '@/components/GitKrakenImportModal.vue'
import ProfilesSection from '@/components/ProfilesSection.vue'
import { useUiState } from '@/composables/useUiState'
import { useCustomTheme } from '@/composables/useCustomTheme'
import { useToast } from '@/composables/useToast'
import {
  useGeneralSettings,
  useUiSettingsStore,
} from '@/composables/useUserSettings'

type Category =
  | 'profiles'
  | 'forge'
  | 'general'
  | 'ui'
  | 'editor'
  | 'migrate'
  | 'about'

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'profiles', label: 'Profiles' },
  { id: 'forge', label: 'Forge 계정 (PAT)' },
  { id: 'general', label: 'General' },
  { id: 'ui', label: 'UI Customization' },
  { id: 'editor', label: 'Editor / Terminal' },
  { id: 'migrate', label: '마이그레이션' },
  { id: 'about', label: 'About' },
]
const active = ref<Category>('profiles')

// ===== GitKraken 마이그레이션 =====
const importGkOpen = ref(false)

// ===== General + UI settings — Sprint D1 공용 store 로 추출 =====
const general = useGeneralSettings()
const ui = useUiSettingsStore()

// ===== Custom theme JSON (Sprint C4) =====
const ctheme = useCustomTheme()
const toast = useToast()
const themeImportText = ref('')
const themeExportText = ref('')

function onExportTheme() {
  themeExportText.value = ctheme.exportJson()
}
function onImportTheme() {
  const r = ctheme.importJson(themeImportText.value)
  if (r.ok) {
    toast.success('테마 적용', '커스텀 CSS 변수 활성화')
    themeImportText.value = ''
  } else {
    toast.error('테마 import 실패', r.error || '?')
  }
}
function onResetTheme() {
  ctheme.reset()
  toast.success('테마 초기화', '기본 dark/light 로 복원')
}
async function copyThemeExport() {
  try {
    await navigator.clipboard.writeText(themeExportText.value)
    toast.success('클립보드 복사', '')
  } catch {
    toast.error('복사 실패', '')
  }
}

// ===== About =====
const uiState = useUiState()
const buildInfo = computed(() => ({
  version: '0.0',
  zoomPx: uiState.zoomPx.value,
  sidebarVisible: uiState.sidebarVisible.value,
  detailVisible: uiState.detailVisible.value,
}))
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <!-- 좌측 카테고리 nav -->
    <nav
      class="w-48 shrink-0 overflow-auto border-r border-border bg-card py-4 text-sm"
    >
      <h1 class="px-4 pb-3 text-base font-semibold">설정</h1>
      <ul>
        <li v-for="c in CATEGORIES" :key="c.id">
          <button
            type="button"
            class="w-full px-4 py-1.5 text-left hover:bg-accent/40"
            :class="
              active === c.id
                ? 'bg-accent text-accent-foreground font-semibold'
                : 'text-muted-foreground'
            "
            @click="active = c.id"
          >
            {{ c.label }}
          </button>
        </li>
      </ul>
    </nav>

    <!-- 우측 콘텐츠 -->
    <section class="flex-1 overflow-auto p-6">
      <ProfilesSection v-if="active === 'profiles'" />
      <ForgeSetup v-else-if="active === 'forge'" />

      <!-- General -->
      <div v-else-if="active === 'general'" class="flex max-w-2xl flex-col gap-4">
        <h2 class="text-lg font-semibold">General</h2>
        <p class="text-xs text-muted-foreground">
          GitKraken Preferences > General 의 핵심 토글 흡수. localStorage 영속.
        </p>

        <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
          <span>
            <span class="font-medium">Auto-Fetch 간격 (분)</span>
            <span class="ml-2 text-xs text-muted-foreground">0 = 비활성</span>
          </span>
          <input
            v-model.number="general.autoFetchIntervalMin"
            type="number"
            min="0"
            max="120"
            class="w-20 rounded border border-input bg-background px-2 py-1 text-right text-sm"
          />
        </label>

        <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
          <span>
            <span class="font-medium">Auto-Prune on fetch</span>
            <span class="ml-2 text-xs text-muted-foreground">사라진 remote 자동 정리</span>
          </span>
          <input v-model="general.autoPruneOnFetch" type="checkbox" />
        </label>

        <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
          <span>
            <span class="font-medium">Remember tabs per profile</span>
            <span class="ml-2 text-xs text-muted-foreground">profile 전환 시 마지막 탭 복원</span>
          </span>
          <input v-model="general.rememberTabs" type="checkbox" disabled />
        </label>
        <p class="-mt-3 text-[10px] text-muted-foreground">
          (영구 활성 — Sprint B10 의 useTabPerProfile composable 동작.)
        </p>

        <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
          <span>
            <span class="font-medium">Default 브랜치 (새 레포)</span>
          </span>
          <input
            v-model="general.defaultBranch"
            class="w-32 rounded border border-input bg-background px-2 py-1 text-sm"
          />
        </label>

        <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
          <span>
            <span class="font-medium">Conflict Detection</span>
            <span class="ml-2 text-xs text-muted-foreground">
              StatusBar 의 target-branch 충돌 예측 (60s 폴링)
            </span>
          </span>
          <input v-model="general.conflictDetection" type="checkbox" />
        </label>

        <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
          <span>
            <span class="font-medium">Pull 후 submodule 자동 update</span>
            <span class="ml-2 text-xs text-muted-foreground">
              git submodule update --init --recursive
            </span>
          </span>
          <input v-model="general.autoUpdateSubmodules" type="checkbox" />
        </label>

        <p class="text-[10px] text-muted-foreground">
          v1.x 추가 예정: .orig 자동 삭제 / Longpaths / AutoCRLF / Logging level.
        </p>
      </div>

      <!-- UI Customization -->
      <div v-else-if="active === 'ui'" class="flex max-w-2xl flex-col gap-4">
        <h2 class="text-lg font-semibold">UI Customization</h2>
        <p class="text-xs text-muted-foreground">
          Theme / Zoom / Sidebar / Detail 패널은 ⌘ 단축키 + localStorage. 추가 토글 일부 v1.x.
        </p>

        <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
          <span class="font-medium">Date locale</span>
          <select
            v-model="ui.dateLocale"
            class="w-32 rounded border border-input bg-background px-2 py-1 text-sm"
          >
            <option value="auto">자동 (OS)</option>
            <option value="ko-KR">한국어</option>
            <option value="en-US">English</option>
          </select>
        </label>

        <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
          <span>
            <span class="font-medium">Launchpad 숨김</span>
            <span class="ml-2 text-xs text-muted-foreground">상단 헤더 링크 숨김</span>
          </span>
          <input v-model="ui.hideLaunchpad" type="checkbox" />
        </label>

        <label class="flex items-center justify-between gap-2 rounded border border-border p-3 text-sm">
          <span class="font-medium">아바타 스타일</span>
          <select
            v-model="ui.avatarStyle"
            class="w-32 rounded border border-input bg-background px-2 py-1 text-sm"
          >
            <option value="initial">이니셜</option>
            <option value="gravatar">Gravatar</option>
          </select>
        </label>

        <p class="text-[10px] text-muted-foreground">
          v1.x 추가 예정: 그래프 메타데이터 토글 / 알림 위치.
        </p>

        <!-- Sprint C4 — Custom theme JSON -->
        <h3 class="mt-4 text-sm font-semibold">Custom theme (JSON)</h3>
        <p class="text-xs text-muted-foreground">
          GitKraken 11.8 부터 일시 비활성된 custom theme — git-fried 가 단순 CSS
          변수 export/import 로 흡수.
          {{ ctheme.customTheme.value ? `현재 적용 중: ${ctheme.customTheme.value.name}` : '커스텀 미적용' }}
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded border border-input px-2 py-0.5 text-xs hover:bg-accent"
            @click="onExportTheme"
          >
            현재 테마 export
          </button>
          <button
            v-if="ctheme.customTheme.value"
            type="button"
            class="rounded border border-destructive/40 px-2 py-0.5 text-xs text-destructive hover:bg-destructive/10"
            @click="onResetTheme"
          >
            기본값 복원
          </button>
        </div>
        <textarea
          v-if="themeExportText"
          :value="themeExportText"
          readonly
          rows="6"
          class="mt-1 w-full rounded border border-border bg-muted/20 p-2 font-mono text-[11px]"
        />
        <button
          v-if="themeExportText"
          type="button"
          class="self-end rounded border border-input px-2 py-0.5 text-xs hover:bg-accent"
          @click="copyThemeExport"
        >
          복사
        </button>
        <textarea
          v-model="themeImportText"
          rows="5"
          placeholder='커스텀 테마 JSON 붙여넣기 — { "name": "...", "mode": "dark"|"light", "vars": { "--background": "240 10% 3.9%", ... } }'
          class="mt-3 w-full rounded border border-border bg-background p-2 font-mono text-[11px]"
        />
        <button
          type="button"
          class="self-end rounded bg-primary px-3 py-0.5 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
          :disabled="!themeImportText.trim()"
          @click="onImportTheme"
        >
          Import / 적용
        </button>
      </div>

      <!-- Editor / Terminal -->
      <div v-else-if="active === 'editor'" class="flex max-w-2xl flex-col gap-4">
        <h2 class="text-lg font-semibold">Editor / Terminal</h2>
        <p class="text-xs text-muted-foreground">
          현재 Editor 옵션은 ⌘=/-/0 (Zoom) 와 Diff 3-mode 토글 (Hunk/Inline/Context) 로
          제공. 추가 옵션 (font / EOL / line-num / wrap) 은 v1.x.
        </p>
        <ul class="space-y-1 rounded border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
          <li>· 폰트 크기: ⌘=/-/0 (Zoom) — 현재 {{ buildInfo.zoomPx }}px</li>
          <li>· Diff 모드: CommitDiffModal 의 Hunk / Inline / Context 토글</li>
          <li>· Terminal: ⌘\` 토글, pwsh.exe / bash 자동 감지</li>
        </ul>
        <p class="text-[10px] text-muted-foreground">
          v1.x 추가: External diff/merge tool launch, Terminal font/cursor 설정.
        </p>
      </div>

      <!-- 마이그레이션 -->
      <div
        v-else-if="active === 'migrate'"
        class="flex max-w-2xl flex-col gap-4"
      >
        <h2 class="text-lg font-semibold">마이그레이션</h2>
        <p class="text-xs text-muted-foreground">
          기존 git client 의 로컬 데이터 (레포 / 워크스페이스 / 즐겨찾기 / 활성 탭) 를
          git-fried 로 가져옵니다. PAT (토큰) 은 보안상 별도 재입력이 필요합니다.
        </p>

        <div class="rounded border border-border bg-muted/20 p-4 text-sm">
          <h3 class="font-semibold">📦 GitKraken</h3>
          <p class="mt-1 text-xs text-muted-foreground">
            <code>%APPDATA%/.gitkraken/</code> 에서 자동 탐지 →
            로컬 레포 path / Workspace / 즐겨찾기 / 활성 탭 import.
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

      <!-- About -->
      <div v-else-if="active === 'about'" class="flex max-w-2xl flex-col gap-4">
        <h2 class="text-lg font-semibold">About git-fried</h2>
        <p class="text-sm text-muted-foreground">
          GitKraken 대체 데스크탑 git client — Tauri 2 + Vue 3 + Rust.
          Gitea 1급, 한글 안전, AI CLI 위임.
        </p>
        <ul class="space-y-1 rounded border border-border bg-muted/20 p-3 text-xs">
          <li>버전: <span class="font-mono">{{ buildInfo.version }}</span></li>
          <li>Zoom: <span class="font-mono">{{ buildInfo.zoomPx }}px</span></li>
          <li>Sidebar: {{ buildInfo.sidebarVisible ? 'visible' : 'hidden' }}</li>
          <li>Detail panel: {{ buildInfo.detailVisible ? 'visible' : 'hidden' }}</li>
        </ul>
        <p class="text-[10px] text-muted-foreground">
          ?  키보드 단축키 도움말. ⌘P Command Palette. ⌘\` Terminal.
        </p>
      </div>
    </section>

    <GitKrakenImportModal
      :open="importGkOpen"
      @close="importGkOpen = false"
    />
  </div>
</template>
