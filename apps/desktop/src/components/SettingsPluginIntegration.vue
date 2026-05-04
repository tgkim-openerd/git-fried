<script setup lang="ts">
// Sprint c40 god comp 분리 — settings.vue (613 LOC) 의 Plugin / Integration
// 영역 sub-component 분리. props 0 / 외부 의존 0 (PlaceholderButton 만).
//
// design §8-3 hard constraint: 외부 도구 연결 placeholder. v0.5+ plugin API 도입.
// design §8-6 Cloud-Free 정체성: Cloud Workspace / Cloud AI / 자체 LLM / Diagram 의도 제외.
import PlaceholderButton from './PlaceholderButton.vue'
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-4">
    <h2 class="text-lg font-semibold">Plugin / Integration</h2>
    <p class="text-sm text-muted-foreground">
      외부 도구 연결 (CI / 이슈 트래커 / 알림 / 동기화). git-fried 의 로컬-우선 / CLI-위임 정체성에
      맞는 plugin 만 본 카테고리에 노출됩니다.
    </p>
    <p class="text-xs text-muted-foreground">
      ❌ 의도적 제외: Cloud Workspace / Cloud AI / 자체 LLM 인프라 / Diagram. (Cloud-Free 정체성 —
      design §8-6).
    </p>
    <div class="rounded border border-dashed border-border bg-muted/20 p-3">
      <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        예정 (placeholder)
      </h3>
      <div class="flex flex-wrap gap-1.5">
        <PlaceholderButton
          label="GitHub Actions"
          eta="v0.4"
          icon="⚡"
          detail="CI run 상태 인디케이터 (per-branch / per-PR)"
          size="md"
        />
        <PlaceholderButton
          label="Linear / Jira"
          eta="v0.5"
          icon="🔗"
          detail="commit / branch 이름 → 이슈 자동 매핑"
          size="md"
        />
        <PlaceholderButton
          label="Discord 알림"
          eta="v0.5"
          icon="🔔"
          detail="bulk fetch / push 결과 webhook"
          size="md"
        />
        <PlaceholderButton
          label="Slack 알림"
          eta="v0.5"
          icon="💬"
          detail="bulk fetch / PR 머지 webhook"
          size="md"
        />
        <PlaceholderButton
          label="GPG 서명"
          eta="v0.6"
          icon="🔐"
          detail="commit / tag 자동 GPG 서명 (per-repo 토글)"
          size="md"
        />
      </div>
    </div>
    <p class="text-[10px] text-muted-foreground">
      진행 상황: <code class="font-mono">docs/plan/05-roadmap-v0.1-v1.0.md</code>
    </p>
  </div>
</template>
