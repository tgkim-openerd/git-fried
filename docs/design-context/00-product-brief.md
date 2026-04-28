# 00. Product Brief — git-fried

> **이 문서의 독자**: Claude Design / Figma 디자이너 / 외부 협업 디자이너.
> **목적**: 디자인 시스템·화면을 그리기 전에 git-fried 가 어떤 제품인지, 누구를 위해 만드는지, 어떤 톤앤매너로 가야 하는지 한 화면에 잡는다.

---

## 1. 한 줄 정의

> **GitHub 개인 프로젝트 + Gitea 회사 프로젝트를 동시에 다루는 한국 풀스택 개발자를 위해, GitKraken 보다 가볍고 정확하며 한글이 깨지지 않는 데스크탑 Git 클라이언트.**
>
> — `docs/plan/01-why-and-positioning.md` § 1

## 2. 30초 요약 (plan/00 § 0 인용)

> Gitea 1급 시민 + 한글 안전 + Tauri 2 경량 + 멀티 레포·멀티 워크트리·서브모듈 핵심.
> GitKraken을 베끼되, GitKraken이 5년째 안 고치는 Gitea 미지원·한국어 인코딩·클라우드 강제·Electron 무거움 4개 약점을 정확히 노린다.

## 3. 차별화 5축 (마케팅 카피 후보, plan/01 § 4)

| # | 키워드 | 한 줄 |
|---|--------|------|
| 1 | **Gitea-first** | "Gitea가 1급 시민인 첫 번째 GUI" |
| 2 | **Korean-safe** | UTF-8 강제 파이프, file-based commit body, CP949 mangle 차단 |
| 3 | **Tauri-light** | Electron 1/8 메모리 (50MB idle 목표 vs GitKraken 200~300MB) |
| 4 | **Worktree + Submodule 1급** | 사용자 실측 기준 8 worktree / 6/6 submodule |
| 5 | **Multi-repo native** | `frontend` + `frontend-admin` 듀얼 레포 패턴 직접 지원 |

## 4. 슬로건/Tagline 후보

> **"50개 레포를 한 화면에서, 50MB 메모리로"** (plan 다회 등장 — 사용자 워크플로우 구체 수치)

## 4-2. Feature Parity Ambition (디자인 hard constraint)

> **"GitKraken 의 핵심 기능 ≈70개를 흡수하면서 4 약점만 정조준한다."**

이건 단순 마케팅이 아니라 **디자인 결정의 토대**. 자세한 흡수/skip 카탈로그는 [`06-gitkraken-feature-parity.md`](./06-gitkraken-feature-parity.md). 디자이너가 알아야 할 것:

| 함의 | 구체 |
|------|------|
| **현재 카운트 → v1.0 카운트** | 모달 18 → ~25 / Settings 9 → ~12 / 탭 7 → ~10 / Commands 30+ → ~60 / 미구현 ≈15 |
| **Density 강제 정착** | minimal 은 anti-pattern. spacious 한 spacing 도 anti. JetBrains/Tower/Fork 의 IDE-grade 정보 밀도. |
| **Plugin slot 미리 확보** | Cloud Workspace / Cloud AI / Cloud Patches 같은 GitKraken Pro 기능을 git-fried 가 로컬-우선 / CLI-위임 으로 대체 — Sidebar `Integrations` / Settings `Plugin` 슬롯 placeholder 디자인 필요 |
| **Visual identity 의도적 분기** | 기능은 흡수, 시각은 차별화. GitKraken 의 illustration / 큰 그래프 / 풍부한 색은 따라하지 말 것 |
| **미구현 placeholder 정책** | 🔜 v0.4~v1.0 예정 기능은 disabled + tooltip "v0.4 예정" 으로 표시 가능. ❌ skip 기능 (Cloud Workspace / 자체 LLM / Diagram 등) 은 절대 표시하지 않음 |

> **검증 기준**: 1440×900 화면에 같은 정보가 GitKraken 이상으로 들어가는가?

## 5. 타겟 사용자 / 페르소나

### 5-1. Primary persona — "tgkim"

- 한국 풀스택 개발자
- **회사 모드**: Gitea (`https://git.dev.opnd.io`) 50+ 레포, 머지 많음, **커밋 메시지 55~72% 한글**, submodule + LFS, 듀얼 레포 (`frontend` + `frontend-admin`), 8 worktree
- **개인 모드**: GitHub, conventional commits, 영문, 깨끗한 history

### 5-2. 듀얼 포지 패턴이 만든 디자인 결정

| Friction | 디자인 응답 |
|----------|-----------|
| 회사/개인 컨텍스트 매번 전환 | **Profiles (1-click 토글)** — Settings § profiles + ProfileSwitcher |
| activeRepo 가 글로벌이라 회사/개인 섞임 | **per-profile 탭 영속** — 탭이 프로필에 묶여 복원 |
| 50+ 레포에서 어느 게 어느 워크스페이스인지 | **Workspace color picker + org grouping** (sidebar 2-level 트리) |
| forge 가 GitHub vs Gitea | **Forge owner-repo 매칭 필터** — Launchpad PR 보드에서 정확히 매핑 |

> **디자인 함의**: 색은 정체성 분리 도구로 쓰이며, 회사 레포 = 한 색, 개인 레포 = 다른 색으로 시각적 분리가 가능해야 한다 (현재 코드는 workspace 단위 color picker 만 존재 — 디자인 시 강화 후보).

## 6. 톤앤매너

plan 문서에는 명시적 형용사 (mature/playful/dense/spacious 등) **명시 없음**. 다만 다음 신호로 해석할 수 있다:

| 신호 | 출처 | 함의 |
|------|------|------|
| "50개 레포를 한 화면에서" | plan/00, plan/01 다회 | **Dense / Operational** — 정보 밀도 우선 |
| 컬럼 토글, 상태바, 명령 팔레트, 다중 패널 | plan/12 § A3, B2, B6 | **Power-user 향 affordance** — 처음 화면이 깔끔하기보다 모든 정보가 한 번에 보이도록 |
| Tauri 30MB idle, 50MB 목표 | plan/00 § 2 | **무거운 그래픽/애니메이션 지양** — 가벼움이 정체성 |
| 한글 안전 1급 | plan/01 § 약점 ② | **타이포그래피 신뢰** — Pretendard 기본, 한글 ellipsis/visual width 정밀 |
| GitKraken 대체 | 모든 plan | **친숙한 mental model** — branch graph, 사이드바, 모달 — 익숙함이 낯설음보다 우선 |

→ **권장 톤앤매너**: **Dense, calm, professional, instrumented (계기판 같은)**. neon 컬러 / playful illustration / 큰 여백은 정체성과 충돌. JetBrains IDE / Tower / Fork 의 분위기에 가깝다.

## 7. 시장 위치 (plan/01 § 3 발췌)

> "Gitea 1급 + 한글 1급 + Tauri 경량 + 멀티 레포 1급 = 이 4개를 모두 만족하는 도구가 시장에 없음."

직접 경쟁: **Tower** (Gitea 9.1+ 지원, $69/yr, 한국어 △), **Fork** ($49, conflict UX 강함, Gitea/한글 △).
GitKraken 은 거대 1위지만 4 약점 존재. **Sourcetree, GitHub Desktop, GitLens, Lazygit** 등 9 도구 비교 표는 plan/01 § 3 참조.

## 8. 비-목표 (Anti-Goals)

다음은 디자인 시 **지양** 해야 할 방향:

- ❌ Cloud-first / 계정 강제 (GitKraken 의 큰 약점 중 하나)
- ❌ Mobile-first 반응형 (데스크탑 전용, 1280×800 기본)
- ❌ Marketing-grade hero 화면 / illustration 중심 onboarding
- ❌ 심미성을 위해 정보 밀도 희생 — 화면당 정보량을 줄이지 말 것
- ❌ neon / vivid / saturated 색 (focus ring 외)
- ❌ 큰 transition / parallax / spring 애니메이션 (퍼포먼스/정체성 충돌)
- ❌ **Minimal-leaning UI** — 화면이 깔끔해 보이려고 정보 줄이지 말 것. GitKraken 흡수가 목표라 화면당 정보량은 GitKraken 이상이어야 함
- ❌ **GitKraken visual identity 모방** — 일러스트 / 큰 그래프 / 풍부한 색깔. 시각은 JetBrains/Tower/Fork 톤
- ❌ **고정 카운트 가정** — "탭 7개", "Settings 9개", "Modal 18개" 는 v0.x snapshot. v1.0 까지 모두 ~1.5배 증가 예정 — overflow 패턴 없으면 부서짐

## 9. 디자인이 닿아야 할 핵심 결정

다음 5개는 **디자인이 SoT 가 되어야 할 영역** (현재 코드만 SoT — 디자이너가 처음 잡아야 할 골격):

1. **토큰 (light + dark)** — `01-design-tokens.md` 참조. Figma Variables 라이브러리화 필요
2. **BaseModal 시스템** — 18개 모달 stylistic divergence 의 통합 spec (size tier / header / footer / confirm vs destructive)
3. **ContextMenu 시스템** — 17 위치 신규, 액션 우선순위 / destructive 그룹 / submenu / shortcut 표기
4. **Tooltip + aria-label** — icon-only 버튼 0/47 (현재 모두 `title` attr 만, WCAG 미충족)
5. **한글 텍스트 규칙** — ellipsis / width 기준 (CJK=2 cell, 한글 36자 = 영문 72자) / tooltip expand 정책

## 10. 다음 문서

- [`01-design-tokens.md`](./01-design-tokens.md) — 색·타이포·spacing·radius·shadow 토큰
- [`02-component-inventory.md`](./02-component-inventory.md) — 48 컴포넌트 + 18 모달 카탈로그
- [`03-screens-and-flows.md`](./03-screens-and-flows.md) — 3 페이지 + flow / 단축키 / ContextMenu
- [`04-interaction-patterns.md`](./04-interaction-patterns.md) — 키보드 / drag&drop / loading / error UX
- [`05-figma-handoff-brief.md`](./05-figma-handoff-brief.md) — Claude Design 작업 의뢰 prompt
- [`06-gitkraken-feature-parity.md`](./06-gitkraken-feature-parity.md) — GitKraken ~87 기능 카탈로그 (✅/⚠️/🔜/❌) + 4 design hard constraint
