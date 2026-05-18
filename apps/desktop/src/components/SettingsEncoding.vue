<script setup lang="ts">
// Plan #42 H-3 (Sprint c96+) — Encoding identity-core UI 강화
//
// 트리거: Plan #41 Step 1 발견 — GitKraken Settings 의 Repo-Specific Preferences
// 10 항목 중 Encoding. git-fried 의 identity-core (한글 안전 — encoding_rs +
// unicode_normalization). RepoSpecificForm.vue 의 B2 영역에 이미 i18n.commitEncoding /
// i18n.logOutputEncoding input 존재 — 본 페이지가 사용자 진입점 + 한글 안전 가이드.
//
// 후속: per-repo override 는 RepoSpecificForm tab 에서 처리 (Plan #42 M-1.1 통합 예정).

import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="flex max-w-3xl flex-col gap-4">
    <h2 class="text-lg font-semibold">{{ t('settings.encodingPage.title') }}</h2>
    <p class="text-xs text-muted-foreground">
      {{ t('settings.encodingPage.description') }}
    </p>

    <section class="rounded border border-border bg-muted/20 p-4 text-sm">
      <h3 class="mb-2 font-semibold">{{ t('settings.encodingPage.koreanSafeTitle') }}</h3>
      <ul class="ml-4 list-disc space-y-1 text-xs">
        <li>{{ t('settings.encodingPage.koreanSafe1') }}</li>
        <li>{{ t('settings.encodingPage.koreanSafe2') }}</li>
        <li>{{ t('settings.encodingPage.koreanSafe3') }}</li>
      </ul>
    </section>

    <section class="rounded border border-border bg-muted/20 p-4 text-sm">
      <h3 class="mb-2 font-semibold">{{ t('settings.encodingPage.perRepoTitle') }}</h3>
      <p class="text-xs text-muted-foreground">
        {{ t('settings.encodingPage.perRepoDescription') }}
      </p>
      <ul class="mt-2 ml-4 list-disc space-y-1 text-xs">
        <li>
          <code class="rounded bg-muted px-1">i18n.commitEncoding</code> —
          {{ t('settings.encodingPage.commitEncodingHint') }}
        </li>
        <li>
          <code class="rounded bg-muted px-1">i18n.logOutputEncoding</code> —
          {{ t('settings.encodingPage.logOutputEncodingHint') }}
        </li>
      </ul>
      <p
        class="mt-2 rounded border border-blue-500/40 bg-blue-500/10 p-2 text-xs text-blue-700 dark:text-blue-400"
      >
        {{ t('settings.encodingPage.repoSpecificLink') }}
      </p>
    </section>
  </div>
</template>
