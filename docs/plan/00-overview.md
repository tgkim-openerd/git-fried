# git-fried — 종합 기획 (Overview)

작성일: 2026-04-26
저자: tgkim + Claude (Opus 4.7) 4-agent parallel synthesis
상태: v0 draft — 사용자 검토 필요

---

## 0. 30초 요약

> **Gitea 1급 시민 + 한글 안전 + Tauri 2 경량 + 멀티 레포·멀티 워크트리·서브모듈 핵심**.
> GitKraken을 베끼되, GitKraken이 5년째 안 고치는 Gitea 미지원·한국어 인코딩·클라우드 강제·Electron 무거움 4개 약점을 정확히 노린다. 1인 솔로 6개월에 v0.1(read-only + 일상 워크플로우)까지 도달 가능.

핵심 차별화 5축:
1. **Gitea = First-class** (PR / Workspaces / Launchpad 모두 Gitea 1순위 지원)
2. **한글 안전 입력 / 표시** (UTF-8 강제 파이프, file-based commit body, CP949 mangle 차단)
3. **Tauri 2 + Rust 하이브리드** (libgit2 + git CLI shell-out 양쪽, Electron 1/8 메모리)
4. **Worktree + Submodule 1급** (사용자 실측 기반 — 8개 worktree, 6/6 submodule 사용)
5. **Multi-repo 사이드바** (`frontend` + `frontend-admin` 듀얼 레포 패턴 직접 지원)

본 문서는 종합 인덱스이고, 상세는 다음 문서로 분리한다.

---

## 1. 문서 인덱스

| 파일 | 내용 |
|---|---|
| [00-overview.md](./00-overview.md) | 이 문서 — 30초 요약 + 인덱스 |
| [01-why-and-positioning.md](./01-why-and-positioning.md) | 왜 만드는가, 시장 위치, 차별화 |
| [02-user-workflow-evidence.md](./02-user-workflow-evidence.md) | 사용자 Git 사용 패턴 실측 |
| [03-feature-matrix.md](./03-feature-matrix.md) | GitKraken 대비 기능 매트릭스 + must/skip 결정 |
| [04-tech-architecture.md](./04-tech-architecture.md) | Tauri 2 + Rust + Vue 3 + Vite 스택 결정 + AI 통합 + 위험 |
| [05-roadmap-v0.1-v1.0.md](./05-roadmap-v0.1-v1.0.md) | 6 + 12 + 24개월 마일스톤 |
| [06-risks-and-pitfalls.md](./06-risks-and-pitfalls.md) | 한글 인코딩 / Windows / AI 페어 의존 / 1인 운영 |
| [07-design-decisions.md](./07-design-decisions.md) | UX 결정 (단축키 / 레이아웃 / 그래프 알고리즘) |
| [08-references.md](./08-references.md) | 참고 자료 / 벤치마크 / 오픈소스 학습 대상 |

---

## 2. 핵심 결정 요약 표

| 결정 항목 | 선택 | 대안 (포기) | 이유 (한 줄) |
| --- | --- | --- | --- |
| **앱 프레임워크** | Tauri 2 | Electron / Wails / Flutter | 30MB idle, Rust 백엔드, GitButler 검증 |
| **Git 라이브러리** | `git2-rs` + git CLI 하이브리드 | `gitoxide` 단독 / go-git / nodegit | read는 libgit2, write/heavy는 CLI |
| **프론트** | **Vue 3 + Vite + shadcn-vue + Pinia + Vue Query** | React 19 / Nuxt SPA / Svelte | 사용자 회사 50+ 레포 = Vue, Claude review 효율 최고 |
| **에디터/Diff** | CodeMirror 6 (+ merge view) | Monaco | Tauri 번들·메모리, framework-agnostic |
| **DB(메타)** | SQLite + FTS5 (sqlx) | Tantivy / Postgres | 임베드 / 1인 운영 |
| **인증 보관** | OS keychain (`tauri-plugin-keyring`) | Stronghold | Windows Credential Manager 직접 사용 |
| **그래프 렌더** | Canvas 2D (오프스크린 worker) + pvigier "straight-line lane" | SVG / WebGL | 1만+ 커밋도 안정 |
| **API codegen** | `@hey-api/openapi-ts` (Gitea), `@octokit/types` (GitHub) | 자체 codegen | 둘 다 Active 유지 |
| **AI 통합** | **Claude CLI + Codex CLI subprocess 위임** | 자체 BYOK / Ollama 자체 통합 | 사용자 본인 인증 환경 활용, 토큰·rate limit 외부 위임 |
| **백엔드 작성 모델** | **AI 페어 (Claude/Codex) — 사용자 review** | Rust 학습 후 직접 | 사용자 Rust 경험 0, 학습 시간 절약 |
| **자동 업데이트** | Tauri updater + GitHub Releases | Squirrel / Sparkle | 표준 / 무료 호스팅 |
| **배포 서명 (Win)** | OV 인증서 (v0.x) → EV (v1+) | EV from day 1 | 비용 deferral |
| **타깃 OS 우선순위** | **Windows-only (v0.x ~ v1.0)**, macOS / Linux v1.x | 동시 출시 | 사용자 본인 Win11 환경, 1인 운영 부담 deferral |
| **수익 모델** | **차후 검토 (v1.x+)** — 코어는 OSS 무료 | 처음부터 유료 / SaaS | 결정 deferral, MIT 잠정 |
| **이름** | **git-fried** (확정) | gitsoy / kraken-killer | 사용자 결정 |

---

## 3. 18개월 로드맵 (한 페이지)

```
v0.0 (M0~M1)  골격 + Hello World  (Windows-only)
  - Tauri 2 + Vue 3 + Vite + shadcn-vue + Pinia 셸
  - sqlite + keychain plumbing
  - 한 레포 add → log 표 → diff 표시 (read-only)
  - Rust 학습 sprint 없음 — Claude/Codex 페어로 즉시 시작

v0.1 (M2~M6)  "쓰레기 버전이지만 실사용 가능"  ★ 6개월 목표
  - Multi-repo 사이드바 (rf 14 + 01.Projects 50 모두 등록)
  - Commit log graph (lane straight-line)
  - status / stage / commit / push / pull / fetch
  - branch list / switch / create / delete (no rebase yet)
  - stash 매니저 (list / apply / drop)
  - submodule init/update + 상태 표시
  - GitHub PR list (read), Gitea PR list (read) — PAT 인증
  - 한글 file-based commit body + UTF-8 강제 파이프

v0.2 (M7~M9)  Power user + AI 페어 통합
  - Interactive rebase (drag-drop reorder, squash, fixup)
  - 3-way merge conflict editor (CodeMirror)
  - Worktree 매니저 (create / list / remove + 디스크 사용량)
  - Cherry-pick (단일 + 다중 레포 동시)
  - Command palette (⌘P)
  - File history / blame
  - GPG signing 토글 + 상태 인디케이터
  - **AI commit message + AI PR body** (Claude CLI / Codex CLI subprocess)

v0.3 (M10~M12)  검색 / Profiles / sync-template
  - SQLite FTS5 검색 (commit / file / branch, 한글 토크나이저)
  - Profiles (개인 GitHub ↔ 회사 Gitea 1-click 토글, SSH 키 포함)
  - Sync-template 어시스턴트 (template_work-dir → N개 레포 cherry-pick UI)
  - Issues / Releases / Bot PR 그룹핑

v1.0 (M13~M18)  안정화 + Pre-commit 패널 + Launchpad
  - Pre-commit hook 결과 패널 (lefthook/husky stream)
  - PR 리뷰 (코멘트 / Approve / Request changes, Gitea+GitHub)
  - Launchpad (워크스페이스 모든 PR/Issue/CI 통합 보드)
  - AI merge conflict 도움 / AI 코드 리뷰 (Claude/Codex CLI)
  - EV 코드 서명 (Win)
  - Bisect / Reflog (마이그레이션 유인)

v1.x (M19+)  플랫폼 확장
  - macOS (Apple Developer + notarization)
  - Linux (AppImage + flatpak)
  - 수익 모델 검토 (OSS + 팀 기능 유료 후보)
  - OAuth (Gitea / GitHub)
```

---

## 4. 위험 Top 5 (요약)

1. **AI 페어 의존 + 컨텍스트 관리** — Claude/Codex 가 본 프로젝트의 한글/Gitea 표준 대신 일반 OSS 패턴을 차용할 위험. 완화: `04` §3 §11 의 표준 함수 강제 + PR review checklist + 회귀 테스트 우선.
2. **Windows 한글 인코딩** — Git Bash CP949 mangle 사례 다수 확인. 완화: file-based commit body, `core.quotepath=false` 자동 주입, child_process 바이트 수준 디코딩.
3. **`safe.directory` 지옥** — 사용자 환경에서 다수 레포가 unsafe 거부됨. 완화: 워크스페이스 추가 시 자동 등록 + 안내.
4. **libgit2 거대 레포 성능 저하** — clone/blame 케이스 5~20배 느림. 완화: heavy 작업은 git CLI shell-out 분기.
5. **1인 운영 burnout** — 앱 + Windows 인증서 + 자동 업데이트 + 사용자 지원. 완화: v0.x는 OSS 베타로 출시, GitHub Issues 만 채널, 수익화 v1.x+ deferral, 본업 시간 침범 금지.

---

## 5. 결정 완료 (2026-04-26)

5가지 미결정 모두 답변 받음. 본 계획서 v1 으로 확정.

| # | 항목 | 결정 |
| - | --- | --- |
| 1 | Rust 경험 수준 | **없음** — Claude/Codex 페어 프로그래밍으로 진행 |
| 2 | macOS 우선순위 | **Windows 우선** — macOS / Linux 는 v1.x 로 deferral |
| 3 | 수익 모델 | **차후 검토** — v1.x 까지 무료, 라이선스 MIT 잠정 |
| 4 | AI 기능 | **Claude CLI / Codex CLI subprocess 위임** — 자체 LLM 인프라 없음 |
| 5 | 이름 | **git-fried** 최종 |

영향 받은 문서: `00 §2 §3 §4`, `03 §5`, `04 §1 §10 §11`, `05 v0.0 v0.2 v1.x`, `06 R1 R7 R8 R9 + 신규 R13`, `07 §11 (AI 패널)`, `README`.

---

## 6. 즉시 실행 가능한 다음 한 걸음

```bash
cd d:/01.Work/08.rf/git-fried
# 1. Tauri 2 + Vue 3 + Vite 프로젝트 init (한 명령)
bun create tauri-app@latest --template vue-ts
# 2. shadcn-vue 셋업 (https://www.shadcn-vue.com/docs/installation/vite)
bunx shadcn-vue@latest init
# 3. Pinia + Vue Query + Tailwind v4 추가
bun add pinia @tanstack/vue-query
bun add -D tailwindcss@next @tailwindcss/vite
# 4. unplugin auto-import / vue-components / vue-router 추가
bun add -D unplugin-auto-import unplugin-vue-components unplugin-vue-router
# 5. Rust deps: git2 + sqlx + reqwest + encoding_rs + keyring + tokio
# 6. README + GitHub remote 연결, MIT 라이선스
# 7. 첫 PR: "add: Tauri 2 + Vue 3 + sqlite skeleton + 한글 spawn 표준"
```

자세한 v0.0 (M0~M1) 작업 분해는 `05-roadmap` 참조.
