# Phase 1 시나리오 — 07 Settings (PoC 영역)

> Plan #40 Phase 1 / PoC 우선 영역 — 가장 정적 (transition 적음, dynamic popup 적음). AHK toolchain 검증 + Claude narration draft 우선 적용.
>
> backlog 매핑: SB-047 ~ SB-051 + Phase 4 settings (auto-fetch / branchClickAction / deep merge)

## 영역 개요

GitKraken Settings 모달 = Preferences (한 창, 좌측 nav + 우측 panel). 7-10 sub-section: General / Profiles / Integrations / UI Customization / Workflow / Plugins / Cloud Patches / Keyboard Shortcuts / Advanced.

git-fried 의 [Settings 페이지](apps/desktop/src/pages/settings) 와 1:1 매핑. backlog SB-047~051 + 사용자 보고 Settings 결함 (SB-050 deep merge, SB-028 auto-fetch default, SB-012 branchClickAction) 의 GitKraken 원본 확인용.

## 시나리오 list (5건, 우선순위순)

---

### SC-07-1: Settings 모달 진입 (PoC primary target)

- **사용자 액션**: GitKraken main window focus → `Ctrl+,` (또는 좌하단 ⚙️ 아이콘 클릭)
- **GitKraken 예상 반응**: Settings 모달 fade-in (200-300ms). 좌측 nav (General / Profiles / Integrations / ...) + 우측 patch = General. **모달 dimming overlay** 활성.
- **git-fried 대응**: 좌측 sidebar 의 "Settings" 페이지 (별도 route `/settings`). 모달 X — 페이지 전체 화면 사용.
- **기대 screenshot**: 2개
  1. `07-settings-entry-before.png` — Settings 진입 직전 (main window normal)
  2. `07-settings-entry-after.png` — Settings 모달 open + General 활성
- **AHK 난이도**: **S** (hotkey 단순, transition 짧음)
- **우선도**: **HIGH** (PoC 검증 primary)
- **backlog**: 없음 (게이트 동작만)

### SC-07-2: Profiles 탭 — 사용자 프로필 / 한글 commit 식별

- **사용자 액션**: Settings 모달 nav 의 "Profiles" 클릭 → 우측 panel 의 사용자 list 1행 hover
- **GitKraken 예상 반응**: Profiles panel 표시 — 사용자 이름/이메일/avatar list. hover 시 ⋮ context menu icon 표시. "Set as default" / "Edit" / "Delete" 옵션.
- **git-fried 대응**: `pages/settings/sections/ProfilesSection.vue` — 동일 패턴 (Pinia store 기반). per-repo override 는 SB-XXX 차후.
- **기대 screenshot**: 3개
  1. `07-settings-profiles-list.png` — Profiles panel + 기본 list
  2. `07-settings-profiles-hover.png` — 1 row hover + ⋮ 표시
  3. `07-settings-profiles-context.png` — ⋮ 클릭 후 dropdown
- **AHK 난이도**: **M** (image search 로 profile row 위치 식별 + hover precise)
- **우선도**: **HIGH**
- **backlog**: SB-047 profiles section UX parity 검증

### SC-07-3: Integrations 탭 — Forge (Gitea/GitHub/GitLab) 연결

- **사용자 액션**: nav "Integrations" 클릭 → 우측 panel 의 GitHub row 클릭 → "Connect" 버튼
- **GitKraken 예상 반응**: GitHub OAuth 페이지로 외부 브라우저 redirect (또는 in-app webview). PAT 입력 옵션도 함께 표시.
- **git-fried 대응**: `pages/settings/sections/ForgeSetup.vue` — Gitea + GitHub PAT 기반. OAuth 미구현 (사용자 결정 영역, /analyze User Decision).
- **기대 screenshot**: 2개
  1. `07-settings-integrations-list.png` — Integrations panel (GitHub/GitLab/Bitbucket/Azure 등 list)
  2. `07-settings-integrations-github-connect.png` — Connect 버튼 클릭 후 (OAuth vs PAT 선택 UI)
- **AHK 난이도**: **M** (Connect 버튼 click 후 외부 브라우저 spawn 차단 필요 — 사용자 동의 후 진행)
- **우선도**: **MEDIUM**
- **backlog**: SB-048 + OAuth 미구현 사용자 결정 (analyze finding)

### SC-07-4: UI Customization — Theme / Density / Font

- **사용자 액션**: nav "UI Customization" 클릭 → Theme dropdown ("Auto / Light / Dark") + Density slider + Font size 변경
- **GitKraken 예상 반응**: 실시간 preview — 모달 자체 + main window 색상/density/font 즉시 반영. Apply 버튼 없음 (auto-save).
- **git-fried 대응**: 동일 UX 패턴 — `pages/settings/sections/UiCust.vue`. Theme + Density + Font 통합. SB-049 i18n 적용 완료.
- **기대 screenshot**: 4개 (각 변경 단계별)
  1. `07-settings-ui-default.png` — UI Cust panel 진입
  2. `07-settings-ui-theme-light.png` — Light theme 선택
  3. `07-settings-ui-theme-dark.png` — Dark theme 선택
  4. `07-settings-ui-density-compact.png` — Compact density
- **AHK 난이도**: **M** (slider control AHK 가 직접 못 다룸 — `MouseClickDrag` 사용 + image verify)
- **우선도**: **HIGH** (theme preview 비교가 차별점 검증의 핵심)
- **backlog**: SB-049 i18n parity ✓ / Density slider micro-UX 비교

### SC-07-5: Workflow — Auto-fetch interval

- **사용자 액션**: nav "Workflow" → "Auto-fetch" toggle 활성 → interval input 변경 (예: 5 → 10 min)
- **GitKraken 예상 반응**: toggle + interval input 표시. Apply 즉시 (또는 Save 버튼). Default value 확인.
- **git-fried 대응**: Phase 9 SB-028 — auto-fetch default 0 → 5min 변경됨 (commit `ace68a0`). GitKraken 의 default 값 확인 = SB-028 결정의 baseline 검증.
- **기대 screenshot**: 2개
  1. `07-settings-workflow-default.png` — Workflow panel 진입 (auto-fetch default 값)
  2. `07-settings-workflow-changed.png` — interval 변경 후
- **AHK 난이도**: **S**
- **우선도**: **MEDIUM** (SB-028 검증)
- **backlog**: SB-028 default 값 cross-check

---

## Acceptance (Phase 1 영역 단위)

- [ ] 5 시나리오 enumerate 완료 (현재 ✓)
- [ ] PoC: SC-07-1 자동 실행 + screenshot 2개 + Claude narration 1건 (Phase 2 본 작업)
- [ ] 나머지 4 시나리오: PoC 결과 반영 후 Phase 3 확장 시점에 실행
- [ ] Claude narration 7-section block (Phase 4)
- [ ] git-fried 비교표 5 행 (Phase 5)

## Open question

- GitKraken `Ctrl+,` hotkey 가 main shortcut 인지 확인 필요 (PoC 검증)
- Settings 모달 dimming overlay 가 image search 정확도에 영향? (PoC 검증)
- Theme 변경 시 main window 같이 변경되면 image anchor 재검증 (preview 시점 anchor 무효)
