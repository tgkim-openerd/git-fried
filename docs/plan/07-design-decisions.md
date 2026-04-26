# 07. 디자인 결정 — UX / 단축키 / 레이아웃

## 1. 핵심 UX 원칙

1. **로컬 우선**: 클라우드 로그인 없이 100% 동작. Cloud Workspaces / Cloud Patches 같은 강제 동기화 없음.
2. **키보드 first**: 모든 액션은 ⌘P palette + 단축키로 가능. 마우스는 보조.
3. **상태 가시화**: GPG 미서명 / unsafe.directory / pre-commit 실패 / 한글 인코딩 위험은 즉시 시각 표시.
4. **회사 vs 개인 컨텍스트 명시**: Profiles 토글 + 사이드바 색상 코딩 (회사=회색, 개인=청록 같은).
5. **읽기는 즉시, 쓰기는 확인**: status/log는 < 200ms, push/rebase/reset은 명확한 confirm dialog.
6. **위험 액션은 두 단계**: force-push, hard reset, branch delete (unmerged) 는 "Type repo name to confirm" 패턴.
7. **한국어 1급**: 디폴트 언어 한국어, 영어는 v0.3에 추가.

## 2. 레이아웃 (메인 윈도)

```
┌─────────────────────────────────────────────────────────────┐
│ [git-fried]  [profile▼ tgkim/personal]            [⌘P] [⚙]   │  ← 타이틀 바 (drag 영역)
├─────────────┬───────────────────────────────────────────────┤
│ Workspaces  │   ┌─ Tabs: [Commits] [Branches] [PRs] [...]   │
│ ───────────│   │                                            │
│ ▼ rf (개인) │   │ ╭──────────────╮ ╭─────────────────────╮  │
│   ● mock-fr│   │ │ Commit graph │ │ Selected commit     │  │
│     git-fr │   │ │ + log table  │ │  - message          │  │
│     albi   │   │ │              │ │  - author / date    │  │
│   ...      │   │ │              │ │  - file tree        │  │
│ ▼ opnd     │   │ │              │ │  - diff (CodeMirror)│  │
│   ● ankent │   │ │              │ │                     │  │
│     petc.. │   │ ╰──────────────╯ ╰─────────────────────╯  │
│   ...      │   │                                            │
├─────────────┤   ├────────────────────────────────────────────┤
│ Status bar  │   │ Working changes (stage/unstage panel)      │
└─────────────┴───┴────────────────────────────────────────────┘
```

**왼쪽 사이드바**:
- Workspaces (rf / opnd 등)
- 각 워크스페이스 안에 레포 리스트
- Pin / 색상 / 미해결 PR 수 배지
- 현재 활성 레포는 ● 마크
- 우클릭: open in Explorer / open in VSCode / open terminal here

**메인 패널** (탭):
- **Commits** (디폴트): 그래프 + 로그 + 선택 커밋 상세
- **Branches**: 로컬 + 원격 트리, 머지/upstream 상태
- **PRs**: 현재 레포 또는 워크스페이스 전체 (Launchpad 모드)
- **Stash**: 리스트 + 디프 프리뷰
- **Submodules**: 트리 + 상태
- **Worktrees**: 리스트 + 디스크 사용량
- **Settings (per-repo)**: remote / hooks / .gitignore

**하단**:
- Status bar: 브랜치 / ahead·behind / dirty / 인코딩 / 서명 상태
- Working changes 패널: 변경 파일 + stage 버튼 + commit message input

## 3. 단축키 (디폴트)

GitKraken/Sourcetree 사용자 근육 기억 활용:

| 단축키 | 액션 |
|---|---|
| ⌘P / Ctrl+P | Command Palette |
| ⌘Shift+P | Quick switch repo |
| ⌘Shift+B | Quick switch branch |
| ⌘Enter | Commit (focused on message input) |
| ⌘L / Ctrl+L | Fetch all |
| ⌘Shift+L | Pull |
| ⌘Shift+K | Push |
| ⌘B / Ctrl+B | New branch |
| ⌘F | Search (current repo) |
| ⌘Shift+F | Search (all repos) |
| ⌘Shift+H | File history (selected file) |
| ⌘Shift+M | Open merge editor (current conflict) |
| J / K | Down / Up (commit list nav) |
| Enter | Open commit detail |
| ⌘1~⌘5 | Switch tab (Commits/Branches/PRs/...) |
| ⌘, | Settings |
| ⌘W | Close current repo |

## 4. 그래프 알고리즘 (요약)

**pvigier "Straight branches"** 변형 — GitKraken 스타일.

```
원리:
- 각 커밋의 자식 수 + 부모 수로 lane 결정
- 브랜치가 끝나도 lane 비어있는 채로 둠 (다른 lane shift 안 함)
- 머지 커밋의 두 번째 부모는 새 lane 으로 → 곧은 직선
- 색상은 브랜치 ref 기준으로 stable hash → 같은 브랜치는 항상 같은 색

렌더:
- Canvas 2D
- row 높이 24px 고정
- viewport 안의 ~50 rows 만 그림 (가상 스크롤)
- 각 lane 폭 16px
- 노드 원 6px, 엣지 두께 2px
```

상세 알고리즘: pvigier 블로그 참조 (`08-references.md`).

## 5. 한글 입력 / 표시 UX

### 커밋 메시지 입력
- 디폴트는 textarea (한 줄 subject + 본문 분리)
- 길어지면 자동으로 file-based commit (사용자 모름)
- 표시: subject 만 1줄, 클릭/hover로 본문 펼침
- 글자 수 카운터 (subject 50자 권장 표시, 강제는 X)

### Conventional Commit Builder
```
[type ▼ feat] [scope (optional)] [! breaking?]
[Subject ───────────────────────────────────]
[Body ───────────────────────────────────────]
[BREAKING CHANGE: ───────────────────────────]
[Closes/Refs: #123 ──────────────────────────]
```
- type 드롭다운: feat / fix / chore / refactor / docs / perf / test / ci / build / style / revert
- 사용자 자주 쓴 scope 자동완성
- 출력 미리보기 항상 표시

### 한글 안전 인디케이터
- 인코딩 의심 (CP949 / GBK 추정) 시 노란 배지
- 클릭 시 "현재 인코딩: UTF-8 / 변환 가능" 메뉴

## 6. PR 화면

### 리스트 (Launchpad 모드)
```
┌──── My PRs (Workspace: opnd) ──────────────┐
│ Filter: [Open] [Mine] [Draft] [Bot]        │
│                                            │
│ ─────────────────────────────────────────── │
│ ankentrip/frontend          #234 ● open    │
│ feat: 결제 모듈 통합                          │
│ tgkim · 2일 전 · ✓ CI · 1 review request    │
│ ─────────────────────────────────────────── │
│ peeloff/frontend-admin      #88  ● draft   │
│ chore: sync-template (release-please bot)   │
│ release-please · 어제 · ✗ CI failed         │
│ ─────────────────────────────────────────── │
│ ...                                        │
└────────────────────────────────────────────┘
```

- 봇 PR (release-please / dependabot / renovate) 자동 그룹핑
- CI 상태 / 리뷰 상태 / merge conflict 인디케이터
- 우클릭: open in browser / checkout / merge / close

### 상세 화면
- 좌: 메타 (제목 / 설명 / 라벨 / 리뷰어 / CI)
- 우: diff (CodeMirror) + 라인 코멘트 inline
- 하단: 코멘트 스레드 + 새 코멘트 입력
- 단축키: A=approve, R=request changes, M=merge

## 7. Profiles 토글

타이틀 바 우측 드롭다운:
```
[👤 tgkim/personal ▼]
  ├─ 👤 personal (tgkim@github)
  │    user.name: tgkim
  │    user.email: oharapass@gmail.com
  │    signing: ssh-ed25519 …
  │    forge: github.com
  │
  ├─ 🏢 opnd (tgkim@opnd)
  │    user.name: tgkim
  │    user.email: tgkim@opnd.com
  │    signing: ssh-ed25519 …
  │    forge: git.dev.opnd.io
  │
  ├─ ＋ Add profile
  └─ ⚙ Manage profiles
```

토글 시 자동으로:
- 새 commit 의 author 정보 변경
- forge_account 자동 매칭
- SSH agent 키 추가/제거 (선택)
- 사이드바 색상 변경

## 8. 위험 액션 confirm 패턴

### Force push
```
┌─────────────────────────────────────────┐
│ ⚠ Force push to origin/main             │
│                                         │
│ This will overwrite remote history.     │
│ 4 commits will be replaced.             │
│                                         │
│ Type repo name to confirm:              │
│ [ankentrip/frontend          ]          │
│                                         │
│ [Cancel]              [Force push]      │
└─────────────────────────────────────────┘
```

### Hard reset
```
┌─────────────────────────────────────────┐
│ ⚠ Hard reset to <sha>                    │
│                                         │
│ Working changes will be PERMANENTLY     │
│ lost. This cannot be undone.            │
│                                         │
│ Working changes:                        │
│  - 3 modified, 1 untracked              │
│                                         │
│ [Cancel]   [Stash first]   [Hard reset] │
└─────────────────────────────────────────┘
```

### Delete unmerged branch
```
┌─────────────────────────────────────────┐
│ ⚠ Delete branch 'feat/payment'           │
│                                         │
│ This branch has commits not in main.    │
│ 4 unmerged commits will become          │
│ unreachable (recoverable via reflog).   │
│                                         │
│ [Cancel]              [Delete anyway]   │
└─────────────────────────────────────────┘
```

## 9. Theme

### Light
- 배경 #fafafa
- 카드 #ffffff
- 텍스트 #18181b
- 액센트 #0ea5e9 (sky-500)

### Dark (디폴트, 사용자 본인 환경 추정)
- 배경 #0a0a0a
- 카드 #18181b
- 텍스트 #fafafa
- 액센트 #38bdf8 (sky-400)

### Branch graph 색상
- 8개 stable color (브랜치 hash → index)
- 머지 lane 은 점선
- Detached HEAD 는 빨강

## 9.5. AI 패널 UX (Claude / Codex CLI 통합)

`04 §11` 의 subprocess 통합을 사용자가 마주하는 화면 결정.

### 위치
- 우측 사이드 패널 (toggle, 디폴트 닫힘)
- 또는 commit message input / PR body input 옆 "AI 제안" 버튼

### 첫 실행 마법사
```
┌──────────────────────────────────────────┐
│ AI 기능 셋업                                │
│                                          │
│ ✓ Claude Code 발견 (v2.1)                  │
│ ✗ Codex CLI 미발견                         │
│                                          │
│ 우선 사용: ⊙ Claude  ◯ Codex  ◯ 끄기       │
│                                          │
│ ⚠ AI 기능 사용 시 staged diff / PR body 가  │
│ 외부 LLM (Claude/Codex 인증된 모델) 으로    │
│ 송출됩니다. 회사 보안정책을 확인하세요.       │
│                                          │
│ [회사 워크스페이스에서 디폴트 OFF ✓]         │
│ [개인 워크스페이스에서 디폴트 ON  ✓]         │
│                                          │
│ [건너뛰기]                  [설정 완료]    │
└──────────────────────────────────────────┘
```

### AI commit message 흐름
```
1. 사용자가 stage 후 commit message input 옆 [✨ AI] 버튼 클릭
2. (회사 워크스페이스인 경우) 송출 내용 미리보기 → 승인
3. spinner 표시 + Cancel 버튼
4. CLI stdout stream 을 panel 에 실시간 표시 (typing 효과)
5. 완료 시 result 를 commit input 에 채움 (이전 입력은 보존, 사용자가 선택)
6. 사용자가 수정 가능 → commit
```

### AI PR body 흐름
- "PR 생성" 화면에서 "✨ AI body 생성" 버튼
- branch 의 모든 commit + diff stat → 한국어 PR body 생성
- 사용자 워크스페이스 컨텍스트 (글로벌 CLAUDE.md 의 trailer 금지 룰) 자동 첨부

### 시각 신호
- AI 활성화: 우측 상단 ✨ 아이콘 (회색=미설치, 파랑=Claude, 청록=Codex)
- AI 진행: 화면 상단 진행 바 + 토큰 카운터 (CLI 가 제공할 때만)
- AI 미설치: 패널은 보이되 "Claude Code 또는 Codex CLI 를 설치하면 활성화됩니다" + 설치 가이드 링크

### 설정 화면 (Settings → AI)
- CLI 선택 (Claude / Codex / 끄기)
- per-workspace ON/OFF
- secret 마스킹 패턴 (사용자 추가 가능)
- prompt 미리보기 강제 여부 (회사 워크스페이스 디폴트 ON)
- Custom system prompt 첨부 (옵션 — `docs/plan/*` 같은 컨텍스트 자동 포함)

---

## 10. 설치 / 첫 실행 플로우

```
1. 다운로드 → 설치 (Win MSI / Mac DMG / Linux AppImage)
2. 첫 실행:
   ┌─────────────────────────────────────┐
   │ git-fried 에 오신 것을 환영합니다       │
   │                                     │
   │ 1) 워크스페이스 추가                  │
   │    [개인 (GitHub)]                    │
   │    [회사 (Gitea)]                     │
   │    [기타]                             │
   │                                     │
   │ 2) 프로파일 설정                      │
   │    user.name [tgkim          ]       │
   │    user.email [oharapass@gmail]      │
   │                                     │
   │ 3) Forge 연결                        │
   │    GitHub PAT [○○○○○○○○]              │
   │    또는 [SSH 키 사용]                  │
   │                                     │
   │ 4) 한글 안전 모드 [ON ✓]               │
   │                                     │
   │ [건너뛰기]            [시작하기]       │
   └─────────────────────────────────────┘
3. 메인 윈도 진입, 첫 레포 추가 안내
```

---

다음 문서 → [08-references.md](./08-references.md)
