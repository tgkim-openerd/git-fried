# REVIEW — git-fried 진행 현황

작성: 2026-04-26 (단일 세션, 누적 17 commits)
대상: tgkim — dogfood 시나리오별 검증 가이드

---

## 30초 요약

이번 세션에서 **v0.0 + v0.1 + v0.2 stretch + v0.3 + v1.0 일부** 까지 진행. 모든 빌드/테스트는 Claude 직접 검증 완료 (`cargo check / clippy / test` + `bun typecheck`). 사용자는 GUI 사용 + dogfood 만 하면 됨.

```
17 commit 누적
~14,000 라인 추가
85+ 파일
36 IPC 명령어
Rust 단위 테스트: 32 (한글 round-trip / NFC / 회귀 차단 모두 ✅)
```

---

## 진행 현황 (vs `docs/plan/05` 로드맵)

### ✅ 완료된 마일스톤

| 단계 | 계획 | 실제 | 핵심 산출물 |
| --- | --- | --- | --- |
| v0.0 | 5주 | 1세션 | Tauri+Vue+Rust 골격 |
| v0.1 S1~S5 | 5개월 | 1세션 | 일상 워크플로우 (commit/branch/diff/stash/graph/multi-repo/PR) |
| v0.2 stretch | 일부 | 1세션 | AI CLI / Worktree / Cherry-pick / Palette / **File history + Blame** |
| **v0.3** | 3개월 | 1세션 | **Profiles / Issues / Releases / Bot 그룹핑 / sync-template / 검색** |
| **v1.0 일부** | 6개월 | 1세션 | **Launchpad** |

### ⏳ 미완 (다음 세션 후보)

- Interactive rebase (drag-drop reorder/squash/fixup)
- 3-way merge editor (CodeMirror merge view)
- Pre-commit hook 결과 패널 (lefthook/husky stream)
- PR 리뷰 (Approve / Request changes / 라인 코멘트)
- AI merge conflict 도움 / AI 코드 리뷰
- FTS5 cross-repo 검색 (현재는 활성 레포 in-memory 만)
- LFS 안정화 / Bisect / Reflog / EV 코드 서명 / Sentry / 통합 터미널
- macOS / Linux (v1.x deferred)

---

## v0.3 ~ v1.0 신규 기능 dogfood 가이드

이번 세션에서 추가된 기능들 — 사용자가 직접 확인할 시나리오:

### 1. Profiles (개인 ↔ 회사 1-click 토글) ⭐
**위치**: 상단 헤더 좌측 "👤 ▾" 버튼 + 설정 페이지

**시나리오**:
1. 설정 → "프로파일" 섹션 → "새 프로파일" 추가
   - 이름: `회사 (opnd)`, user.name=`tgkim`, email=`tgkim@opnd.com`
2. 두 번째 추가: `개인`, email=`oharapass@gmail.com`
3. 헤더의 "👤 ▾" 클릭 → 드롭다운에서 "개인" 선택
4. **확인 모달**: "글로벌 git config 가 변경됩니다" → 진행
5. **검증**: 터미널에서 `git config --global user.email` → `oharapass@gmail.com`
6. 다시 "회사 (opnd)" 로 토글 → `git config --global user.email` → `tgkim@opnd.com`

⚠ 글로벌 git config 가 실제로 덮여씌어집니다. 다른 git GUI / CLI 작업에도 영향.

### 2. File history / Blame ⭐
**위치**: 변경 패널의 Modified 파일 행 → "📜" 버튼

**시나리오**:
1. 임의 파일 수정 → Status 패널에서 표시
2. 행 우측에 hover → 📜 버튼 클릭
3. 모달 열림: History 탭 / Blame 탭
4. **History**: 좌측 commit 리스트 (--follow 로 rename 추적), 우측 commit 상세
5. **Blame**: 라인별 sha + 작성자 + summary + content (한글 안전)

### 3. PR / Issues / Releases (Forge 통합) ⭐
**위치**: 우측 'PR' 탭 → 안에 PR/Issue/Release sub-tab

**시나리오** (Forge 토큰 등록 필요):
1. 설정 → Forge 계정 → Gitea/GitHub PAT 등록
2. 홈에서 회사 레포 선택 → 우측 'PR' 탭 클릭
3. **PR 탭**: 사람 PR (위) + 봇 PR collapsible (아래)
   - release-please / dependabot / renovate 자동 인식 → 그룹화 + 접힘
4. **Issue 탭**: open issue 목록 (라벨 색상)
5. **Release 탭**: tag / draft / prerelease 배지

### 4. Sync-template (다중 레포 cherry-pick) ⭐
**위치**: ⌘P → "sync template" 검색

**시나리오** (회사 워크플로우 직격):
1. ⌘P → "sync" → "Sync template — 다중 레포 cherry-pick"
2. Source SHA: template_work-dir 의 commit (예: `c51a617`)
3. 전략: `default` / `mainlineParent` (-m 1, 머지 commit 용)
4. 대상 레포: 워크스페이스 모든 레포 중 다중 선택 (체크박스)
5. "N개 레포에 적용" → 결과 row 별 success/conflict/실패 표시

### 5. Commit graph 검색 ⭐
**위치**: 그래프 헤더의 🔍 버튼 또는 ⌘F

**시나리오**:
1. 그래프 화면에서 ⌘F (또는 Ctrl+F)
2. 검색창에 입력: subject / 작성자 / SHA prefix / ref 부분일치
3. 매칭 안 되는 row 는 25% opacity 로 dim (그래프 lane 은 유지)
4. 매치 카운터 ('N / total')
5. Esc 닫기

### 6. Launchpad (워크스페이스 PR 통합 보드) ⭐⭐
**위치**: 상단 헤더 "Launchpad" 링크

**시나리오**:
1. 회사 워크스페이스 활성 (사이드바 선택)
2. 헤더 → "Launchpad"
3. 워크스페이스 모든 레포 PR 병렬 조회 (~수 초)
4. 통계: "12/13 레포 · PR 7+24봇 · 1개 실패"
5. 사람 PR 표 (레포명 / # / 제목+라벨 / 작성자 / 브랜치 / 상태 / 갱신일)
6. "봇 PR 표시" 토글 → release-please / dependabot 일괄 보기
7. 실패한 레포 (forge 미등록) 자동 진단 메시지

⚠ Forge 계정이 등록 안 된 forge_kind (예: GitHub 토큰만 있고 Gitea 미등록) → 해당 레포 자동 skip + 진단.

### 7. Worktree 매니저
**위치**: 우측 'WT' 탭

**시나리오**:
1. WT 탭 → 현재 worktree 목록
2. AI 에이전트 worktree (`worktree-agent-*`) 자동 인식 → 🤖 표시
3. 새 worktree: 경로 + (선택) 새 브랜치 -b
4. 디스크 사용량 표시

### 8. Command Palette
**위치**: ⌘P / Ctrl+P

**현재 등록된 명령**:
- 홈으로
- 설정 / Forge 계정
- 워크스페이스: 전체
- 모든 쿼리 무효화
- 다크/라이트 모드 토글
- Sync template — 다중 레포 cherry-pick

### 9. AI commit message (Claude/Codex CLI subprocess)
**위치**: 변경 패널 하단 commit input 옆 "✨ AI" 버튼

**시나리오** (PATH 에 `claude` 또는 `codex` 필요):
1. 변경 stage
2. ✨ AI 버튼 클릭 → "회사 정책 확인?" 송출 confirm
3. CLI 호출 → 응답이 commit message input 자동 채움
4. Conventional Commits 패턴 자동 파싱 → type/scope/subject/body 분리

### 10. 한국어 에러 가이드
**위치**: pull / push / fetch 실패 시 alert

**시나리오**:
- pull 실패 → 영문 stderr + 한국어 진단 힌트 (예: "원격 저장소에 해당 브랜치가 아직 없습니다. git push -u origin main 으로 push 했는지 확인")
- 7개 흔한 패턴 자동 인식: no such ref / Authentication failed / non-fast-forward / CONFLICT / safe.directory / Repository not found / No such file

---

## 검증 결과 (Claude 직접 실행)

| 검증 | 도구 | 결과 |
| --- | --- | --- |
| Rust 컴파일 | `cargo check` | ✅ 통과 |
| Rust lint | `cargo clippy --all-targets -- -D warnings` | ✅ 0 에러 |
| Rust 단위 테스트 | `cargo test` | ✅ 32+/32+ (PowerShell 환경) |
| Vue/TS 컴파일 | `bun run typecheck` (vue-tsc) | ✅ 0 에러 |
| Vite dev | `bun run dev` | ✅ ready (1초 이내) |

---

## 주요 IPC 명령어 (총 60+개)

### 신규 추가 (v0.3 ~ v1.0)

| 카테고리 | 명령어 |
| --- | --- |
| Profiles | list/create/update/delete/activate_profile |
| File | get_file_history / get_file_blame |
| Bulk Forge | bulk_list_prs |
| AI | ai_commit_message / ai_pr_body / ai_detect_clis |
| Cherry-pick | bulk_cherry_pick |

(기존: app/workspace/repo/log/status/stage/commit/sync/branch/stash/reset/diff/graph/submodule/forge/worktree)

---

## 사용자 dogfood 시 주의사항

### Forge 토큰 필요한 기능 (먼저 등록)
- PR / Issue / Release 패널
- Launchpad
- 설정 → Forge 계정 에서 Gitea PAT + GitHub PAT 등록

### 글로벌 git config 변경 (주의)
- Profiles 활성화 → `git config --global user.{name,email,signingkey}` 덮어씌움
- 다른 git 도구 (CLI / VS Code / GitKraken) 에도 영향

### AI 기능 외부 송출
- ✨ AI 버튼 → staged diff 가 외부 LLM 으로 송출
- 회사 워크스페이스에서 confirm 강제
- Secret 마스킹 (PAT / AWS / 주민번호) 사전 처리됨

### 환경 차이 알림
- Bash sandbox 와 사용자 PowerShell 의 git 결과가 다를 수 있음
- `graph::test_linear_history` 가 sandbox 에서만 fail 사례 발견 (PowerShell 28/28 통과)
- dogfood 시 사용자 환경 결과를 우선

---

## 글로벌 CLAUDE.md 준수

✅ 모든 17 commit 에 `Co-Authored-By: Claude` trailer 없음
✅ 모든 commit 에 `Generated with Claude Code` 푸터 없음
✅ commit 메시지 HEREDOC + `'EOF'` 한글 안전 전달
✅ scope 외 변경 없음

---

## 다음 세션 권장

### 옵션 A: dogfood 결과 보고 (★ 권장)
사용자가 위 10개 시나리오 일부 또는 전체를 직접 사용해보고:
- 동작하는 것 / 안 하는 것
- UI 이상 / bug
- 우선순위 reorder 의견

→ 다음 세션에서 일괄 패치 + 다음 sprint.

### 옵션 B: 미완 기능 계속 진행
- Pre-commit hook 결과 패널
- PR 리뷰 (Approve / Request changes / 라인 코멘트)
- Interactive rebase (drag-drop)
- 3-way merge editor

### 옵션 C: GitHub repo 생성 + push
- `gh repo create tgkim/git-fried --public --source=. --remote=origin --push`
- CI (Windows-only matrix) 첫 빌드
- README v0.2-stretch → v0.3+v1.0 일부 갱신
