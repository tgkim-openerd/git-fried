# Plan #41 — GitKraken 전체 기능 coverage + Codex 페어 진행

> 작성: 2026-05-18 / 트리거: 사용자 `/goal` 설정 — "깃 크라켄의 모든 기능 전부 테스트 가능 할 때 까지 Codex와 같이 피드백 및 상의, 코딩 진행" / 선행: Plan #40 종료 (✓4 / △9 / ✗4 / ?3)

## Goal

GitKraken Desktop 12.1.1 의 **모든 기능** 을 git-fried 가 **테스트 가능** 한 수준 도달. Codex 와 페어 진행 (각 단계 검증 + 신규 finding emit).

**해석**:

- "테스트 가능" = git-fried 가 GitKraken 의 기능 시도 가능 + UX parity 검증 가능
- "모든 기능" = Plan #40 의 7 영역 + 추가 발견 영역 (Codex finding + PoC v4)
- "Codex 와 같이" = 매 단계 결정 / 검증에 Codex 호출 (Memory Rule 3 default)

## Scope (Plan #40 종료 후 잔여)

### 미 cover / 미검증 영역 (PoC v4 필요)

| # | 영역 | 상태 (Plan #40 종료 시) |
| --- | --- | --- |
| 1 | Tag annotate dialog | ? 미검증 — context menu 미캡처 |
| 2 | PR detail / approve / merge | ? 미검증 — sidebar default 만 |
| 3 | Worktree add / context menu | ? 미검증 — sidebar default 만 |
| 4 | Stash 생성 hotkey + dialog | ✗ 미확정 |
| 5 | Sidebar 7 섹션 모든 expanded 상태 | 사용자 setup 안 됨 |

### 신규 backlog (Codex finding 기반)

| # | 우선도 | 영역 | 출처 |
| --- | --- | --- | --- |
| SB-NEW-1 | HIGH | Bottom-right status bar | Codex Phase 3 |
| SB-NEW-2 | MED | Top toolbar 6 버튼 | Codex Phase 3 |
| SB-NEW-3 | MED | Sidebar count badges | Codex Phase 3 |
| SB-NEW-4 | MED | Right detail panel Path/Tree | Codex Phase 3 |
| SB-NEW-5 | LOW | Tab row polish | Codex Phase 3 |

### git-fried 미구현 영역 (구현 plan 필요)

| # | 영역 | git-fried 현재 |
| --- | --- | --- |
| 1 | Commit Signing UI | 미구현 |
| 2 | Gitflow workflow | 미구현 (의도적 거부 가능) |
| 3 | Git Hooks 관리 UI | 미구현 (lefthook 외부) |
| 4 | Path to sh.exe 같은 git config UI | 미구현 |

### Plan #40 미 verify (PoC v4 결과 검증 보강)

| # | 영역 | 비고 |
| --- | --- | --- |
| 1 | Auto-Fetch Interval default 값 | sidebar SB-028 baseline cross-check |
| 2 | Initial Commits in Graph 전략 (2000 vs 500/5000) | git-fried UX 결정 검토 |
| 3 | GitKraken AI tab 내부 | 사용자 미진입 |

## Phase 분리 (Step-by-step + Codex 페어)

### Step 1 — Settings → Workflow → Hotkey 페이지 자동 캡처 (XS)

- AHK script 작성: Settings 진입 + nav 이동 ("Workflow" 또는 "Keyboard Shortcuts" 페이지) + capture
- 산출: GitKraken hotkey list PNG (Stash / Branch / Pull / Push / Tag 등 단축키 확인)
- **Codex 페어 1차**: hotkey list 시각 분석 + git-fried 미구현 hotkey enumerate

### Step 2 — Image search anchor 캡처 (S)

- 사용자 사전 setup 1회: GitKraken sidebar 7 섹션 모두 expand
- AHK script: 전체 sidebar capture → 사용자가 manual 라벨 영역 crop 또는 Claude vision 으로 좌표 추출
- 산출: `bench/gitkraken-spike/anchors/12.1.1/{tags,stashes,worktrees,pull-requests,...}.png`
- **Codex 페어 2차**: anchor PNG 검증 + 좌표 정확성 확인

### Step 3 — 미 cover 4 영역 detail recapture (M)

- AHK script: image search anchor 사용해 sidebar 의 specific section 클릭 → expand → capture
- 각 영역 추가 캡처:
  - Tag: row 우클릭 → context menu → Annotate 클릭 → dialog
  - PR: row 클릭 → detail panel
  - Worktree: + 버튼 클릭 → Add dialog
  - Stash: 생성 hotkey (Step 1 에서 확인) → dialog
- **Codex 페어 3차**: 각 영역 narration draft + Codex cross-val batch

### Step 4 — 미구현 4 영역 baseline 캡처 + 구현 plan (M)

- AHK script: Commit Signing / Gitflow / Git Hooks / Path to sh.exe Settings 진입 + capture
- 각 영역 narration: GitKraken UX + git-fried 대응 부재 + 구현 권고
- **Codex 페어 4차**: 미구현 영역의 git-fried 구현 우선순위 + design 권고

### Step 5 — Codex 페어 최종 batch 검증 (S)

- 모든 Step 1~4 산출물을 Codex 1 batch 로 통합 검증
- 누적 Claude 오류율 갱신 (Memory Rule 3)
- 신규 backlog 후보 추가 enumerate

### Step 6 — comparison.md update + memory + commit + 구현 단계 권고 (S)

- comparison.md 의 parity matrix 20 → 30+ row 확장
- ? 미검증 3 → 모두 결정 (✓/△/✗)
- ✗ 미구현 4 → 구현 plan 우선순위
- memory entry 갱신 + obsidian log

## Open question (Codex 결정 필요)

1. **사용자 setup 자동화 가능?** — sidebar 7 섹션 모두 expand 를 AHK 가 자동 trigger 할 수 있는지 (각 섹션 라벨 click) vs 사용자 manual setup 필수
2. **image search anchor 의 fragility** — GitKraken 12.1.1 → 12.2 업그레이드 시 모든 anchor 재캡처 — 그 시점 자동 detect 가능?
3. **미구현 영역 우선순위** — Commit Signing > Git Hooks > Gitflow > Path to sh.exe — 또는 사용자 use case 기반 재정렬?
4. **Codex 페어 비용 cap** — Step 1~5 의 5회 Codex 호출 + 최종 batch = 6회. cost-tracker baseline × 3 초과 시 cap 적용?

## Effort (사이즈)

| Step | 사이즈 |
| --- | --- |
| Step 1 hotkey 캡처 | XS |
| Step 2 anchor 캡처 | S |
| Step 3 미 cover 4 영역 | M |
| Step 4 미구현 4 영역 | M |
| Step 5 Codex 최종 batch | S |
| Step 6 update + commit | S |
| **합산** | **M+** (single session 가능, 부분 multi-session 필요 가능) |

## Acceptance (Goal 달성 조건)

- [ ] PoC v4 toolchain 작동 (anchor + image search)
- [ ] 모든 ? 미검증 영역 (3건) → 결정 완료 (✓/△/✗)
- [ ] 미구현 영역 (4건) baseline capture + 구현 plan
- [ ] comparison.md parity matrix 30+ row
- [ ] Codex 페어 누적 batch 4+ (Phase 2/3 + Plan #41 Step 1~5)
- [ ] 다음 sprint 진입점 구체 명시 (어느 미구현 영역부터 구현)

## 다음 sprint 진입점 (Plan #41 후)

Goal 충족 시 git-fried 가 GitKraken 의 모든 기능 시도 가능 — 실제 git-fried 측 구현 작업 진입.

우선순위 candidate:

1. **CRIT-001 PR CI wire** (Sprint c95+ Wave 1 인프라 + Codex SB-NEW-3 sidebar count) — 사용자 이미 명시
2. **HIGH-001 Smart Branch Visibility wire**
3. **SB-NEW-1 HIGH Bottom-right status bar**
4. **Commit Signing UI** 또는 **Stash hotkey 통일** (Step 1/4 결과로 결정)
