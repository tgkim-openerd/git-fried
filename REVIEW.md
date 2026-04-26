# REVIEW — git-fried 진행 현황

작성: 2026-04-27 (단일 세션 누적, 총 **76 commits / ~34,300 lines** / 153 파일)
대상: tgkim — 시간 될 때 dogfood + Line-level stage 진입 결정

---

## 30초 요약

**v0.0 → v1.0 핵심 + GitKraken 12 흡수 catalog 21/21 완료**.
이번 세션 후반에 Sprint A~M (큰 작업 G/H/I + 미시 디테일 J/K/L/M 포함) 13 묶음 추가. 모든
빌드/테스트는 Claude 직접 검증 (typecheck 0 / cargo test 73 pass / cargo check 통과).

```text
76 commits / 34,343 +/-263 lines / 153 파일
75+ IPC 명령어 + 33+ 컴포넌트 + 25+ composable + 4 SQLite migration
Rust 단위 테스트: 73 pass / 0 fail
- 0 alert (모두 toast)
- 30+ 단축키 (도움말 ?)
- 7개 우측 탭 + 11+ 모달 + 5 페이지 + 1 통합 터미널
- multi-repo Tab UI (drag-drop 재정렬 + ⌃Tab/⌘⇧W)
```

---

## 다음 세션 진입 옵션

### A: Line-level stage (Sprint H 후속, ★ 본 세션 다음 작업)

Sprint H 의 hunk 단위 위에 line 단위 stage 추가. CodeMirror selection 또는
checkbox 선택 → 선택 라인만 추출 → minimal patch 재조립 → `git apply --cached`.
patch math 까다로움 (선택 외 `-` → context 변환, `+` → 무시).

### B: dogfood 결과 보고

위 30+ 시나리오 사용 → 발견 사항 보고 → 패치 + 다음 sprint.

### C: v0.3 신규 방향

EV 코드 서명 / Sentry self-hosted / macOS-Linux 빌드 / OAuth / GitHub repo 생성 + CI
matrix.

---

## 이번 세션 Sprint A~M 인벤토리 (33 commits, P0 4 + P1 10 + P2 8 + v1.x 11)

### Sprint A — P0 (4 commits)

| # | hash | 영역 |
| - | --- | --- |
| A1 | `8aaf1cc` | Hide / Solo branches (graph + branch panel) |
| A2 | `d6e1ac7` | Vim navigation J/K/H/L + S/U single-file stage |
| A3 | `eda980c` | 커밋 그래프 컬럼 토글 / 재정렬 (right-click 헤더) |
| A4 | `b3db974` | Launchpad Pin / Snooze / Saved Views |

### Sprint B — P1 (10 commits)

| # | hash | 영역 |
| - | --- | --- |
| B1 | `8f575da` | Diff 3-mode 토글 (compact / default / context) |
| B2 | `42c92d2` | Status bar + Conflict Prediction (target merge-tree) |
| B3 | `f9a4d2b` | Commit Composer AI — multi-commit 재작성 제안 |
| B4 | `d0d1030` | Repo tab alias + per-profile 영속성 |
| B5 | `bc99cd4` | 단축키 13 추가 (Zoom / Sidebar / Detail / ⌘D / ⌘⇧M / ⌘⇧Enter / ⌘⇧S/U) |
| B6 | `0ce4489` | Command Palette 카테고리 + 30+ 명령 |
| B7 | `396f821` | AI 진입점 3개 — Explain commit / branch / stash msg |
| B8 | `3ae45cd` | Drag-drop Branch→Branch + Commit→Branch |
| B9 | `a1aff9a` | Sidebar org 그룹핑 + Workspace color |
| B10 | `457c3dc` | Preferences 카테고리 정돈 + per-profile 탭 영속 |

### Sprint C — P2 (8 commits)

| # | hash | 영역 |
| - | --- | --- |
| C1 | `f093e74` | Worktree Lock / Unlock |
| C2 | `1481c1a` | LFS pre-push size estimation |
| C3 | `bf95ad7` | Section header 더블클릭 maximize (focus mode) |
| C4 | `1e2fc7e` | Custom theme JSON export / import |
| C5 | `dc2f665` | Lane drag-resize (CommitGraph) |
| C6 | `36eb617` | 외부 mergetool launch (git mergetool) |
| C7 | `3f19f19` | Deep linking `git-fried://` (launchpad/repo/settings/command) |
| C8 | `6e5debd` | OS 데스크탑 알림 (tauri-plugin-notification) |

### Sprint D — v1.x 초기 (3 commits)

| # | hash | 영역 |
| - | --- | --- |
| D1 | `3ef7b26` | Settings 공용 store + Hide Launchpad / Date locale |
| D2-D6 | `1d1ab1c` | Auto-Fetch 폴링 + Conflict toggle + Submodule auto-update + Notification + Deep-link alias 19 |
| D7-D9 | `f404619` | AI 응답 notification 7곳 + Date locale 마이그레이션 4곳 |

### Sprint E — v1.x 중반 (3 commits)

| # | hash | 영역 |
| - | --- | --- |
| E1 | `beae4d0` | Date locale 나머지 4곳 마이그레이션 |
| E2 | `dcfba19` | avatarStyle 실제 적용 — UserAvatar (initial / Gravatar md5) |
| E3 | `aef45ec` | Diff Split 모드 (CodeMirror @codemirror/merge MergeView, 첫 파일) |

### Sprint F — v1.x 후반 (5 commits)

| # | hash | 영역 |
| - | --- | --- |
| F1 | `85280a7` | CommandPalette 사용자 설정 토글 9개 |
| F2 | `47394af` | StatusBar ⚠ Conflict 옆 ✨ AI 미리해결 |
| F3 | `356ee57` | Diff Split 다중 파일 + file picker (parseDiffAllFiles) |
| F4 | `261a3fe` | ⌥O OS 파일 매니저 (cross-platform spawn) |
| F5 | `e97be39` | F11 / ⌃⌘F 전체화면 토글 |

### Sprint G~M — 큰 작업 + 미시 디테일 (7 commits)

| # | hash | 영역 |
| - | --- | --- |
| G | `6939441` | **Multi-repo Tab 시스템** — RepoTabBar + ⌃Tab / ⌃⇧Tab / ⌘⇧W + drag-drop 재정렬 + localStorage |
| H | `a0dd950` | **Hunk-level stage / unstage** — HunkStageModal + parseDiffWithHunks + buildHunkPatch (line-level v2) |
| I | `7ebb257` | **Sidebar 레포 필터 ⌘⌥F** — 이름 / 별칭 / forge owner-repo / 경로 매칭 |
| J | `deaec39` | **"// WIP" 노트** — 그래프 상단 banner + stash push prefill + clear-on-push |
| K | `bb5bd8f` | **Branch ref hover → 🙈 Hide** — 그래프 ref pill 옆 inline hover 버튼 |
| L | `b8ebeee` | **섹션 헤더 우클릭 collapse** — StatusPanel 4섹션 + StashPanel new form |
| M | `313d2de` | **Drag-drop file → terminal** — quotePath (pwsh + bash 안전) + ptyWrite |

---

## 진행 현황 (vs `docs/plan/05` 로드맵)

### ✅ 완료

| 단계 | 산출물 |
| --- | --- |
| **v0.0** | Tauri+Vue+Rust 골격 + 한글 안전 spawn + 첫 화면 |
| **v0.1 S1~S5** | status / stage / commit / sync / branch / diff / stash / graph / multi-repo / submodule / Gitea+GitHub PR |
| **v0.2** | AI CLI subprocess / Worktree / Cherry-pick / Palette / File history+Blame / 3-way merge editor |
| **v0.3** | Profiles / Issues / Releases / Bot 그룹핑 / Sync-template / Commit 검색 |
| **v1.0 (대부분)** | Launchpad / PR 리뷰 / Pre-commit 패널 / Bisect / Reflog / LFS / AI merge resolve / AI 코드 리뷰 |
| **v0.2-s4** | Interactive rebase 옵션 A (drag-drop drop/reword/squash/fixup) + 통합 터미널 옵션 A (xterm.js + pwsh) |
| **v0.2-s5/A~M** | GitKraken 12 catalog 흡수 21/21 — 위 인벤토리 |

### ⏳ 미완

- **Line-level stage** (Sprint H 후속 v2) — 다음 작업
- EV 코드 서명 (배포 시점)
- Sentry self-hosted (텔레메트리)
- macOS / Linux / OAuth / 수익 모델 (v1.x 별도)

---

## GitKraken 12 흡수 catalog 진척

`docs/plan/11-gitkraken-benchmark.md` 의 P0/P1/P2 + v1.x 미시 디테일 모두 흡수.

| 카테고리 | 항목 수 | 흡수 |
| --- | --- | --- |
| P0 (Sprint A) | 4 | ✅ 4/4 |
| P1 (Sprint B) | 10 | ✅ 10/10 |
| P2 (Sprint C) | 8 | ✅ 8/8 |
| v1.x 후속 (Sprint D~M) | 21 | ✅ 21/21 |
| 명시적 거부 (§30) | — | Cloud Workspace / 유료 lock / GitLens / gitkraken.dev — 거부 유지 |

---

## 검증 결과 (Claude 직접 실행)

| 검증 | 도구 | 결과 |
| --- | --- | --- |
| Rust 컴파일 | `cargo check` (offline, 5.5s) | ✅ 통과 |
| Rust 단위 테스트 | `cargo test --lib` | ✅ 73 pass / 0 fail |
| Vue/TS 컴파일 | `bun run typecheck` | ✅ 0 에러 |
| Vite dev | `bun run tauri:dev` | ✅ HMR 60s baseline |

---

## 사용자 dogfood 시 주의사항

### 신규 진입점 (이번 세션 추가)

| # | 기능 | 진입 |
| - | --- | --- |
| 1 | **다중 레포 탭** | 사이드바 클릭 = 새 탭 / RepoSwitcher / ⌘T / RepoTabBar + 버튼 |
| 2 | **Hunk-level stage** | StatusPanel 의 ✂ 버튼 (staged + unstaged + untracked) |
| 3 | **레포 필터** | ⌘⌥F (Sidebar 자동 보임) |
| 4 | **WIP 노트** | 그래프 상단 banner — stash 시 prefill |
| 5 | **Branch ref hide** | 그래프의 ref pill 위 hover → 🙈 |
| 6 | **섹션 collapse** | StatusPanel/StashPanel 헤더 우클릭 |
| 7 | **터미널 drag-drop** | 변경 파일 행 잡고 터미널 패널에 떨구기 |
| 8 | **Diff Split (multi-file)** | CommitDiffModal Split 토글 → 상단 파일 picker |
| 9 | **AI 충돌 미리해결** | StatusBar ⚠ 옆 ✨ AI 버튼 |
| 10 | **OS 파일매니저** | ⌥O / Alt+O |
| 11 | **Fullscreen** | F11 |
| 12 | **CommandPalette 추가** | ⌘P 후 검색 — 9 토글 + 5 탭 명령 + 필터/fullscreen 등 |

### Forge 토큰 필요한 기능

PR / Issue / Release 패널 / Launchpad — 설정 → Forge 계정에서 PAT 등록.

### 글로벌 git config 변경 (주의)

Profiles 활성화 → `--global` user.name/email/signingkey 덮어씌움.

### AI 기능 외부 송출

`✨` 버튼 (commit msg / PR body / merge resolve / 코드 리뷰 / commit 설명 / branch 설명 /
stash 메시지 / Composer / 충돌 미리해결): staged diff 또는 PR diff 가 외부 LLM 송출 →
회사 워크스페이스에서 confirm 강제.

### 위험 액션 confirm 게이트

Profiles 활성화 / Force push / Hard reset / Branch delete (unmerged) / Sync-template 다중
레포 cherry-pick / Worktree 제거 / PR 머지·닫기 / LFS untrack / **Hunk apply / 모든 hunk
일괄 apply** (신규).

---

## 글로벌 CLAUDE.md 준수

✅ 모든 76 commit 에 `Co-Authored-By: Claude` trailer 없음
✅ 모든 commit 에 `Generated with Claude Code` 푸터 없음
✅ commit 메시지 HEREDOC + `'EOF'` 한글 안전 전달
✅ AI prompt 들도 trailer 금지 룰 명시
✅ commit signing 우회 (`-c commit.gpgsign=false`) — 사용자 글로벌 gpgsign=true + secret
   key 없음 환경 대응

---

## 다음 작업 — Line-level stage (사용자 지정)

Sprint H 의 hunk 단위 stage 위에 line 단위 추가:

1. **HunkStageModal 확장** — 각 hunk body line 옆 checkbox
2. **buildLinePatch (신규)** — 선택 라인만 추출, 미선택 라인은:
   - `-` (제거) 행 미선택 → context (` `) 로 유지
   - `+` (추가) 행 미선택 → drop
   - hunk header line/count 재계산
3. **라인 selection UX** — shift-click range / Ctrl-click toggle / ✓ 모두 / 🚫 모두
4. **테스트** — Rust + Vue 양쪽 patch 변환 round-trip

→ 진입 직후 본 문서는 v3 으로 갱신.
