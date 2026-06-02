<script setup lang="ts">
// Sprint c40 god comp 분리 — settings.vue (613 LOC) 의 Plugin / Integration
// 영역 sub-component 분리. props 0 / 외부 의존 0 (PlaceholderButton 만).
//
// design §8-3 hard constraint: 외부 도구 연결 placeholder. v0.5+ plugin API 도입.
// design §8-6 Cloud-Free 정체성: Cloud Workspace / Cloud AI / 자체 LLM / Diagram 의도 제외.
// c61 — i18n 마이그.
import { useI18n } from 'vue-i18n'
import PlaceholderButton from './PlaceholderButton.vue'

const { t } = useI18n()
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-4">
    <h2 class="text-lg font-semibold">{{ t('settings.pluginIntegration.title') }}</h2>
    <p class="text-sm text-muted-foreground">
      {{ t('settings.pluginIntegration.description') }}
    </p>
    <p class="text-xs text-muted-foreground">
      {{ t('settings.pluginIntegration.exclusionNote') }}
    </p>
    <div class="rounded border border-dashed border-border bg-muted/20 p-3">
      <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {{ t('settings.pluginIntegration.plannedHeading') }}
      </h3>
      <div class="flex flex-wrap gap-1.5">
        <PlaceholderButton
          label="GitHub Actions"
          eta="v0.4"
          icon="⚡"
          :detail="t('settings.pluginIntegration.ghaDetail')"
          size="md"
        />
        <PlaceholderButton
          label="Linear / Jira"
          eta="v0.5"
          icon="🔗"
          :detail="t('settings.pluginIntegration.linearJiraDetail')"
          size="md"
        />
        <PlaceholderButton
          label="Discord"
          eta="v0.5"
          icon="🔔"
          :detail="t('settings.pluginIntegration.discordDetail')"
          size="md"
        />
        <PlaceholderButton
          label="Slack"
          eta="v0.5"
          icon="💬"
          :detail="t('settings.pluginIntegration.slackDetail')"
          size="md"
        />
        <PlaceholderButton
          label="GPG"
          eta="v0.6"
          icon="🔐"
          :detail="t('settings.pluginIntegration.gpgDetail')"
          size="md"
        />
      </div>
    </div>
    <p class="text-3xs text-muted-foreground">
      {{
        t('settings.pluginIntegration.roadmapNote', { file: 'docs/plan/05-roadmap-v0.1-v1.0.md' })
      }}
    </p>
  </div>
</template>
