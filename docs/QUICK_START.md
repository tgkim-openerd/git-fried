# git-fried — 5분 시작 가이드

> **누구를 위해**: GitHub 개인 + Gitea 회사 듀얼 환경에서 한글 commit 메시지를 안전하게 다루고 싶은 풀스택 개발자.
>
> **언제 안 맞나**: macOS / Linux 전용 (v0.x Windows-only), Cloud workspace 필요, BYO LLM SaaS 선호 — 모두 의도적 거부.
>
> 이 문서를 5분 안에 읽고 첫 commit 까지 갈 수 있도록 설계했다. 더 깊은 내용은 [README.md](../README.md) / [docs/plan/](plan/).

---

## 1. 왜 만들었나 (1분)

### 기존 도구의 3가지 불편 (실측 기반, 사용자 본인 회사 6 sub-repo dogfood)

| 도구 | 불편 |
| ---- | ---- |
| **GitKraken** | Electron 무거움 (RAM 600MB+), Gitea 5년째 미해결, 유료 lock-in |
| **SourceTree** | Windows 한정 안정성, 한글 commit 깨짐 (CP949), Gitea 미지원 |
| **GitHub Desktop** | Branch 그래프 부재, Gitea 부재, multi-repo 약함 |

→ 모두 한국 회사 (Gitea + 한글) + 듀얼 환경 (개인 GitHub) 조합이 **첫 시도에 막힘**.

### git-fried 의 답

**Tauri light + Gitea first-class + 한글 안전 + AI subprocess**.
60MB RAM, 한 화면에 commit graph + status + diff, AI CLI 로 commit message / PR body / 충돌 해결.

---

## 2. 차별점 5가지 (1분)

5가지 모두 **기본 기능에 내장** — 별도 설정 없이 첫 실행부터 활성화.

| # | 차별점 | 어떻게 동작 | 사용자 인지 위치 |
| -: | ---- | ---- | ---- |
| 1 | **한글 안전** | UTF-8 강제 파이프 + NFC normalization + file-based commit body | commit 메시지 (한글 깨짐 0건) |
| 2 | **Gitea first-class** | PR / Workspaces / Launchpad / Issues / Releases 모두 Gitea 1순위 (GitHub 와 동일 기능) | Forge 카테고리 — Gitea/GitHub 토글 |
| 3 | **AI CLI subprocess** | Claude / Codex CLI 자체 호출 (자체 LLM 서버 없음 / BYOK 거부) — 외부 송출 시 명시 confirm | ✨ 버튼 (commit / PR body / 충돌 해결 / explain) |
| 4 | **Multi-profile** | 개인 ↔ 회사 1-click toggle (글로벌 git config 자동 전환) | 헤더 우측 ProfileSwitcher |
| 5 | **Tauri light** | RAM idle ~60MB (목표), 바이너리 ~15MB | 시스템 모니터 |

---

## 3. 설치 + 첫 commit (3분)

### 설치 (개발자 빌드, public release 전)

```bash
git clone https://github.com/tgkim/git-fried
cd git-fried
bun install
bun run tauri:dev      # HMR 개발 모드 (~1s)
# 또는
bun run tauri:build    # 프로덕션 (Windows MSI / NSIS)
```

요구: Windows 11 / Bun ≥ 1.1.0 / Rust ≥ 1.77.

### 첫 실행 흐름

1. **GitKraken 데이터 자동 import 안내** (데이터 있으면 toast 노출, Settings → 시작·마이그레이션 에서 진행)
2. **Settings → Forge 계정** 등록 (Gitea PAT / GitHub PAT — OS keychain 저장)
3. **Settings → 프로파일** 등록 (회사 / 개인, git user.name / email 분리)
4. **Sidebar → 레포 추가** (디렉토리 선택 또는 GitKraken 데이터 활용)
5. 활성 레포 클릭 → Commit Graph + Status Panel 표시

### 첫 commit (한글 메시지 안전 보장)

1. 파일 수정 → Status Panel 의 "Modified" 영역에 표시
2. 파일 클릭 → diff inline 확인
3. `S` 키 (또는 stage 버튼) — 단일 파일 stage
4. `⌘⇧Enter` — Stage all + Commit (메시지 입력창 자동 focus)
5. Conventional 모드 (default) 또는 free 모드 선택, 한글 메시지 작성
6. **✨ AI 버튼** — Claude / Codex 가 staged diff 분석 후 메시지 자동 생성 (외부 LLM 송출 명시 confirm)
7. `⌘Enter` — commit 실행

→ 첫 commit 메시지에서 한글이 그대로 보존된다 (CP949 mangle 0건).

---

## 4. 단축키 톱 10 (1분)

| 단축키 | 동작 |
| ---- | ---- |
| `⌘P` | Command Palette (60+ 명령) |
| `⌘⇧P` | Repo 빠른 전환 |
| `⌘F` | Commit graph 검색 |
| `⌘L` / `⌘⇧L` / `⌘⇧K` | Fetch / Pull / Push |
| `⌘⇧Enter` | Stage all + Commit |
| `⌘⇧M` | Commit 메시지창 focus |
| `⌘D` / `⌘⇧D` | Diff modal / Inline diff toggle |
| `J` / `K` | Commit graph 다음 / 이전 행 (Vim) |
| `⌘W` | 활성 모달 닫기 |
| `?` | 단축키 전체 도움말 |

전체 30+ 단축키는 `?` 키 또는 [HelpModal](../apps/desktop/src/components/HelpModal.vue).

---

## 5. 다음 단계 (선택)

- **DOGFOOD.md** — 사용자 본인 (tgkim) 회사 6 sub-repo dogfood 가이드
- **CHANGELOG.md `[Unreleased]`** — Sprint c25~c33 누적 변경 (40 commits)
- **docs/IMPLEMENTATION-STATUS.md** — 개발자용 구현 인벤토리 (161 IPC, 13 god comp 분리)
- **docs/plan/00-overview.md** — 26개 plan 문서 인덱스

---

## 6. 알려진 한계 (1분)

- **Windows-only** — macOS / Linux 는 v1.x ([plan/17](plan/17-v1.x-roadmap.md))
- **AI 기능은 `claude` / `codex` CLI 별도 설치** 필요 — 자체 LLM 인프라 없음
- **Cloud Workspace / Cloud Patches / Browser Extension / GitLens 미지원** — 의도적 거부 ([plan/01 §5](plan/01-why-and-positioning.md))
- **EV 인증서 미발급** — public release 시점 SmartScreen 경고 가능 (사용자 timing 대기)

---

> 막힌다면? [issues](https://github.com/tgkim/git-fried/issues) 또는 `?` 키로 단축키 전체 확인. AI 가 막혔다면 Settings → Forge 에서 토큰 검증.
