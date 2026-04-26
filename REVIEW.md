# REVIEW — git-fried 진행 현황

작성: 2026-04-26 (단일 세션, 누적 25 commits)
대상: tgkim — 시간 될 때 dogfood + 다음 sprint 결정

---

## 30초 요약

**v0.0 → v1.0 거의 전부** (Interactive rebase / 통합 터미널 / EV 서명 / macOS+Linux 외) 완료. 모든 빌드/테스트는 Claude 직접 검증.

```text
25 commits 누적
~19,500 라인 추가
99 파일 변경
70+ IPC 명령어
Rust 단위 테스트: 32+ (한글 round-trip / 회귀 차단 모두 ✅)
```

---

## 진행 현황 (vs `docs/plan/05` 로드맵)

### ✅ 완료 (v0.0 → v1.0 핵심 기능 전부)

| 단계 | 계획 | 산출물 |
| --- | --- | --- |
| **v0.0** | 5주 | Tauri+Vue+Rust 골격 + 한글 안전 spawn + 첫 화면 |
| **v0.1 S1~S5** | 5개월 | status/stage/commit/sync/branch/diff/stash/graph/multi-repo/submodule/Gitea+GitHub PR |
| **v0.2** | 3개월 | AI CLI subprocess / Worktree / Cherry-pick / Palette / File history+Blame / 3-way merge editor |
| **v0.3** | 3개월 | Profiles / Issues / Releases / Bot 그룹핑 / Sync-template / Commit 검색 |
| **v1.0 (대부분)** | 6개월 | Launchpad / PR 리뷰 / Pre-commit 패널 / Bisect / Reflog / LFS / AI merge resolve / AI 코드 리뷰 |

### ⏳ 미완 (다음 세션 후보)

- Interactive rebase (drag-drop reorder/squash/fixup) — 사용자 안 씀, 큰 작업
- 통합 터미널 (xterm.js — OS 위임 우선이라 후순위)
- EV 코드 서명 (배포 시점에)
- Sentry self-hosted (텔레메트리)
- v1.x 별도: macOS / Linux / OAuth / 수익 모델

---

## 이번 세션 신규 기능 dogfood 가이드 (15개)

### 헤더 & 글로벌

| # | 기능 | 위치 | 시나리오 |
| - | --- | --- | --- |
| 1 | **Profiles 토글** ⭐ | 헤더 좌측 👤▾ | 설정에서 추가 → 토글 → 글로벌 git config 자동 변경 |
| 2 | **Launchpad** ⭐⭐ | 헤더 'Launchpad' | 워크스페이스 모든 레포 PR 통합 보드 (사람/봇 분리) |
| 3 | **Command Palette** | ⌘P | 9개 명령 (홈/설정/sync template/bisect/reflog/...) |

### 우측 탭 패널 (7개)

| # | 탭 | 기능 |
| - | -- | --- |
| 4 | 변경 | Status + 📜 file history + 해결 (3-way merge) |
| 5 | 브랜치 | list / 더블클릭 switch / 새 / 삭제 |
| 6 | Stash | push / apply / pop / drop / show diff |
| 7 | Sub | submodule init/update/sync |
| 8 | **LFS** ⭐ | track / untrack / fetch / pull / prune (사용자 회사 6/6) |
| 9 | **PR** ⭐⭐ | sub-tab (PR / Issue / Release) + 봇 그룹핑 |
| 10 | WT | worktree manager (AI agent 자동 인식) |

### 모달 (Command Palette / Tab 에서 trigger)

| # | 기능 | 트리거 |
| - | --- | --- |
| 11 | **PR 상세 + 리뷰** ⭐⭐ | PR 탭 클릭 → 모달 (Approve / Request changes / Comment / 머지 / 닫기) + ✨ AI 리뷰 |
| 12 | **3-way merge editor** ⭐ | 변경 탭 Conflicted 행 "해결" → 3 패널 (ours/result/theirs) + ✨ AI 추천 |
| 13 | **File history + Blame** | 변경 탭 Modified 행 📜 |
| 14 | **Sync-template** ⭐⭐ | ⌘P "sync" — N개 레포 동시 cherry-pick |
| 15 | **Bisect / Reflog** | ⌘P "bisect" / "reflog" |

### 기타

| # | 기능 | 위치 |
| - | --- | --- |
| 16 | **AI commit message** | Commit input ✨ AI |
| 17 | **AI PR body** (코드 내장, UI 추가는 v1.x) | PR 생성 화면 (TBD) |
| 18 | **Pre-commit hook 결과 패널** | commit 실패 시 inline (no-verify 재시도 가이드) |
| 19 | **Commit graph 검색** | 그래프 헤더 🔍 또는 ⌘F |
| 20 | **한국어 에러 가이드** | pull/push 실패 시 7가지 패턴 자동 진단 |

---

## 검증 결과 (Claude 직접 실행)

| 검증 | 도구 | 결과 |
| --- | --- | --- |
| Rust 컴파일 | `cargo check` | ✅ 통과 |
| Rust lint | `cargo clippy --all-targets -- -D warnings` | ✅ 0 에러 |
| Rust 단위 테스트 | `cargo test` (PowerShell) | ✅ 32+/32+ |
| Vue/TS 컴파일 | `bun run typecheck` | ✅ 0 에러 |
| Vite dev | `bun run dev` | ✅ 1초 ready |

---

## 이번 세션 commit 인벤토리 (25개)

| # | hash | 영역 |
| -- | --- | --- |
| 1 | `6060194` | 종합 기획서 v1 |
| 2 | `079c429` | v0.1 S1: status/stage/commit/sync/diff |
| 3 | `c51a617` | v0.1 S2: branch/stash/reset/diff viewer |
| 4 | `03531d2` | v0.1 S3: commit graph (pvigier) |
| 5 | `f6b3bc7` | v0.1 S4: submodule + 일괄 fetch + 듀얼 |
| 6 | `7904cd0` | v0.1 S5: Forge (Gitea+GitHub) + keyring |
| 7 | `4f22bf2` | v0.2 stretch: AI / Worktree / Cherry-pick / Palette |
| 8 | `fba7799` | docs: REVIEW + DOGFOOD |
| 9 | `949be3f` | fix dogfood-1: 빌드 통과 + 28 테스트 |
| 10 | `bd586f9` | fix dogfood-2: typecheck 0 |
| 11 | `339da2a` | fix UX: 에러 표시 통합 + 한국어 가이드 |
| 12 | `bf3f710` | v0.3: Profiles |
| 13 | `f10e78c` | v0.2: File history + Blame |
| 14 | `e8a65a2` | v0.3: Issues + Releases + Bot 그룹핑 |
| 15 | `a255892` | v0.3: Sync-template |
| 16 | `2f9c9a9` | v0.3: Commit graph 검색 |
| 17 | `324cf67` | v1.0: Launchpad |
| 18 | `6377599` | docs: REVIEW v0.3+v1.0 일부 |
| 19 | `e2de2dd` | v1.0: PR 리뷰 |
| 20 | `add5f75` | v1.0: Pre-commit 패널 |
| 21 | `281138b` | v0.2: 3-way merge editor |
| 22 | `f6d539b` | v1.0: AI merge resolve |
| 23 | `0c48f45` | v1.0: Bisect + Reflog |
| 24 | `05ac6cc` | v1.0: LFS 패널 |
| 25 | `395bedf` | v1.0: AI 코드 리뷰 |

---

## 사용자 dogfood 시 주의사항

### Forge 토큰 필요한 기능
- PR / Issue / Release 패널, Launchpad — 설정 → Forge 계정에서 PAT 등록

### 글로벌 git config 변경 (주의)
- Profiles 활성화 → `--global` user.name/email/signingkey 덮어씌움

### AI 기능 외부 송출
- ✨ AI 버튼 (commit msg / PR body / merge resolve / 코드 리뷰): staged diff 또는 PR diff 가 외부 LLM 송출
- 회사 워크스페이스에서 confirm 강제
- secret 마스킹 (PAT/AWS/주민번호) 사전 처리

### 위험 액션 confirm 게이트
- Profiles 활성화 / Force push / Hard reset / Branch delete (unmerged) /
  Sync-template 다중 레포 cherry-pick / Worktree 제거 / PR 머지 / PR 닫기 / LFS untrack

---

## 글로벌 CLAUDE.md 준수

✅ 모든 25 commit에 `Co-Authored-By: Claude` trailer 없음
✅ 모든 commit에 `Generated with Claude Code` 푸터 없음
✅ commit 메시지 HEREDOC + `'EOF'` 한글 안전 전달
✅ AI prompt 들도 trailer 금지 룰 명시 (commit_message / pr_body / code_review)

---

## 다음 세션 권장

### 옵션 A: dogfood 결과 보고 (★ 권장)
사용자가 위 20+ 시나리오 사용 → 발견 사항 일괄 보고 → 패치 + 다음 sprint.

### 옵션 B: 미완 기능 마저
- Interactive rebase (drag-drop)
- 통합 터미널
- AI PR body UI 통합 (현재 IPC 만 있음, PR 생성 화면 미구현)
- macOS / Linux 빌드 (v1.x)

### 옵션 C: GitHub repo 생성 + push
```powershell
gh repo create tgkim/git-fried --public --source=. --remote=origin --push
```
CI 첫 빌드 (Windows-only matrix) 결과 확인.

### 옵션 D: 안정화 단계
- Tauri auto-updater plugin 통합
- Sentry self-hosted
- OV 코드 서명 인증서 ($100/yr) 도입
- e2e 테스트 추가

---

원하는 방향 알려주시거나, 시간 될 때 위 시나리오 사용해보고 발견 사항 모아서 한 번에 주시면 됩니다.
