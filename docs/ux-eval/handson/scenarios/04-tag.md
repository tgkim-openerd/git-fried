# Phase 1 시나리오 — 04 Tag

> Plan #40 Phase 1 / 2번째 우선 (Settings 다음, Stash 앞) — sidebar microgap SB-033 (Annotate tag) 가 Sprint c95 에서 구현됨. GitKraken 의 tag UX 정확한 baseline 확인 = SB-033 검증 + SB-034~036 신규 backlog 발굴.
>
> backlog 매핑: SB-033 (구현 완료) + SB-018 (Tag mini filter bar) + 신규 SB-034~036 후보

## 영역 개요

GitKraken Sidebar 의 "TAGS" 섹션 — local tag list + remote tag (있으면) 표시. tag 우클릭 → Annotate / Push / Delete / Copy SHA 컨텍스트 메뉴. Graph 의 commit row 옆 tag chip + tag 자체에 별도 chip 색 (Sprint c51 = violet).

## 시나리오 list (5건, outline — PoC 후 detail 보강)

### SC-04-1: TAGS 섹션 진입 + tag list 표시

- 사용자 액션: 좌측 sidebar 의 "TAGS" 섹션 클릭 (collapsed → expanded)
- 예상 반응: tag list 표시 — semver 정렬 vs 알파벳 정렬?. 각 tag row = name + commit SHA preview + author 또는 date?
- git-fried 대응: SB-008 tag semver 정렬 (Sprint c91-c93 구현). GitKraken 의 기본 정렬이 semver 인지 확인.
- screenshot: 2개 (collapsed / expanded)
- AHK: **S** / 우선도 **HIGH** / backlog: SB-008 cross-check

### SC-04-2: Tag row hover — tooltip + context icon

- 사용자 액션: tag row hover (mouse over, no click)
- 예상 반응: tooltip 표시 (전체 SHA / annotate message / author / date 중 무엇 표시?). ⋮ context icon 우측 등장.
- git-fried 대응: SB-034 후보 (현재 git-fried 는 tag hover tooltip 미구현)
- screenshot: 2개 (hover 전/후)
- AHK: **M** (hover transition 캡처 timing)
- 우선도 **MEDIUM** / backlog: SB-034 신규 후보

### SC-04-3: Tag 우클릭 → Annotate / Push / Delete / Copy SHA 메뉴

- 사용자 액션: tag row 우클릭
- 예상 반응: context menu 표시 — Annotate (lightweight → annotated 전환?) / Push to remote / Delete / Copy SHA / Checkout tag / View on web (forge) 등.
- git-fried 대응: SB-033 Annotate tag (Rust IPC + Vue, Sprint c95 구현 완료). 메뉴 항목 완전성 비교.
- screenshot: 3개 (right-click 직후 / Annotate hover / submenu 있으면 별도)
- AHK: **M** (right-click + image search context menu anchor)
- 우선도 **HIGH** / backlog: SB-033 검증 + 누락 메뉴 항목 발견

### SC-04-4: Tag mini filter bar (SB-018 비교)

- 사용자 액션: TAGS 섹션 상단의 filter/search input 사용 (있으면)
- 예상 반응: 실시간 filter — 입력 시 tag list narrowing.
- git-fried 대응: SB-018 Tag mini 전용 filter bar (Phase 5 구현 완료, commit `1c806cc`).
- screenshot: 2개 (filter 입력 전/후)
- AHK: **S**
- 우선도 **MEDIUM** / backlog: SB-018 parity 검증

### SC-04-5: Graph 의 commit row 옆 tag chip

- 사용자 액션: tag 가 있는 commit row 를 graph 에서 찾아 표시 확인 (좌측 sidebar X, Graph 중앙 panel)
- 예상 반응: commit message 좌측에 tag chip — violet color (Sprint c51 git-fried 구현 baseline). 클릭 시 sidebar tag selected?
- git-fried 대응: 동일 패턴 — useCommitColumns 의 ref-pill type. Sprint c51 도입.
- screenshot: 2개 (tag chip 보이는 commit / tag chip click 결과)
- AHK: **L** (graph 의 dynamic content — virtual scroll, commit row 위치 변동 큼)
- 우선도 **LOW** (시각 비교만, 동작 차이 적음)

## Open question

- GitKraken 의 tag annotate UX 가 modal 인지 inline 인지
- Lightweight tag → annotated 전환 가능한지 (or 별도 명령)
- Multi-tag commit row 표시 방식 (chip 여러 개 vs 합쳐서 N+ 표시)
