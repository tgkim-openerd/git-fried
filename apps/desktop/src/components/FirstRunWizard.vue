<script setup lang="ts">
// v0.4 #2 (UltraPlan plan/31 §9 Q1 절충) — First-run 3-step wizard.
//
// useOnboardingDetect 의 toast 1회 후 7s 자동 open (Q1 옵션 c).
// BaseModal wrap — aria-modal / role=dialog / focus trap / ESC close 자동 적용.
//
// step 1 (welcome): 환영 + 차별점 (Tauri ~30MB / 한글 / AI / Gitea / a11y).
// step 2 (theme): light / dark / system 선택.
// step 3 (quickstart): RepoSwitcher 열기 / GitKrakenImport / Skip.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import BaseModal from './BaseModal.vue'
import { useFirstRunWizard } from '@/composables/useFirstRunWizard'
import { useTheme } from '@/composables/useTheme'
import { dispatchShortcut } from '@/composables/useShortcuts'

const { t } = useI18n()
const router = useRouter()
const wizard = useFirstRunWizard()
const themeStore = useTheme()

// step 1 — 차별점 catalog (research.md / plan/30 §6).
const HIGHLIGHTS: { keyTitle: string; keyBody: string }[] = [
  { keyTitle: 'wizard.welcome.h1Title', keyBody: 'wizard.welcome.h1Body' },
  { keyTitle: 'wizard.welcome.h2Title', keyBody: 'wizard.welcome.h2Body' },
  { keyTitle: 'wizard.welcome.h3Title', keyBody: 'wizard.welcome.h3Body' },
  { keyTitle: 'wizard.welcome.h4Title', keyBody: 'wizard.welcome.h4Body' },
  { keyTitle: 'wizard.welcome.h5Title', keyBody: 'wizard.welcome.h5Body' },
]

const stepTitle = computed(() => t(`wizard.step${wizard.step.value}.title`))

function onQuickStartRepoSwitch() {
  wizard.complete()
  dispatchShortcut('newTab') // ⌘T — Repo Switcher
}

function onQuickStartImportGk() {
  wizard.complete()
  void router.push('/settings')
  // 사용자가 Settings → 시작·마이그레이션 에서 GitKraken 가져오기 클릭. (deep-link 는 v0.5+.)
}

function onSkip() {
  wizard.skipForever()
}

function setTheme(v: 'dark' | 'light') {
  if (themeStore.theme.value !== v) themeStore.toggle()
}
</script>

<template>
  <BaseModal
    :open="wizard.isOpen.value"
    :title="stepTitle"
    :close-on-esc="true"
    max-width="md"
    @close="wizard.close"
  >
    <!-- step 1 — welcome -->
    <section v-if="wizard.step.value === 1" class="flex flex-col gap-3">
      <p class="text-xs text-muted-foreground">{{ t('wizard.welcome.intro') }}</p>
      <ul class="space-y-2">
        <li
          v-for="h in HIGHLIGHTS"
          :key="h.keyTitle"
          class="rounded border border-border bg-muted/20 px-3 py-2"
        >
          <div class="text-xs font-semibold">{{ t(h.keyTitle) }}</div>
          <div class="mt-0.5 text-2xs text-muted-foreground">{{ t(h.keyBody) }}</div>
        </li>
      </ul>
    </section>

    <!-- step 2 — theme -->
    <section v-if="wizard.step.value === 2" class="flex flex-col gap-3">
      <p class="text-xs text-muted-foreground">{{ t('wizard.theme.intro') }}</p>
      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 rounded border px-3 py-3 text-xs hover:bg-accent/40"
          :class="
            themeStore.theme.value === 'light'
              ? 'border-primary bg-accent/30'
              : 'border-border bg-background'
          "
          @click="setTheme('light')"
        >
          ☀ {{ t('wizard.theme.light') }}
        </button>
        <button
          type="button"
          class="flex-1 rounded border px-3 py-3 text-xs hover:bg-accent/40"
          :class="
            themeStore.theme.value === 'dark'
              ? 'border-primary bg-accent/30'
              : 'border-border bg-background'
          "
          @click="setTheme('dark')"
        >
          ☾ {{ t('wizard.theme.dark') }}
        </button>
      </div>
      <p class="text-3xs text-muted-foreground">
        {{ t('wizard.theme.systemHint') }}
      </p>
    </section>

    <!-- step 3 — quickstart -->
    <section v-if="wizard.step.value === 3" class="flex flex-col gap-3">
      <p class="text-xs text-muted-foreground">{{ t('wizard.quickstart.intro') }}</p>
      <div class="flex flex-col gap-2">
        <button
          type="button"
          class="rounded border border-primary bg-primary px-3 py-2 text-xs text-primary-foreground hover:opacity-90"
          @click="onQuickStartRepoSwitch"
        >
          {{ t('wizard.quickstart.addRepo') }}
        </button>
        <button
          type="button"
          class="rounded border border-border px-3 py-2 text-xs hover:bg-accent/40"
          @click="onQuickStartImportGk"
        >
          {{ t('wizard.quickstart.importGk') }}
        </button>
        <button
          type="button"
          class="rounded border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent/40"
          @click="onSkip"
        >
          {{ t('wizard.quickstart.skip') }}
        </button>
      </div>
    </section>

    <template #footer>
      <div class="flex items-center justify-between gap-2">
        <button
          type="button"
          class="text-xs text-muted-foreground hover:text-foreground"
          @click="onSkip"
        >
          {{ t('wizard.skipForever') }}
        </button>
        <div class="flex gap-2">
          <button
            v-if="wizard.step.value > 1"
            type="button"
            class="rounded border border-border px-3 py-1 text-xs hover:bg-accent/40"
            @click="wizard.prev"
          >
            {{ t('wizard.prev') }}
          </button>
          <button
            v-if="wizard.step.value < 3"
            type="button"
            class="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:opacity-90"
            @click="wizard.next"
          >
            {{ t('wizard.next') }}
          </button>
          <button
            v-if="wizard.step.value === 3"
            type="button"
            class="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:opacity-90"
            @click="wizard.complete"
          >
            {{ t('wizard.done') }}
          </button>
        </div>
      </div>
    </template>
  </BaseModal>
</template>
