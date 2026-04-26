# 01. 왜 만드는가 — 시장 위치 / 차별화

## 1. 한 문장 미션

> **GitHub 개인 프로젝트 + Gitea 회사 프로젝트를 동시에 다루는 한국 풀스택 개발자를 위해, GitKraken 보다 가볍고 정확하며 한글이 깨지지 않는 데스크탑 Git 클라이언트.**

## 2. 왜 GitKraken 대체가 가능한가 — 4 약점 직격

GitKraken은 사실상 1위 GUI지만 5년 이상 안 고친 결정적 빈틈이 4개 있다. 이 4개가 우리의 존재 이유다.

### 약점 ① Gitea 미지원
- GitKraken Pro/Advanced 의 Workspaces · Launchpad · PR 통합은 GitHub / GitLab / Bitbucket / Azure DevOps만 지원.
- `feedback.gitkraken.com` 의 "Support for Gitea pull requests" 요청은 2020년대 초부터 미해결.
- Tower 9.1이 2025년 정식 Gitea 지원하면서 빈틈을 공격하기 시작.
- **사용자 본인 환경**: 회사 50+ 레포 전부 Gitea(`https://git.dev.opnd.io`). GitKraken은 이걸 1급으로 못 다룬다.

### 약점 ② 한국어 인코딩 결함
- `feedback.gitkraken.com/suggestions/316141` "Fix character encoding for global languages on terminal screen and on search" — 공식 보고된 한글 결함, 미수정.
- 사용자 실측: gist-broadcenter `#40` PR merge title이 `���` 로 영구 mangle된 사례. force-push 금지로 복구 불가.
- 회사 레포 커밋 메시지 **55~72%가 한글**. 인코딩이 틀어지면 일상 업무가 멈춤.
- **Sourcetree 도 약함, SmartGit 도 보통, Tower 만 양호 — 한국어 시장에 대해 누구도 1급이 아니다.**

### 약점 ③ 클라우드 강제 + Free 페이월
- GitKraken 6.5.1 부터 Free 플랜은 public 레포 only. 회사 사내 Gitea(private) = 사실상 강제 유료.
- Cloud Workspace · AI · Workspaces가 GitKraken Cloud 계정 강제. 회사 보안정책상 사내 Git 메타데이터 외부 송출 차단인 곳에서 봉인됨.
- 학생/오픈소스 플랜도 2024년 축소(GitHub Discussion #173802 큰 반발).
- 글로벌 `.gitconfig` 자동 덮어쓰기 사례 — 신뢰 저하.

### 약점 ④ Electron 무거움
- 번들 200~300MB, idle 메모리 200~300MB.
- 사용자 시나리오: 50+ 레포 동시 watch → 노트북 팬 / 배터리 직격.
- 11.5 changelog "We Fixed What Mattered Most"에서 GitKraken 자체가 "50k+ commits 레포 렌더 지연" 인정.
- LFS 2~10x slowdown 보고 (`feedback.gitkraken.com/suggestions/196652`).

> **결론**: 위 4개 중 어느 하나라도 사용자가 실제로 부딪히면 GitKraken을 떠난다. 4개 모두 부딪히는 한국 회사 + Gitea + 50+ 레포 사용자 = **우리 정조준 타깃**.

## 3. 시장 분석 (10개 도구 vs 우리)

| 도구 | Gitea 정식 지원 | 한글 안전 | 멀티-레포 워크스페이스 | 메모리(idle) | 비고 |
|---|---|---|---|---|---|
| **GitKraken** | △ (Advanced+ 유료) | ❌ | ✅ (Cloud 강제) | 200~300MB | 1위지만 위 4약점 |
| **Tower** | ✅ (9.1+) | △ | △ | ~150MB | $69/yr, 우리 직접 경쟁자 |
| **Fork** | △ (수동 remote) | △ | ❌ | ~100MB | $49 일회성, conflict UX 최강 |
| **Sourcetree** | △ | ❌ | ❌ | ~250MB | Atlassian, 정체 |
| **GitHub Desktop** | ❌ (GitHub-only) | △ | ❌ | ~150MB | 단순함의 끝 |
| **SmartGit** | △ | △ | △ | ~200MB | JVM, 정체 |
| **Gitnuro** | ✅ (OSS) | △ | ❌ | ~250MB(JVM) | OSS, 활동성 낮음 |
| **GitButler** | ❌ (GitHub/GitLab) | ? | △ | ~30MB(Tauri) | 신생, virtual branch 혁신 |
| **VS Code + GitLens** | ✅ | ✅ | △ (workspace) | ~200MB | IDE 내장이라 별도 |
| **Lazygit/gitui** | ✅ (CLI 통과) | △ | ❌ | <50MB | 터미널만 |
| **★ git-fried** | **✅ 1급** | **✅ 1급** | **✅ 로컬 우선** | **~50MB** | Tauri+Rust, OSS |

→ Gitea 1급 + 한글 1급 + Tauri 경량 + 멀티 레포 1급 = **이 4개를 모두 만족하는 도구가 시장에 없음.**

## 4. 차별화 5축 — 마케팅 카피 후보

```
1. "Gitea가 1급 시민인 첫 번째 GUI"
   GitHub과 동급으로 Workspaces / PR / Issues 통합.

2. "한글이 깨지지 않는 Git 클라이언트"
   Windows + UTF-8 + CP949 mangle 차단, file-based commit body.

3. "50개 레포를 한 화면에서, 50MB 메모리로"
   Tauri + Rust. Electron 1/8 메모리.

4. "Worktree와 Submodule이 1급 시민"
   AI 코딩 시대의 워크플로우 (8개 worktree 동시 작업) 전제.

5. "오픈소스. 클라우드 강제 없음. 오프라인 동작."
   회사 보안정책 친화. 모든 코어 기능 무료.
```

## 5. 안티-차별화 (우리가 안 할 것)

- ❌ "GitKraken보다 더 많은 기능" — 기능 수 경쟁 안 함, 정확성·경량 경쟁.
- ❌ AI agent 자체 호스팅 / 자체 LLM — BYOK + Ollama만.
- ❌ 자체 클라우드 동기화 (Cloud Workspaces 같은 것). 동기화는 OS의 file sync에 위임.
- ❌ 모바일 앱 / 웹앱 — 데스크탑 한정.
- ❌ Issue 트래커 풀 통합 (Jira / Linear). Gitea/GitHub Issues만 1급.
- ❌ GitFlow / 복잡한 브랜치 전략 위저드. 사용자 본인이 안 씀.

## 6. 페르소나 (1차)

**P1: 듀얼 포지(dual-forge) 풀스택**  ← 사용자 본인
- 회사 Gitea 50+ 레포 + 개인 GitHub 14개
- 한국어 커밋 70%, 영문 30%
- Worktree로 AI 에이전트 병렬 작업
- Conventional commits, traditional merge (squash 안 함)
- Submodule + LFS 일상 사용

**P2: 한국 SI/스타트업 개발자**
- 회사 사내 Gitea 또는 GitLab self-hosted
- Mac/Windows 혼용
- Sourcetree에 지쳐서 GitKraken 검토 → 페이월에 막혀 좌절

**P3: OSS 기여자 (글로벌)**
- GitHub 위주
- Tauri 경량성 + GitButler 같은 신선한 UX 선호
- → v1 이후 추가 타깃

---

다음 문서 → [02-user-workflow-evidence.md](./02-user-workflow-evidence.md)
