<script setup lang="ts">
// Plan #42 M-3 (Sprint c97+) — Issue Tracker Settings UI (forge 1급)
//
// 트리거: Plan #41 Step 1 발견 — GitKraken Settings 의 Repo-Specific Preferences
// 10 항목 중 Issue Tracker. git-fried 는 Gitea + GitHub forge 통합 (IssuesPanel.vue
// + useIssuesReleases 1급) + 외부 tracker (Linear/Jira/Trello) v0.4 skeleton.
//
// 본 페이지: forge 1급 상태 안내 + 외부 tracker 정책 명시 (v0.5+ 사용자 결정 영역).
//
// Codex 5차 audit `a0a801fa629a5bed5` LOW 해소 — actionable items 추가
// (Forge 설정 진입 emit + docs 링크).

import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const emit = defineEmits<{ navigate: [target: 'forge'] }>()

function gotoForgeSetup() {
  emit('navigate', 'forge')
}
</script>

<template>
  <div class="flex max-w-3xl flex-col gap-4">
    <h2 class="text-lg font-semibold">{{ t('settings.issueTracker.title') }}</h2>
    <p class="text-xs text-muted-foreground">
      {{ t('settings.issueTracker.description') }}
    </p>

    <section class="rounded border border-border bg-muted/20 p-4 text-sm">
      <h3 class="mb-2 font-semibold">{{ t('settings.issueTracker.forgeFirstClassTitle') }}</h3>
      <p class="text-xs text-muted-foreground">
        {{ t('settings.issueTracker.forgeFirstClassDescription') }}
      </p>
      <ul class="mt-2 ml-4 list-disc space-y-1 text-xs">
        <li>{{ t('settings.issueTracker.giteaSupported') }}</li>
        <li>{{ t('settings.issueTracker.githubSupported') }}</li>
      </ul>
      <button
        type="button"
        class="mt-3 rounded border border-input bg-background px-2 py-1 text-xs hover:bg-accent/40"
        data-testid="issuetracker-goto-forge"
        @click="gotoForgeSetup"
      >
        {{ t('settings.issueTracker.gotoForgeButton') }}
      </button>
    </section>

    <section class="rounded border border-border bg-muted/20 p-4 text-sm">
      <h3 class="mb-2 font-semibold">{{ t('settings.issueTracker.externalTitle') }}</h3>
      <p class="text-xs text-muted-foreground">
        {{ t('settings.issueTracker.externalDescription') }}
      </p>
      <ul class="mt-2 ml-4 list-disc space-y-1 text-xs">
        <li>{{ t('settings.issueTracker.linearStatus') }}</li>
        <li>{{ t('settings.issueTracker.jiraStatus') }}</li>
        <li>{{ t('settings.issueTracker.trelloStatus') }}</li>
      </ul>
      <p
        class="mt-2 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400"
      >
        {{ t('settings.issueTracker.externalDecisionNote') }}
      </p>
    </section>
  </div>
</template>
