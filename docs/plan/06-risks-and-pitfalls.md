# 06. 위험 / 함정 — 사전 식별 + 완화

## 위험 매트릭스

확률 × 영향 (각 1~5):

| ID | 위험 | 확률 | 영향 | 점수 | 완화 |
| --- | --- | --- | --- | --- | --- |
| R1 | **AI 페어 의존 — Claude/Codex 가 표준 함수 우회·일반 OSS 패턴 차용** | 5 | 4 | **20** | `04 §3 §11` 표준 강제 + PR review checklist + 회귀 테스트 우선 |
| R2 | Windows 한글 인코딩 회귀 | 4 | 5 | **20** | 표준 spawn 함수 + 회귀 테스트 |
| R3 | Tauri WebView2 + Rust 통합 함정 | 4 | 4 | **16** | GitButler 사례 학습, issue tracker 모니터 |
| R4 | libgit2 거대 레포 성능 | 3 | 5 | **15** | 하이브리드 (heavy=git CLI) |
| R5 | 1인 운영 burnout | 4 | 4 | **16** | OSS 베타 / 기능 컷 / 수익화 v1.x deferral / 본업 시간 보호 |
| R6 | Gitea API 변경 (자동화 깨짐) | 2 | 4 | **8** | OpenAPI codegen + 버전 핀 + e2e |
| R7 | Windows 코드 서명 비용/SmartScreen | 4 | 3 | **12** | OV → EV 단계, 평판 누적 |
| R8 | (제거 — macOS notarization 은 v1.x 결정으로 deferral) | — | — | — | — |
| R9 | (제거 — macOS / Linux 출시 자체를 v1.x 로 deferral) | — | — | — | — |
| R10 | GitKraken / Tower 가 한글/Gitea 따라잡음 | 3 | 5 | **15** | 차별화 4축 동시 유지 + OSS 가치 + AI 페어 통합 차별 |
| R11 | 사용자 본인 본업 충격 (회사 일정) | 4 | 4 | **16** | 주 15시간 보장, sprint 단위 계획 |
| R12 | 라이선스 분쟁 (libgit2 GPL?) | 1 | 5 | **5** | libgit2 = GPLv2 with linking exception, OK |
| **R13** | **Claude/Codex CLI 의존 — 사용자 인증 만료 / CLI 버전 변경 / API 변경** | 3 | 3 | **9** | CLI 자동 감지 + 미설치 시 graceful degradation + AI 기능은 항상 manual fallback 가능 |
| **R14** | **Vue 3 + shadcn-vue 컴포넌트 갭 (shadcn React 본가 대비 일부 누락)** | 3 | 2 | **6** | reka-ui 직접 사용 + 부족 시 shadcn 소스 직접 포팅 (어차피 복붙형) |
| **R15** | **AI 가 사내 private 코드를 외부 LLM 으로 송출 (CLI 통과)** | 4 | 5 | **20** | 첫 실행 시 명확 고지 + opt-in / 회사 정책 토글 / secret 마스킹 정규식 사전 처리 |

## R1. AI 페어 의존 — Claude/Codex 표준 우회

**증상**: Claude/Codex 가 GitButler / VSCode / 일반 OSS 패턴을 무비판 차용 → 본 프로젝트의 한글 spawn 표준 (`04 §3`) / Forge 추상화 (`04 §6`) / AI subprocess 표준 (`04 §11`) 을 우회. 한글 mangle 회귀 / Gitea 호환성 깨짐.

**완화 시퀀스**:
1. **PR review checklist (`06 §회귀 차단`) 강제** — 모든 PR이 표준 함수 통과했는지 확인.
2. AI 가 코드 작성 시 prompt 에 "이 프로젝트는 `docs/plan/04 §3` 의 `git_run` 표준 spawn 함수만 사용. 직접 `Command::new("git")` 호출 금지" 같은 룰을 system prompt 에 박음.
3. 회귀 테스트 우선 — 한글 round-trip / safe.directory / Gitea API round-trip / AI subprocess UTF-8 4개 스위트 반드시 통과.
4. 사용자 review 시 한국어 코멘트 + 의도 명확성 체크 — AI가 "왜 이렇게 짰나" 모르면 거절.
5. 복잡한 패턴 (lifetime, generic trait, unsafe) 발견 시 즉시 단순 패턴으로 재작성 요청.

**대안 (실패 시)**: 일부 도메인 (Forge 추상화 / 한글 spawn) 은 사용자가 단계적으로 직접 학습 + 수기 작성. 핵심 표준 함수 5~10개만 직접 책임지면 나머지는 AI 안전.

## R2. Windows 한글 인코딩 회귀

**증상**: 새 기능 추가 후 한글 커밋 메시지가 mangle. 사용자 신뢰 즉시 상실.

**완화 시퀀스**:
1. **표준 spawn 함수 단일화** ([04-tech-architecture.md](./04-tech-architecture.md) §3 참조).
2. **회귀 테스트 스위트**:
   - 한글 커밋 메시지 commit → log 디코딩 round-trip
   - 한글 파일명 stage → diff 표시
   - Gitea PR body 한글 POST → GET round-trip
   - chcp 949 / 65001 양쪽에서 모두 통과
3. CI에 Windows runner 필수 (Mac/Linux만 돌리고 Windows 회귀 놓치는 케이스 다수).
4. 사용자에게 "한글 안전" 약속을 마케팅 전면에. → 회귀 발생 시 P0 hotfix.

## R3. Tauri WebView2 + Rust 통합 함정

**알려진 이슈**:
- Tauri sidecar UTF-8 buffering bug (#5912)
- Tauri shell UTF-8 parsing (#4644)
- WebView2 force UTF-8 (#2713)
- IPC 큰 페이로드 (>1MB) JSON serialize 비용

**완화**:
- sidecar 미사용 — std `Command` + `Stdio::piped` 직접
- 큰 페이로드 (full diff blob, large log)는 Tauri `Channel<T>` API + binary streaming
- WebView2 디코딩 책임을 Rust에 집중 (프론트는 JSON string만 신뢰)

**모니터**: GitButler 의 issue/PR 추적, Tauri Discord #releases 채널.

## R4. libgit2 거대 레포 성능

**증상**: 50k+ commits 레포에서 status / log 5초+. 사용자 이탈.

**완화**:
- **하이브리드 전략**: read는 git2-rs, heavy는 git CLI.
- log / branch / status는 git2-rs OK
- blame / large diff (>1MB) / clone / push / pull은 git CLI
- 옵션: gitoxide 가 v0.3 안에 production-ready 면 점진 교체

**측정 기준**: 사용자 본인 레포 중 가장 큰 것 (catholic-erp 657 commits, ptcorp-eosikahair 675 commits) 에서 status < 200ms, log 1000개 < 500ms 목표.

## R5. 1인 운영 burnout

**가장 현실적 위험**.

**완화**:
1. **기능 컷 가차없이**: v0.1 16개 기능 그룹 중 정 부족하면 Submodule을 v0.2로 미루는 식.
2. **OSS 베타 = 기대 관리**: README에 "1인 개발, 응답 1주, 기능 요청은 reaction 으로 투표" 명시.
3. **GitHub Issues 만 채널**, Discord/이메일 미오픈 (v0.3까지).
4. **본업 시간 침범 금지**: 주 15시간 / 토일 + 평일 1~2시간 고정.
5. 매월 1회 "안 만든 것 회고" — 기능 추가가 아닌 컷 회의.
6. 사용자 본인이 dogfooding → 가장 큰 동기.

## R6. Gitea API 변경

Gitea는 비교적 호환성 유지 잘 함. 1.20 → 1.22 → 1.23 (현재 안정) 거의 호환.

**완화**:
- OpenAPI 스펙 직접 fetch (`{base_url}/swagger.v1.json`) → codegen 자동
- 빌드 시 `pnpm gen:gitea` 등록 → 런타임 schema mismatch 즉시 감지
- 사용자별 Gitea 버전 다양 (회사 self-hosted 가 1.18~1.23 혼재 가능) → 클라이언트 측 graceful degradation
- e2e: 사용자의 `git.dev.opnd.io` 인스턴스 대상 매주 1회 smoke test

## R7. Windows 코드 서명 / SmartScreen

**증상**: OV 인증서 사용 시 수개월간 SmartScreen "위험한 앱" 경고. 신규 사용자 이탈.

**전략**:
- v0.0~v0.3: OV 인증서 ($100~200/yr). SmartScreen 평판 누적.
- v1.0+: EV 인증서 ($400/yr + HSM). 즉시 평판 통과.
- 사용자에게 README 에 "More info → Run anyway" 가이드.

## R8 / R9. macOS / Linux — v1.x 로 deferral (위험 점수 0)

**결정 (2026-04-26)**: Windows 우선 / macOS / Linux 출시는 v1.x 로 deferral. 사용자 본인 환경(Windows 11) dogfood 만으로 v0.x ~ v1.0 진행. v1.0 출시 후 사용자 요청 누적 시 별도 sprint 로 진입.

**v1.x 진입 시 점검 항목**:
- Apple Developer 가입($99/yr) + notarization 수동 검증
- WebKitGTK 4.1 의존 → AppImage / flatpak 우선
- `tauri build --target universal-apple-darwin` 빌드
- macOS 한글 입력 (NFC/NFD) 회귀 테스트 추가

## R10. GitKraken / Tower 가 따라잡음

Tower 9.1이 이미 Gitea 정식 지원. 우리 차별화 침식 가능.

**완화**:
- 4축 (Gitea + 한글 + Tauri 경량 + 멀티 레포) 동시 유지가 우리 moat.
- Tower 는 macOS-first, 한글 약함, Tauri 아님 → 따라오기 어려움.
- OSS / 가격 무료 → 진입장벽.
- v0.2 의 worktree + multi-repo cherry-pick 같은 한국 워크플로우 직격 기능 = 또 다른 moat.

## R11. 본업 충격

**완화**:
- Sprint 단위 (2~4주) 계획. 본업 바쁘면 sprint scope 축소.
- v0.0~v0.1 8개월 가정 = 충분히 buffer 있음.
- 본업 마감 시즌 (예: 1~2월, 7~8월) 은 sprint 0.5x.

## R13. Claude/Codex CLI 의존

**증상**: 사용자 `claude` 인증 만료, CLI 버전 업데이트로 `--output-format` 플래그 변경, rate limit 일시 초과.

**완화**:
- 앱 시작 시 CLI 자동 감지 + 인증 ping. 실패 시 AI 패널 비활성화 + 안내.
- 모든 AI 액션은 manual fallback 보장 — commit message / PR body 는 AI 없어도 항상 직접 입력 가능.
- CLI 버전 매트릭스 README 명시 (`Claude Code v2.x+`, `Codex CLI v1.x+`).
- subprocess output 파싱 실패 시 raw stderr 토스트 + GitHub Issues 안내.

## R14. Vue 3 + shadcn-vue 컴포넌트 갭

**증상**: shadcn-vue 가 React 본가 대비 일부 컴포넌트(예: combobox, command 일부) 누락 또는 업데이트 1~2주 지연.

**완화**:
- 누락 시 reka-ui (Radix Vue) 직접 사용 — Headless 라 디자인 자유.
- 정 부족하면 shadcn React 소스를 Vue SFC 로 포팅 (어차피 복붙형 라이선스).
- v0.0 셋업 시 사용 예정 컴포넌트 인벤토리 (Button/Input/Dialog/Dropdown/Toast/Tabs/Sheet/Select/Form/Table) 모두 shadcn-vue 에 존재 확인.

## R15. 사내 코드 외부 LLM 송출 (Critical)

**증상**: 사용자가 회사 Gitea private 레포의 diff 를 AI commit message 에 사용 → Claude/Codex API 로 외부 송출. 회사 보안정책 위반 가능.

**완화**:
- 첫 AI 사용 전 명확 고지 modal: "diff/PR body 가 외부 LLM 으로 송출됩니다. 회사 정책 확인 후 진행."
- per-workspace AI disable 토글 (회사 워크스페이스는 OFF 디폴트, 개인 워크스페이스는 ON 디폴트).
- secret 마스킹 사전 처리 (regex): `.env`, `ghp_*`, `gho_*`, `glpat-*`, AWS keys, 한국식 주민번호 패턴.
- prompt 빌드 직전 사용자에게 송출 내용 미리보기 + 승인 (옵션, 회사 워크스페이스에서 강제).

---

## R12. 라이선스

| 라이브러리 | 라이선스 | 우리 사용 가능? |
|---|---|---|
| libgit2 (via git2-rs) | GPLv2 with linking exception | ✅ MIT/Apache 코어 OK |
| git2-rs | MIT/Apache 2.0 | ✅ |
| gitoxide | MIT/Apache 2.0 | ✅ |
| Tauri | MIT/Apache 2.0 | ✅ |
| React 19 | MIT | ✅ |
| shadcn/ui | MIT (복붙) | ✅ |
| CodeMirror 6 | MIT | ✅ |
| sqlx | MIT/Apache 2.0 | ✅ |

**우리 라이선스 후보**:
- v0.0~v1.0: MIT (단순, 기여자 친화)
- 대안: Fair Source (GitButler 모델, 2년 후 MIT) → 유료화 진입 시 검토

## 회귀 차단 체크리스트 (모든 PR)

- [ ] 한글 커밋 round-trip 테스트 통과
- [ ] Windows / macOS CI 통과
- [ ] 사용자 본인 레포 중 1개에 dogfood (commit/branch/diff 정상 동작)
- [ ] keychain 토큰 노출 / 평문 저장 없음
- [ ] safe.directory 자동 처리 회귀 없음
- [ ] 메모리 사용량 baseline 대비 +20% 이내

---

다음 문서 → [07-design-decisions.md](./07-design-decisions.md)
