# 18. Dogfood 피드백 수집 + bug fix sprint plan

작성: 2026-04-27 / 트리거: 사용자 본인 dogfood 결과 누적 시 (시간 될 때) 발견 사항 일괄 정리

> **목적**: REVIEW.md "사용자 dogfood 시 주의사항" 의 12개 신규 진입점 + 기존 50+ 시나리오를 사용자가 실사용한 결과를 정리하는 양식 + 우선순위 분류 + bug fix sprint 진입 trigger.
>
> **이 plan 의 특징**: 다른 plan 과 달리 **template 형식**. 사용자가 dogfood 중 또는 이후 발견 사항을 본 문서 §3 양식에 채워 넣으면, 다음 세션에서 그대로 sprint 진입 가능.

---

## 1. 30초 사용법

1. **dogfood**: REVIEW.md 의 "신규 진입점 12개" + "기존 50+ 시나리오" 사용
2. **수집**: 발견 사항을 본 문서 §3 의 "발견 항목 채워넣기" 표에 기록
3. **분류**: P0/P1/P2 자동 분류 (§4 가이드)
4. **sprint 진입**: 다음 세션에 "docs/plan/18 의 P0/P1 fix" 메시지로 즉시 진입

---

## 2. dogfood 시나리오 catalog (참고)

### 2-1. 신규 진입점 12개 (REVIEW v2 §"사용자 dogfood 시 주의사항")

| # | 기능 | 진입 |
| - | --- | --- |
| 1 | 다중 레포 탭 | Sidebar 클릭 / RepoSwitcher / ⌘T / RepoTabBar + 버튼 |
| 2 | Hunk-level stage | StatusPanel 의 ✂ 버튼 |
| 3 | 레포 필터 | ⌘⌥F |
| 4 | WIP 노트 | 그래프 상단 banner — stash prefill |
| 5 | Branch ref hide | 그래프 ref pill hover → 🙈 |
| 6 | 섹션 collapse | StatusPanel/StashPanel 헤더 우클릭 |
| 7 | 터미널 drag-drop | 변경 파일 → terminal |
| 8 | Diff Split (multi-file) | CommitDiffModal Split 토글 |
| 9 | AI 충돌 미리해결 | StatusBar ⚠ 옆 ✨ |
| 10 | OS 파일매니저 | ⌥O / Alt+O |
| 11 | Fullscreen | F11 |
| 12 | CommandPalette 9 토글 | ⌘P |

### 2-2. 기존 핵심 시나리오 (REVIEW v1 + v2)

- 한글 commit / branch / PR 메시지 round-trip
- 50+ 회사 Gitea 레포 동시 관리 (workspaces)
- Worktree 8개 동시 작업 (Agent 모드)
- AI commit message / PR body / merge resolve / code review (Claude/Codex CLI)
- Sync template (다중 레포 cherry-pick)
- Bisect / Reflog / LFS / Submodule
- Hide / Solo branches
- Vim navigation J/K/H/L + S/U
- Launchpad Pin / Snooze / Saved Views
- Profiles 토글 (회사 / 개인)

---

## 3. 발견 항목 채워넣기 (양식)

> **사용법**: 각 발견 사항마다 한 row 추가. **ID** 는 자동 (D-001 부터). dogfood 진행 중 즉시 기록 → 메모리에 의존 안 함.

| ID | 진입점 / 시나리오 | 발견 (재현 단계) | 기대 동작 | 실제 동작 | 우선순위 (§4) | 상태 |
| --- | --- | --- | --- | --- | --- | --- |
| D-001 | _e.g. ⌘⌥F 레포 필터_ | _e.g. 영문 입력 후 한글 입력 시 매치 안 됨_ | _NFC 정규화로 매치되어야_ | _CP949 mangle_ | P0 (한글) | 🟡 발견 |
| D-002 | | | | | | |
| ... | | | | | | |

### 양식 작성 예 (dogfood 시 실제 입력)

| ID | 진입점 | 발견 | 기대 | 실제 | 우선 | 상태 |
| --- | --- | --- | --- | --- | --- | --- |
| D-001 | ⌘⌥F 레포 필터 | 한글 별칭 "회사용" 필터 안 걸림 | NFC 매치 | 0 결과 | P0 | 발견 |
| D-002 | Hunk-level stage | 마지막 라인 newline 없는 파일 apply 실패 | git apply 통과 | "corrupt patch at line N" | P0 | 발견 |
| D-003 | Diff Split multi-file | 40 파일 PR 에서 file picker 검색 느림 | 100ms 이내 | 800ms+ | P1 | 발견 |
| D-004 | StatusBar ✨ AI 미리해결 | API 키 만료 시 alert 만 표시 | toast + 설정 가이드 | alert | P1 | 발견 |
| D-005 | F11 fullscreen | 두번째 모니터에서 토글 시 첫 모니터로 이동 | 같은 모니터 유지 | 모니터 변경 | P2 | 발견 |
| D-006 | RepoTabBar 드래그 | 빠른 드래그 시 탭 위치 깨짐 | 부드러운 재정렬 | 일부 탭 사라짐 | P1 | 발견 |

---

## 4. 우선순위 분류 가이드

| 우선 | 기준 | 예시 |
| --- | --- | --- |
| **P0** | 한글 mangle / 데이터 손실 / panic / 보안 / 일상 사용 차단 | 한글 안 매치 / commit message 깨짐 / `unwrap()` panic |
| **P1** | UX 큰 영향 / 자주 사용 기능 회귀 / 성능 (>500ms) | drag 깨짐 / AI 에러 처리 부족 / 검색 느림 |
| **P2** | 미적 / 낮은 빈도 / 소수 사용자 | fullscreen 모니터 / 색상 약간 어긋남 |
| **P3** | nice-to-have / 미세 polish | hover 색상 / icon 크기 |

**자동 분류 규칙**:
- 한글 / encoding / round-trip → P0
- 데이터 영속성 / SQLite / migration → P0
- AI 응답 → P1
- 키보드 / 단축키 회귀 → P1
- 모달 / focus → P1
- 색상 / 레이아웃 / 애니메이션 → P2
- 단순 메시지 wording → P3

---

## 5. Bug fix sprint 진입 시퀀스

### 5-1. 발견 항목 5+개 누적 시
1. 본 문서 §3 표에 기록
2. P0 / P1 우선 처리 PR 1~2개로 묶음
3. P2/P3 는 별도 backlog

### 5-2. 권장 sprint 분해

| Sprint | 내용 | 작업량 |
| --- | --- | --- |
| **D-fix P0** | 한글 / 데이터 / panic 위험 우선 | ~M (4~6h) |
| **D-fix P1** | UX 큰 영향 묶음 | ~M (4~8h) |
| **D-fix P2/P3** | 폴리시 묶음 (여유 시) | ~S (2~4h) |

### 5-3. PR 제출 시 commit 형식

```
fix(d-fix): D-001~D-002 한글 NFC + Hunk apply newline (P0)

- D-001: ⌘⌜F 필터의 NFC 정규화 추가 (`useFilter.ts`)
- D-002: HunkStageModal 의 newline missing 처리 (`parseDiff.ts`)

Closes: #N (해당 GitHub issue 가 있다면)
```

---

## 6. 회귀 차단 체크리스트 (모든 fix PR)

각 fix 마다:

- [ ] **재현 → 회귀 test** (cargo unit 또는 Vitest) 추가
- [ ] 한글 round-trip 회귀 (해당 시)
- [ ] `bun run typecheck` / `bun run lint` / `cargo test --lib` / `cargo clippy` 통과
- [ ] 사용자 본인 dogfood 재현 시나리오로 1회 검증
- [ ] commit HEREDOC + `'EOF'`, Co-Authored-By 금지
- [ ] REVIEW.md 의 dogfood 시나리오에 "✅ 검증 완료" 표기 (선택)

---

## 7. dogfood 세션 진입 / 종료 양식

### 7-1. 진입 시
- [ ] 본 문서 §3 표 비워둔 row 5~10개 사전 추가
- [ ] dogfood 시간 set (예: 30분 / 1시간)
- [ ] 시나리오 5개 미리 선택 (REVIEW v2 의 "신규 진입점 12개" 중)

### 7-2. 종료 시
- [ ] §3 표에 발견 항목 1줄당 입력
- [ ] §4 가이드로 우선순위 자동 분류
- [ ] P0 1+개 발견 시 → 다음 세션 D-fix P0 sprint 즉시 진입
- [ ] P1+ 만 → 누적 후 batch
- [ ] P2/P3 → backlog

---

## 8. 다음 세션 진입 메시지

발견 사항 누적 후:

```text
"docs/plan/18 §3 의 D-001~D-00N 항목 D-fix P0 sprint 진입.
한글 NFC 회귀 우선."
```

또는 발견 항목 0이면:

```text
"docs/plan/18 dogfood 결과 — 발견 사항 0. 다음 plan (15 / 16 / 17) 진입."
```

---

## 9. 외부 채널 (v1.x 진입 후)

v1.0 GitHub repo public + 사용자 100+ 시점:

- **GitHub Issues** — 외부 사용자 bug report 단일 채널
- **GitHub Discussions** — 기능 요청 / Q&A
- 본 plan 의 §3 표는 **사용자 본인** dogfood 만 (외부는 GitHub Issues 별도)

→ 18 plan 의 §3 vs GitHub Issues 통합 정책은 v1.0 직전 결정 (`19-v0.3-release-prep.md` 후보).

---

## 10. 결정 로그 (2026-04-27)

| # | 결정 | 근거 |
| --- | --- | --- |
| 1 | **본 plan = template 형식** | 동적 입력이 가치 — 작성 시 빈 표 두고 사용자가 채움 |
| 2 | **D-fix P0 자동 sprint 진입** | 한글 / 데이터 / panic 은 빠른 대응 가치 큼 |
| 3 | **회귀 test 추가 강제** | scope discipline — fix 가 또 다른 회귀 만들지 않게 |
| 4 | **외부 channel 분리** | 사용자 본인 dogfood (P0 즉시) vs 외부 issue (batch) |

---

## 11. 다음 plan 후보

- 19 = `19-v0.3-release-prep.md` (GitHub repo public + CHANGELOG + first release)
- 20 = `20-performance-benchmark.md` (50k commit / 큰 diff / 메모리 baseline 측정)

---

다음 문서 → 발견 항목 누적 후 D-fix sprint 진입 또는 19/20 진입
