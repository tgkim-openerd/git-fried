# GitKraken UI/UX 흡수 — 스크린샷 capture 가이드

본 디렉토리는 GitKraken Desktop 의 sidebar / UI 동작을 캡처해 git-fried 와
비교하는 워크플로우의 입력 자료를 모은다.

## 빠른 시작

```bash
# 1. PowerShell (pwsh 7+) 열기
pwsh

# 2. 자동 스크린샷 script 실행 (git-fried 루트에서)
pwsh -File bench/gitkraken-spike/auto-screenshot.ps1

# 3. 별도 창에서 GitKraken 띄우기 (같은 repo)
& "$env:USERPROFILE\AppData\Local\gitkraken\app-12.1.1\gitkraken.exe" `
  --path "D:\01.Work\08.rf\git-fried"

# 4. GitKraken UI 조작 → script 콘솔에 라벨 입력 → 2초 후 자동 캡처
```

## 영역 라벨 컨벤션 (파일명 prefix)

캡처 파일명은 `gitkraken-{timestamp}-{label}.png` 형식. 라벨 prefix 는 microdiff
backlog (`docs/ux-eval/2026-05-18-sidebar-microdetail-diff.md` 의 SB-XXX) 와
매칭 가능하도록 다음 컨벤션 사용:

| Prefix | 영역 | microdiff 매칭 예 |
|---|---|---|
| `sidebar-*` | 사이드바 micro-detail | SB-001~SB-051 (시각 / 인터랙션) |
| `ctx-menu-*` | 우클릭 context menu | Codex S3/S5/S6/S7/S9/S10 (19/10/8/6/4 항목) |
| `drag-*` | drag & drop matrix | SB-019 (branch→remote push/PR), drag matrix |
| `hover-*` | hover popover / tooltip | SB-003 (branch last commit), SB-016 (worktree path), SB-030 (tag msg) |
| `dblclick-*` | 더블클릭 동작 | SB-012 (branch checkout), SB-015 (section maximize), SB-030 (tag jump) |
| `empty-*` | 빈 상태 / 로딩 skeleton | SB-048 empty 정책 |
| `error-*` | 에러 상태 (네트워크 / 권한) | LOW backlog |
| `keyboard-*` | 키보드 nav / 단축키 | SB-021/022/023 (Ctrl+/+J+L) / SB-031 (↑↓) |
| `state-*` | hide/solo 시각 / CI 아이콘 | SB-013 (gray/orange), SB-017 (PR CI 4 아이콘) |

## 시나리오 진행 권고 순서 (HIGH ROI 부터)

### Wave 1 — HIGH microdiff backlog (사용자 결정 필요 영역)

1. **`sidebar-baseline`** — 첫 진입 시 sidebar 전체 (workspace switcher / branches / stash / worktree / PR)
2. **`ctx-menu-local-branch`** — local branch row 우클릭 (GitKraken 19 항목 vs git-fried 20 정합 검증)
3. **`ctx-menu-remote-branch`** — remote branch 우클릭 (Open in browser 등 차이)
4. **`ctx-menu-tag`** — tag 우클릭 (10 항목, SB-033 Annotate 위치 확인)
5. **`state-hide-solo-icons`** — branch hide / solo 상태 시각 (SB-013 gray/orange 토큰 시각 확인)
6. **`dblclick-section-header`** — section header dblclick maximize 동작 (SB-015 / CDX-004 collapsed expand 검증)

### Wave 2 — MEDIUM (인터랙션 정밀)

7. **`hover-branch-row`** — branch row hover 시 popover delay 측정 (SB-003)
8. **`hover-worktree-path`** — worktree row hover full path (SB-016)
9. **`hover-tag-annotation`** — annotated tag hover 메시지 (SB-030)
10. **`drag-branch-to-branch-merge`** — drag merge dialog
11. **`drag-branch-to-remote-push`** — drag remote push (SB-019a)
12. **`keyboard-arrow-nav`** — ↑/↓ keyboard navigation in sidebar (SB-031)
13. **`empty-search-no-results`** — 검색 결과 0 시 메시지 (SB-048)

### Wave 3 — LOW + 디테일 측정

14. **`state-pr-ci-icons`** — PR list 의 CI status 4 아이콘 (SB-017 v0.3 한계 해소 reference)
15. **`sidebar-resize-handle`** — sidebar resize 동작 + min/max (SB-001 비교)
16. **`keyboard-ctrl-j-toggle-panel`** — Ctrl+J Left Panel toggle 동작

## 분석 워크플로우 (Claude Code 세션)

```text
1. 캡처 종료 후 manifest JSON 자동 생성:
   docs/ux-eval/screenshots/session-{timestamp}.json

2. Claude Code 세션에서 분석 요청:
   "screenshots/session-{ts}.json + 그 안의 모든 PNG 분석 후 git-fried
    microdiff 보고서와 비교, 신규 finding 만 추출"

3. 신규 보고서 생성:
   docs/ux-eval/2026-XX-XX-gitkraken-hands-on-{wave}.md
   ├─ 캡처 별 분석 (라벨 + 관찰 사실 + microdiff 매칭)
   ├─ 신규 finding (기존 backlog 외)
   └─ git-fried 코드 fix 후보 (SB-XXX 매핑)

4. 코드 적용:
   - 우선순위 매겨서 별도 sprint c96+ 진행
   - microdiff 보고서 v0.2 patch
```

## 캡처 관련 Tip

- **focus 전환 지연**: script 가 라벨 입력 후 2초 대기 — GitKraken focus 로 정확히 돌아갈 시간 확보
- **multi-monitor**: PrimaryScreen 만 캡처 — GitKraken 을 1번 모니터에 배치
- **DPI scaling**: 4K 디스플레이는 200% scaling 시 캡처가 ½ 사이즈로 저장될 수 있음 — 필요 시 sScript 의 `bitmap.SetResolution(96, 96)` 추가
- **민감 정보**: 캡처 전 GitKraken 의 시크릿 / 작업 비공개 정보 가리기 (다른 repo open 또는 user info hidden)

## 산출물 (별도 sprint 통합 시)

- `docs/ux-eval/screenshots/*.png` — raw capture
- `docs/ux-eval/screenshots/session-{ts}.json` — capture manifest
- `docs/ux-eval/2026-XX-XX-gitkraken-hands-on-{wave}.md` — Claude 분석 결과
- `docs/plan/40-gitkraken-hands-on-uptake.md` (예정) — git-fried 코드 fix 계획

본 디렉토리는 capture artifact 만 — 분석/계획 문서는 docs/ux-eval/ + docs/plan/ 에.
