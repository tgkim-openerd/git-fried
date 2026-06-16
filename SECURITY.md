# Security Policy

## 보고 채널

- [GitHub Security advisory](https://github.com/tgkim/git-fried/security/advisories/new) (private — 권장)
- 또는 직접 contact (사용자 본인 GitHub profile 의 이메일)

**공개 GitHub Issue 로 보안 취약점 보고 금지** — 패치 출시 전 노출 위험.

## 응답 시간

- 24~48시간 이내 1차 응답
- patch 출시 1주 이내 (P0 critical)
- patch 출시 후 7일 후 공개 (CVE / advisory)

## 취급 범위

| 카테고리 | 예시 | 우선순위 |
| --- | --- | --- |
| Code execution (RCE) | malicious patch / repo URL 처리 시 명령 실행 | **P0** |
| Credential leak | keyring 평문 저장 / 로그 leak / AI subprocess 가 token 송출 | **P0** |
| Encoding 우회 | CP949 mangle / NFC 우회 → 한글 commit/PR body 손상 | **P0** |
| AI subprocess secret leak | Claude/Codex CLI 가 API key / private code 외부 LLM 송출 | **P0** |
| keyring access 우회 | OS 키체인 우회로 PAT 추출 | P1 |
| GUI XSS | repo / branch / PR 의 untrusted 입력이 WebView2 에서 실행 | P1 |
| LFS / submodule 의 신뢰 우회 | malicious LFS pointer / submodule URL | P1 |

## 보안 설계 원칙

- **로컬 우선**: Cloud Workspace / Cloud Patches 거부 ([`docs/plan/01 §5`](docs/plan/01-why-and-positioning.md))
- **AI 외부 송출 명시**: 첫 사용 시 confirm 모달 + per-workspace 토글 + secret 마스킹 (regex: `ghp_*` / `gho_*` / `glpat-*` / AWS keys / 한국 주민번호)
- **OS 키체인 single source**: `tauri-plugin-keyring` 만 PAT / SSH passphrase 저장 — 평문 파일 / SQLite 저장 금지
- **한글 안전 spawn**: `git/runner.rs::git_run` 표준 — UTF-8 강제 + LANG=C.UTF-8 + lossy 디코딩 + NFC + GBK fallback
- **CSP** (`tauri.conf.json`): `script-src 'self'` (unsafe-eval/inline 없음), `connect-src`/`img-src` 는 3 forge 호스트 allowlist. `style-src` 는 **`'unsafe-inline'` 의도적 허용 (plan #45 M9)** — Vue scoped styles / Tailwind 가 inline `<style>`·`style=""` 를 생성해 nonce/hash 화 비용이 크고, `script-src 'self'` 라 CSS 인젝션 단독으로 코드 실행 불가. 재평가는 Vue/Tailwind CSP-친화 전환 시.
- **hooks 경로 신뢰 경계 (plan #45 H)**: `core.hooksPath` 는 git 이 직접 resolve (`git rev-parse --git-path hooks`) 한 값만 SoT — renderer 가 IPC 로 넘긴 override 는 불신(서버 해석과 불일치 시 무시 + warn-log). 외부(repo working tree 밖) hooks 경로는 **거부하지 않고 허용하되 경고** (중앙 공유 hooks 보존 — 경고+허용 정책).
- **PR template 의 회귀 차단 체크리스트** ([`docs/plan/06 §회귀 차단`](docs/plan/06-risks-and-pitfalls.md))

## 공개 정책

- patch 출시 후 7일 후 GitHub Security advisory 공개
- credit 명시 (보고자 동의 시)
- 영향 범위 + 완화 방법 + 회귀 테스트 추가 commit 명시

## 의존성 보안

- Cargo + Bun lockfile 의 transitive 의존성 자동 audit (Dependabot / `cargo audit` — v1.x 진입 시 GitHub Actions 자동화)
- 외부 LLM (Claude / Codex CLI) 응답 직접 실행 금지 — 사용자 review + apply 패턴 강제
