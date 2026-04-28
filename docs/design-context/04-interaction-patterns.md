# 04. Interaction Patterns — git-fried

> **이 문서의 독자**: micro-interaction / motion / a11y / Korean text 처리를 spec 잡는 디자이너.
> **출처**: Phase 1 Agent C + Codex intent + plan/22 §15.

---

## 1. 키보드 단축키 정책

### 1-1. Modifier 표기 (디자이너 결정 필요)

현재 코드는 macOS 기준 ⌘ (Cmd) / ⇧ (Shift) / ⌥ (Option) / ⌃ (Ctrl). Windows 는 자동으로 Ctrl 매핑. **HelpModal 표기 spec 필요**:

- 권장: macOS 표기 (⌘⇧K) + tooltip 에 OS 별 자동 변환 (Win 은 "Ctrl+Shift+K")
- shortcut hint 컨테이너: monospace font, `border border-border rounded-sm px-1` (kbd 스타일)
- multi-key 구분: 공백 1자 (`⌘ ⇧ K` vs `⌘⇧K`) — 디자이너 결정

### 1-2. 단축키 카테고리 (HelpModal 그루핑)

| 그룹 | 단축키 |
|------|--------|
| **레포** | ⌘⇧P/⌘T (전환) · ⌘L (fetch) · ⌘⇧L (pull) · ⌘⇧K (push) · ⌘⌥F (필터) |
| **브랜치** | ⌘B (탭) · ⌘N (new PR) |
| **파일** | ⌘⇧S (stage all) · ⌘⇧U (unstage all) · ⌘Enter (commit) · ⌘⇧Enter (stage+commit) · ⌘⇧M (msg focus) |
| **뷰** | ⌘J (sidebar) · ⌘K (detail) · ⌘\` (terminal) · ⌘= ⌘- ⌘0 (zoom) · ⌘D (diff) · F11 (fullscreen) |
| **히스토리** | ⌘⇧H (file history) · (palette) reflog |
| **AI** | (palette) explain |
| **시스템** | ⌘P (palette) · ? (help) · ⌘W (close modal) · ESC (universal close) |

### 1-3. 단축키 충돌 규칙

- ⌘W = close modal (브라우저 close tab 과 다름 — Tauri webview 라 OS 가로채지 않음)
- ESC = (modal open) close modal / (palette open) close palette / (input focused) blur
- ⌘D = (input focused) 무시 / (그 외) show diff

---

## 2. 한글 텍스트 처리 (제품 정체성)

### 2-1. Visual width 규칙 (sprint 22-1 C2 구현)

```ts
function visualWidth(s: string): number {
  // ASCII = 1 cell, CJK / Hangul / emoji = 2 cells
}
```

| 문자 | cell |
|------|------|
| ASCII (`a-zA-Z0-9` + 일반 punct) | **1** |
| 한글 (Hangul Syllables U+AC00~D7A3) | **2** |
| 한자 (CJK Unified) | **2** |
| 일본어 (Hiragana/Katakana) | **2** |
| Emoji (U+1F300+) | **2** |

### 2-2. 임계값 (CommitMessageInput)

- subject 권장 max: **72 cell** (영문 72자 = 한글 36자)
- 50 cell 까지: 정상 (Tailwind `text-foreground`)
- 50~72 cell: amber warning (`text-amber-500` + 글자수 카운트 표시)
- 72 cell 초과: red destructive (`text-destructive` + amber + commit 가능)

### 2-3. Ellipsis / 잘림 정책 (디자이너 결정 필요)

| 컨텍스트 | 현재 | 권장 |
|---------|------|------|
| Sidebar repo 이름 | CSS truncate (1 line) + `title` attr | tooltip 으로 완전 이름 표시 (Tooltip 신규 후) |
| CommitGraph subject | 1 line truncate | 동일 |
| BranchPanel branch 이름 | 동일 | 디자이너: 한글 50% / 영문 50% 가정 width 결정 |
| 파일 경로 | full path 표시 | 좌측 ellipsis (...path/to/file.txt) |

### 2-4. 파일명 인코딩 신뢰 UX (POLISH F-P4)

회사 레포에 한글 파일명 존재 → 인코딩 깨지면 사용자가 어떤 파일인지 모름. **디자이너 결정 필요**: encoding 신뢰도 표시 (예: ⚠ icon + tooltip "Detected encoding: UTF-8" / "Possibly mangled — check git config").

---

## 3. Drag & Drop spec (현재 미구현)

### 3-1. ghost preview

- `cursor: grabbing`
- 원본 row 의 50% opacity 복사본
- pointer 우하단 약간 offset

### 3-2. drop target

- valid: `outline 2px dashed primary` + `bg-primary/10`
- invalid: `outline 2px dashed destructive` + `bg-destructive/10` + `cursor: not-allowed`
- 위치 표시 (insert before/after): row 위/아래 1px 강조선

### 3-3. drag 종류와 confirm 동작 (plan/12 § B8)

| Drag | Drop | 액션 | Confirm |
|------|------|------|---------|
| Branch | Branch | merge / rebase | 모달 confirm (3-way: merge/rebase/abort) |
| Commit | Branch | cherry-pick | inline confirm |
| File (Status) | Stash | stash --include | inline |
| Stash entry | Branch | apply | inline |
| Repo (Sidebar) | Workspace | move | 즉시 (undo toast) |
| Tab | Tab position | reorder | 즉시 |

### 3-4. cancel

- ESC 누르면 cancel
- 원래 위치로 200ms transition
- toast.info "Drag cancelled"

---

## 4. Loading / Empty / Error / Skeleton

### 4-1. Loading 단계

| 단계 | UI |
|------|----|
| **Initial (전체 앱)** | full-screen spinner + "Loading…" 텍스트 (3s 이상 시 progress hint) |
| **레포 첫 fetch** | inline spinner (CommitGraph 영역 중앙) |
| **List refresh** | top inline progress bar (1px) |
| **Mutation 진행** | 버튼 disabled + spinner replace icon |

### 4-2. Skeleton (현재 부재 — 디자이너 작업)

| 화면 | Skeleton 구조 |
|------|--------------|
| CommitGraph | 5~8 row × (commit dot + line + subject 회색 bar) |
| BranchPanel | 4~6 row × (icon + name + ahead/behind dot) |
| StatusPanel | 3 section × 4~6 row (checkbox + path + status icon) |
| PrDetailModal | header skeleton + body skeleton (3 paragraph) |

**Skeleton 색**: `bg-muted` + `animate-pulse` (Tailwind built-in).

### 4-3. Empty state

| 상황 | 권장 UI |
|------|--------|
| **레포 0개 (첫 실행)** | onboarding hero — "Add your first repository" + 3 CTA (Clone / Add local / Import GitKraken) |
| **선택 레포 없음** | sidebar 안내 + arrow indicator |
| **검색 결과 0** | minimal "No results for '{query}'" + "Clear search" 링크 |
| **PR/Tag/Stash 0** | category 별 minimal text — illustration 지양 (정체성과 충돌) |

### 4-4. Error 처리 (`api/errors.ts::describeError`)

8 패턴 자동 감지 + 한국어 휴먼화:

| 패턴 | 휴먼 메시지 (예시) |
|------|-------------------|
| auth fail | "인증에 실패했습니다. Settings → forge 에서 토큰을 확인하세요." |
| conflict | "merge 충돌이 있습니다. StatusPanel 의 Conflicted 섹션을 확인하세요." |
| non-fast-forward | "원격 브랜치에 새 커밋이 있습니다. pull 후 다시 push 하세요." |
| safe.directory | "Git safe.directory 설정이 필요합니다." |

**디자이너 spec 필요**: error toast 구조 — title (한 줄) + body (한국어 hint) + action button (예: "Re-authenticate" / "Open Settings").

---

## 5. Focus / Hover / Active states

### 5-1. focus ring

- `ring-2 ring-ring ring-offset-2 ring-offset-background`
- focus-visible 만 (`:focus-visible` — 키보드 only)
- 모든 interactive (button / input / link / tab) 적용

### 5-2. hover

| 요소 | hover 변화 |
|------|----------|
| Button (primary) | `hover:opacity-90` |
| Button (ghost) | `hover:bg-accent/40` |
| Row (clickable) | `hover:bg-muted/50` |
| Link | `hover:underline` |
| Icon button | `hover:bg-accent/40 hover:text-foreground` |

### 5-3. active (pressed)

- `active:scale-95` 또는 `active:opacity-80`
- 100ms transition

### 5-4. Disabled

- `disabled:opacity-50 disabled:cursor-not-allowed`
- 모든 interactive 100% 일관

---

## 6. Tooltip (신규, plan/22 §15)

### 6-1. 기준

- delay: 500ms (hover 시작 후)
- close delay: 0 (hover 떠나면 즉시)
- 위치: 자동 (top 우선, viewport 끝이면 bottom 으로 flip)
- offset: 4px

### 6-2. 종류

| 종류 | 내용 |
|------|------|
| **Action hint** | 단축키 표시 (예: "Show diff (⌘D)") |
| **Truncated text expand** | 한글 ellipsis 잘린 텍스트 전체 표시 |
| **Status meta** | hover preview (예: branch 의 latest commit + ahead/behind) |
| **Disabled reason** | 왜 disabled 인지 (예: "No upstream — push first") |

### 6-3. 시각

- `bg-popover text-popover-foreground border border-border rounded-md shadow-md px-2 py-1 text-xs`
- arrow 표시 (CSS triangle, 6px)
- z-index: 30 (popover layer)

---

## 7. Toast 시스템

### 7-1. 위치 / 시간

- 우상단 (`top-4 right-4`)
- duration:
  - success: 3s
  - info: 4s
  - warning: 5s
  - error: 8s (수동 close 만)

### 7-2. dedup (plan/15 §2-5 미해결)

- key = `${severity}:${title}`
- 1s 내 같은 key 도착 → 무시 또는 count badge ("같은 메시지 +3")
- **디자이너 결정**: badge 위치 (우상단 number) vs 누적 표시

### 7-3. action (plan/22 §15 신규 후보)

- toast 에 action 버튼 1개 가능
- 예: "Push 실패 — pull 먼저" + [Pull 버튼]
- 기본 action: dismiss (X)

---

## 8. ARIA / a11y (plan/22 §15)

### 8-1. icon-only 버튼 (현재 0/47 적용)

- 모든 icon-only 버튼에 `aria-label="..."` 필수
- screen reader 친화 한국어 (예: `aria-label="브랜치 fetch"`)

### 8-2. 모달

- `role="dialog"` + `aria-modal="true"`
- `aria-labelledby="modal-title-id"` (header 요소)
- focus trap (BaseModal 신규 시 reka-ui Dialog 래핑으로 자동)

### 8-3. live region

- ToastContainer: `role="status" aria-live="polite"` (info/success)
- Error toast: `role="alert" aria-live="assertive"`

---

## 9. IPC Timeout UX (sprint 22-1 C4 구현)

| Operation | timeout |
|-----------|---------|
| 일반 invoke | **30s** |
| `bulk_*` / `clone_*` / `fetch_*` / `push` / `pull` / `ai_*` / `maintenance_*` / `import_gitkraken_apply` | **5min** |

**timeout 도달 시**: reject → `useToast.error` 자동 표시 + describeError 휴먼화.

**디자이너 spec 필요**: 5min 작업의 UX
- 30s 경과: "오래 걸리는 중…" hint
- 1min 경과: progress detail (per-repo 단위로 어디까지 됐는지)
- 4min 경과: cancel 버튼 강조
- timeout: "Hang 의심" + cancel + retry 버튼 모달

---

## 10. 확대/축소 (Zoom)

- ⌘= / ⌘- / ⌘0 (reset)
- 기본 14px, range 11~18px 추정
- `font-size` 전역 스케일

**디자이너 결정 필요**: 11px 일 때도 가독성 유지 가능한 line-height / icon size 매핑.

---

## 11. 다크모드 토글

- CommandPalette `view.theme.toggle` (현재 글로벌 단축키 없음 — 디자이너가 후보 단축키 권장 가능, 예: ⌘⇧D 또는 ⌘⇧T)
- transition: `transition-colors duration-200` 권장
- 시스템 자동 (`prefers-color-scheme`) 지원 옵션 — 현재 미구현, 후보

---

## 12. 디자이너 결정 매트릭스 (요약)

| 영역 | 결정 필요 |
|------|---------|
| Modifier 표기 | ⌘ vs Cmd / 다중 modifier 구분 |
| 한글 ellipsis | tooltip expand vs 그대로 / 좌측 ellipsis 정책 |
| 파일명 encoding 신뢰 | 시각 표시 (icon + tooltip) |
| Drag ghost / drop highlight | 색·스타일 |
| Skeleton | 화면별 구조 (4 화면 × 1 skeleton) |
| Empty state | hero vs minimal |
| Error toast | action 버튼 / re-auth CTA |
| Focus ring | offset / 색 / 두께 |
| Tooltip | delay / position / arrow |
| Toast dedup | badge vs 누적 |
| Long-running progress | 30s/1m/4m 단계별 hint |
| Zoom 11px | 작은 크기 가독성 |
