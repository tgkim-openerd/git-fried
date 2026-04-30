# Plan 28 — Light Theme 가독성 audit + 일괄 fix

작성: 2026-04-30 (Sprint c34 후속)
원전: Sprint c33 작업 E "Light theme audit" (코드 변경 0, 발견만)

> **목적**: 60+ 곳의 hardcoded Tailwind 색상 (`text-emerald-500` / `text-violet-500` 등) 이
> light theme 흰 배경에서 채도 부족으로 가독성 떨어지는 문제 일괄 해소.
>
> Sprint c34 에서 시범 5곳 수정. 잔여 ~55곳 + 시스템적 fix (semantic 변수 또는 design token) 는 본 plan.

---

## 1. 현재 상태 (Sprint c34 종료 시점)

### CSS 변수 시스템 (양호)

`apps/desktop/src/styles/main.css`:
- `:root` (light) — 17 semantic 변수 (`--background` / `--foreground` / `--card` / `--success` / `--warning` 등)
- `.dark` — 동일 변수 오버라이드

→ `text-foreground` / `bg-card` 같은 semantic Tailwind 클래스 사용 가능 (양호).

### Hardcoded 색상 분포 (60+ 곳, 갭)

| 컴포넌트 | 카운트 | 주요 색상 |
| ---- | ----: | ---- |
| PrDetailModal | 10 | text-emerald-500 / text-violet-500 / text-rose-500 |
| InteractiveRebaseModal | 9 | text-red-500 / text-amber-500 / text-green-500 |
| CommitMessageInput | 8 | text-violet-500 / text-rose-500 / text-amber-500 |
| PrFilesTab | 7 | text-emerald-500 / text-rose-500 / text-violet-500 |
| ConventionalCommitBuilder | 7 | text-emerald-500 / text-amber-500 / text-rose-500 |
| 외 다수 | ~25 | bg-emerald-500/30, text-amber-500 등 |

### Sprint c34 시범 fix (5곳)

- `PrDetailModal.vue` violet 4곳 (AI review 헤더 + 버튼 hover) → `text-violet-700 dark:text-violet-500`
- `CommitMessageInput.vue` violet 1곳 (AI 메시지 생성) → 동일 패턴
- `InteractiveRebaseModal.vue` green/red 3곳 (rebase 결과 박스 + abort 버튼) → 동일 패턴

---

## 2. 시스템적 fix 전략 (3 후보)

### 옵션 A — Tailwind `dark:` 변형 일괄 추가 (단순, ~60곳)

```html
<!-- 이전 -->
<span class="text-emerald-500">+12</span>

<!-- 이후 -->
<span class="text-emerald-700 dark:text-emerald-500">+12</span>
```

**장점**: 변경 minimal, 회귀 위험 0
**단점**: 모든 곳 명시 필요, 누락 위험, 일관성 점검 어려움

### 옵션 B — Semantic CSS 변수 + Tailwind arbitrary value

```css
/* main.css */
:root {
  --diff-add: 142 71% 35%;   /* light: 진한 emerald */
  --diff-delete: 0 72% 51%;
  --ai-violet: 271 80% 45%;
  --warning-amber: 38 92% 35%;
}
.dark {
  --diff-add: 142 71% 50%;   /* dark: 밝은 emerald */
  --diff-delete: 0 80% 65%;
  --ai-violet: 271 80% 65%;
  --warning-amber: 38 92% 55%;
}
```

```html
<span class="text-[hsl(var(--diff-add))]">+12</span>
```

**장점**: 의미 명확, 한 곳 변경으로 전역 영향, custom theme JSON import 와 호환
**단점**: 컴포넌트마다 모든 색상 임의값 클래스 사용 — Tailwind 잇점 일부 상실

### 옵션 C — Tailwind config 의 colors 확장

```js
// tailwind.config.js
theme.extend.colors = {
  'diff-add': 'hsl(var(--diff-add))',
  'diff-delete': 'hsl(var(--diff-delete))',
  'ai-violet': 'hsl(var(--ai-violet))',
  // ...
}
```

```html
<span class="text-diff-add">+12</span>
```

**장점**: Tailwind native — 자동완성 / IntelliSense / @apply 지원, 의미 명확, 한 곳 변경
**단점**: 초기 mapping 작업 + `text-emerald-500` → `text-diff-add` 60곳 일괄 치환

→ **옵션 C 권장** (Sprint c35 시점).

---

## 3. Sprint c35 plan (옵션 C 기준)

### Phase 1 — Tailwind config 의 semantic colors 추가 (1 commit)

```js
theme.extend.colors = {
  'diff-add': 'hsl(var(--diff-add))',
  'diff-delete': 'hsl(var(--diff-delete))',
  'diff-rename': 'hsl(var(--diff-rename))',
  'ai-violet': 'hsl(var(--ai-violet))',
  'warning-amber': 'hsl(var(--warning-amber))',
  'success-emerald': 'hsl(var(--success-emerald))',
  'danger-rose': 'hsl(var(--danger-rose))',
}
```

main.css 의 `:root` / `.dark` 양쪽에 매핑 변수 정의.

### Phase 2 — 핵심 컴포넌트 일괄 치환 (3 commits)

- PrDetailModal / PrFilesTab / ConventionalCommitBuilder (diff +/- 표시) → `text-diff-add` / `text-diff-delete` / `text-diff-rename`
- AI 버튼 (CommitMessageInput / PrDetailModal / InteractiveRebaseModal / MergeEditorModal) → `text-ai-violet`
- 위험 액션 (Rebase abort / hard reset) → `text-danger-rose`
- 경고 (Conventional subject too long / Amend) → `text-warning-amber`

### Phase 3 — Visual 회귀 점검 (사용자 dogfood)

- ⌘0 light theme 토글 → 5 분 시각 점검
- screenshot diff (수동) — light/dark 양쪽

### Phase 4 — Sprint c34 시범 fix 통합

Sprint c34 의 `text-violet-700 dark:text-violet-500` 패턴 5곳 →`text-ai-violet` 으로 단순화.

---

## 4. 비판 self-check

| 위험 | 대응 |
| ---- | ---- |
| **Premature systematization** — 사용자 1인 (tgkim, dark 우세) 사용 중 | dogfood 후 light theme 사용 빈도 측정. 1주 50% 미만이면 sprint 보류 |
| **Tailwind config 변경 = build 영향** | dev / prod 양쪽 typecheck + visual 회귀 검사 |
| **Custom theme JSON 호환성** | useCustomTheme.ts 의 export/import 가 신규 변수도 흡수하는지 확인 |
| **--success / --warning / --info 기존 변수 중복** | 기존 사용처 0 인지 grep 후 통합 (`--success` → `--success-emerald` rename) |

---

## 5. 우선순위

| Phase | 작업 | sprint | ROI |
| ---- | ---- | ---- | ---- |
| **즉시 (c34)** | 시범 5곳 fix (완료) | (Sprint c34) | ★ |
| **Sprint c35** | Tailwind config + semantic colors 추가 | 1 sprint | ★★★ |
| **Sprint c35-2** | 핵심 컴포넌트 60곳 일괄 치환 | 1 sprint (3 commits) | ★★★ |
| **Sprint c35-3** | Visual 회귀 + custom theme 호환 점검 | 0.5 sprint | ★★ |

---

## 6. 결론

Sprint c34 의 시범 5곳은 **즉시 가독성 개선 + 패턴 검증**. 잔여 ~55곳은 Sprint c35 에서 일괄 치환 (옵션 C 시스템).

옵션 C (Tailwind semantic colors) 가 장기 유지보수 + custom theme 호환성 모두 충족.

> dogfood 후 light theme 사용 빈도 측정 → sprint 진입 결정. 사용 빈도 낮으면 보류.
