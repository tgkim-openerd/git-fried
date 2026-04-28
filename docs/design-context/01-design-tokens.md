# 01. Design Tokens — git-fried

> **이 문서의 독자**: Figma Variables 라이브러리 작성자.
> **출처**: `apps/desktop/tailwind.config.ts` + `apps/desktop/src/styles/main.css` 1:1 추출.
> **목표**: 코드와 동기화된 single source of truth 가 Figma 측에 존재하도록 한다.

---

## 1. 색 토큰 (shadcn-vue 표준 + light/dark)

> **명명 규칙**: shadcn-vue 표준 100% 준수. 추가 변수 없음. 모든 값은 HSL 형식으로 정의됨 (Tailwind alpha 합성을 위해 `<h s% l%>` 띄어쓰기).

| Token | Light (HSL) | Dark (HSL) | Tailwind 사용 |
|-------|-------------|------------|--------------|
| **background** | `0 0% 100%` (#FFFFFF) | `240 10% 3.9%` (~#0A0A0F) | `bg-background` |
| **foreground** | `240 10% 3.9%` | `0 0% 98%` (~#FAFAFA) | `text-foreground` |
| **card** | `0 0% 100%` | `240 10% 3.9%` | `bg-card` |
| **card-foreground** | `240 10% 3.9%` | `0 0% 98%` | `text-card-foreground` |
| **popover** | `0 0% 100%` | `240 10% 3.9%` | `bg-popover` |
| **popover-foreground** | `240 10% 3.9%` | `0 0% 98%` | `text-popover-foreground` |
| **primary** | `240 5.9% 10%` (~#191921) | `0 0% 98%` | `bg-primary` |
| **primary-foreground** | `0 0% 98%` | `240 5.9% 10%` | `text-primary-foreground` |
| **secondary** | `240 4.8% 95.9%` (~#F4F4F5) | `240 3.7% 15.9%` (~#27272A) | `bg-secondary` |
| **secondary-foreground** | `240 5.9% 10%` | `0 0% 98%` | — |
| **muted** | `240 4.8% 95.9%` | `240 3.7% 15.9%` | `bg-muted` |
| **muted-foreground** | `240 3.8% 46.1%` (~#71717A) | `240 5% 64.9%` (~#A1A1AA) | `text-muted-foreground` |
| **accent** | `240 4.8% 95.9%` | `240 3.7% 15.9%` | `bg-accent` |
| **accent-foreground** | `240 5.9% 10%` | `0 0% 98%` | — |
| **destructive** | `0 72% 51%` (~#DC2626) | `0 62.8% 30.6%` (~#7F1D1D) | `bg-destructive` |
| **destructive-foreground** | `0 0% 98%` | `0 0% 98%` | — |
| **border** | `240 5.9% 90%` (~#E4E4E7) | `240 3.7% 15.9%` | `border-border` (글로벌 `*`) |
| **input** | `240 5.9% 90%` | `240 3.7% 15.9%` | `bg-input` |
| **ring** | `240 5.9% 10%` | `240 4.9% 83.9%` (~#D4D4D8) | `ring-ring` (focus) |

**관찰**: secondary == muted == accent (light/dark 모두 동일 HSL). plan/22 §15 "Color 일관성" 항목이 가리키는 issue 와 정합 — 의미 분리 필요.

## 2. 타이포그래피

### 2-1. fontFamily

| Token | 값 (fallback chain) |
|-------|---------------------|
| **sans** | `'Pretendard Variable'` → `'Pretendard'` → `system-ui` → `-apple-system` → `BlinkMacSystemFont` → `'Segoe UI'` → `Roboto` → `sans-serif` |
| **mono** | `'JetBrains Mono'` → `'D2Coding'` → `'Cascadia Code'` → `Consolas` → `monospace` |

**Pretendard 로딩 방식**: `index.html` 및 `main.css` 에 `@font-face` / `<link rel="preload">` / CDN import **없음** — OS 기본값 / Pretendard 미설치 시 system-ui fallback. **Figma 측에서는 Pretendard 명시 사용 + (디자인 hand-off 시 self-host 도입 권장 항목)**.

### 2-2. fontFeatureSettings / variation

`tailwind.config.ts` 의 sans 폰트에:
- `font-feature-settings`: `'cv11'`, `'ss01'` (Pretendard 글자 균형 최적화)
- `font-variation-settings`: `'opsz' 32` (Pretendard Variable optical size)

### 2-3. font scale

Tailwind 기본 scale 그대로 (extend 없음). 실제 코드에서 빈도순:

| Class | Size | line-height | 주 용도 |
|-------|------|-------------|--------|
| `text-xs` | 12px | 1rem | 메타 정보, 사이드바 보조 텍스트 |
| `text-sm` | 14px | 1.25rem | 본문 기본 (대부분 panel) |
| `text-base` | 16px | 1.5rem | 모달 본문 |
| `text-lg` | 18px | 1.75rem | 모달 헤더 |
| `text-xl` | 20px | 1.75rem | 페이지 제목 |
| `text-2xl` | 24px | 2rem | 거의 미사용 |

**input/textarea line-height**: `1.5` (한글 NFC 안전성 — `composables/useShortcuts.ts` 등 일부 강제)

## 3. Spacing

Tailwind 기본 4px grid 그대로 사용 (extend 없음). **상위 5 빈도** (grep count):

| Class | Px | 빈도 | 주 용도 |
|-------|----|------|--------|
| `gap-2` | 8 | **89** | 리스트/그리드 항목 간격 (가장 빈번) |
| `gap-1` | 4 | **49** | 컴팩트 간격 |
| `p-3` | 12 | **40** | 컨테이너 패딩 |
| `p-2` | 8 | **35** | 컴팩트 패딩 |
| `gap-3` | 12 | **25** | 섹션 간격 |

**디자인 함의**: 8px(`-2`)·4px(`-1`)·12px(`-3`) 가 사실상 시스템 base. Figma 에서는 4 / 8 / 12 / 16 / 24 / 32 만 노출하면 99% 커버.

## 4. Border Radius

| CSS variable | 값 | Tailwind class | 용도 |
|--------------|----|----|------|
| `--radius` | `0.5rem` (8px) | `rounded-lg` | 모달, 카드, 큰 컨테이너 |
| (derived) | `calc(var(--radius) - 2px)` = 6px | `rounded-md` | 입력 필드, 버튼 |
| (derived) | `calc(var(--radius) - 4px)` = 4px | `rounded-sm` | 작은 badge, chip |
| Tailwind 기본 | 9999px | `rounded-full` | avatar, dot indicator |

**디자인 함의**: 4 / 6 / 8 / full 4단계. Figma 에 4단계만 노출.

## 5. Shadow / Elevation

`tailwind.config.ts` 에 `boxShadow` extend **없음**. Tailwind 기본 (`shadow-sm`, `shadow`, `shadow-md`, `shadow-lg`, `shadow-xl`) 만 사용 — 그러나 코드에서 거의 등장하지 않음 (모달도 별도 shadow 미적용, border 로 분리).

**디자인 함의**: 현재 elevation 시스템 부재. plan/22 §15 BaseModal 신규 작성 시 shadow tier 정의 권장:
- `shadow-sm` — popover / dropdown
- `shadow-lg` — modal
- `shadow-xl` — toast (옵션)

## 6. Z-Index

명시 정의 = 1개:

| Layer | Z값 | 용도 |
|-------|-----|------|
| **toast** | `z-[60]` | `ToastContainer.vue` (최상단) |
| 모달 backdrop | `z-40` ~ `z-50` (모달별 임의) | 18 모달 각자 정의, 일관성 없음 |

**디자인 함의 / 디자이너 결정 필요**: layer 시스템 부재. 권장 spec:
- `z-10` — sticky header
- `z-20` — sidebar overlay (모바일 X, 단 future)
- `z-30` — popover / dropdown
- `z-40` — modal backdrop
- `z-50` — modal content
- `z-60` — toast

## 7. Animation / Transition

`tailwindcss-animate` 플러그인 사용 (있으나 실 적용 적음). plan/22 §15 "Micro-interaction spec" 에서 다음 항목 결정 필요:
- modal enter/exit (fade 150ms / scale 200ms 권장)
- toast slide-in (right slide 200ms)
- hover transition (75~100ms)
- focus ring (instant, transition 없음)

**현재 코드**: 대부분 transition 없음 (instant). 디자이너가 spec 잡아야 함.

## 8. CSS Variable 명명 규칙

shadcn-vue 표준 그대로:
```
--background, --foreground
--primary, --primary-foreground
--secondary, --secondary-foreground
--destructive, --destructive-foreground
--muted, --muted-foreground
--accent, --accent-foreground
--card, --card-foreground
--popover, --popover-foreground
--border, --input, --ring
--radius
```

추가 git-fried 고유 변수 없음 (semantic 색은 shadcn 으로 충분, git status 색 등은 Tailwind 기본 red/green/yellow 직접 사용).

## 9. Figma Variables 호환 JSON (W3C Design Tokens 사양)

```json
{
  "$schema": "https://design-tokens.org/draft/2024",
  "color": {
    "background": {
      "$value": { "light": "#FFFFFF", "dark": "#0A0A0F" },
      "$type": "color"
    },
    "foreground": {
      "$value": { "light": "#0A0A0F", "dark": "#FAFAFA" },
      "$type": "color"
    },
    "primary": {
      "$value": { "light": "#191921", "dark": "#FAFAFA" },
      "$type": "color"
    },
    "primary-foreground": {
      "$value": { "light": "#FAFAFA", "dark": "#191921" },
      "$type": "color"
    },
    "secondary": {
      "$value": { "light": "#F4F4F5", "dark": "#27272A" },
      "$type": "color"
    },
    "muted": {
      "$value": { "light": "#F4F4F5", "dark": "#27272A" },
      "$type": "color"
    },
    "muted-foreground": {
      "$value": { "light": "#71717A", "dark": "#A1A1AA" },
      "$type": "color"
    },
    "accent": {
      "$value": { "light": "#F4F4F5", "dark": "#27272A" },
      "$type": "color"
    },
    "destructive": {
      "$value": { "light": "#DC2626", "dark": "#7F1D1D" },
      "$type": "color"
    },
    "border": {
      "$value": { "light": "#E4E4E7", "dark": "#27272A" },
      "$type": "color"
    },
    "ring": {
      "$value": { "light": "#191921", "dark": "#D4D4D8" },
      "$type": "color"
    }
  },
  "typography": {
    "fontFamily": {
      "sans": { "$value": "Pretendard Variable, Pretendard, system-ui, sans-serif", "$type": "fontFamily" },
      "mono": { "$value": "JetBrains Mono, D2Coding, Consolas, monospace", "$type": "fontFamily" }
    },
    "fontSize": {
      "xs": { "$value": "12px", "$type": "fontSize" },
      "sm": { "$value": "14px", "$type": "fontSize" },
      "base": { "$value": "16px", "$type": "fontSize" },
      "lg": { "$value": "18px", "$type": "fontSize" },
      "xl": { "$value": "20px", "$type": "fontSize" }
    }
  },
  "spacing": {
    "1": { "$value": "4px", "$type": "spacing" },
    "2": { "$value": "8px", "$type": "spacing" },
    "3": { "$value": "12px", "$type": "spacing" },
    "4": { "$value": "16px", "$type": "spacing" },
    "6": { "$value": "24px", "$type": "spacing" },
    "8": { "$value": "32px", "$type": "spacing" }
  },
  "radius": {
    "sm": { "$value": "4px", "$type": "borderRadius" },
    "md": { "$value": "6px", "$type": "borderRadius" },
    "lg": { "$value": "8px", "$type": "borderRadius" },
    "full": { "$value": "9999px", "$type": "borderRadius" }
  }
}
```

## 10. 디자이너 결정 필요 (코드에 SoT 없음)

| 항목 | 현재 상태 | 권장 |
|------|---------|------|
| **Pretendard 로딩** | OS fallback 만 — 미설치 시 system-ui | self-host (`@font-face` + woff2) 또는 CDN preload |
| **Elevation/Shadow tier** | extend 없음 | `popover/modal/toast` 3 tier |
| **Z-index layer** | toast=60 외 정의 없음 | 10/20/30/40/50/60 layer 6단계 |
| **Transition** | 거의 없음 | enter 150ms / exit 100ms / hover 75ms |
| **Color semantic 분리** | secondary == muted == accent | 의미별 색 분리 (예: muted 만 더 흐리게) |
| **Status 색** | git status 는 Tailwind red/green/yellow 직접 | `success/warning/info` semantic 토큰 추가 |
| **Custom theme 검증** | settings 에서 JSON import/export | 사용자 입력 검증 + 미리보기 spec |
