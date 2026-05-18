# GitKraken UI/UX 흡수 toolchain — bench/gitkraken-spike/

> Plan #40 — GitKraken Desktop 12.1.1 UI tour 자동 제어 + screenshot + narration 산출. 내부 문서용 only (Axosoft EULA 일반 안전 범위).

## 디렉토리

| 경로 | 용도 | 커밋 |
| --- | --- | --- |
| `auto-screenshot.ps1` | (기존) 반자동 캡처 — 사용자 조작 + 라벨 입력 → 2초 후 자동 PNG | ✓ |
| `launch.mjs` | (기존) Playwright Electron spike — **차단됨** (라이선스 + contextIsolation) | ✓ |
| `ahk-v2/` | **NEW** AutoHotkey v2 portable binary (zip unzip) | ✗ (.gitignore) |
| `ahk-v2.zip` | **NEW** AHK v2 다운로드 원본 (`https://www.autohotkey.com/download/ahk-v2.zip`) | ✗ |
| `ui-tour/` | **NEW** 영역별 AHK script (`07-settings.ahk2`, `01-workspace.ahk2`, ...) | ✓ |
| `anchors/` | **NEW** ImageSearch 용 anchor PNG (GitKraken 버전 별 디렉토리: `12.1.1/`) | 일부 ✓ (PNG 작은 anchor 만, 큰 캡처는 ✗) |
| `hello.ahk2` | Phase 0 검증 script — AHK v2 동작 + GitKraken WinExist 확인 | ✓ |
| `hello-result.log` | hello.ahk2 실행 결과 (gitignore) | ✗ |

## AHK v2 portable 버전

- **버전**: 2.0.26 (Phase 0 hello.ahk2 검증 시점)
- **다운로드**: `https://www.autohotkey.com/download/ahk-v2.zip`
- **SHA-256**: `43522AA3122A57784AC5DB30ABF85C2244475C36ACD7796E2C993355F9E926AE`
- **크기**: 3,186,448 bytes (3.04 MB)
- **다운로드 일시**: 2026-05-18 (Plan #40 Phase 0)

zip → `bench/gitkraken-spike/ahk-v2/` 에 unzip. installer 사용 안 함, admin 권한 불필요.

## 사용법

### Phase 0 검증 (hello)

```powershell
# AHK v2 + GitKraken WinExist 검증
pwsh -NoProfile -File scripts/run-ahk2.ps1 -Script bench/gitkraken-spike/hello.ahk2 -TimeoutSec 10

# 결과
cat bench/gitkraken-spike/hello-result.log
# A_AhkVersion: 2.0.26
# GitKraken WinExist hwnd: <hwnd>
# === exit 0 ===
```

### Phase 2+ 영역별 자동 캡처

```powershell
# Settings 영역 PoC
pwsh -NoProfile -File scripts/run-ahk2.ps1 -Script bench/gitkraken-spike/ui-tour/07-settings.ahk2 -TimeoutSec 60

# 결과 — docs/ux-eval/handson/screenshots/<area>-<label>-<ts>.png
ls docs/ux-eval/handson/screenshots/
```

## Safety / Caution

1. **GitKraken 작업 중 자동 제어 시 사용자 마우스/키보드 hijack 가능** — 실행 전 5초 prompt + unattended 상태 확인.
2. **EULA**: 외부 input simulate 는 Axosoft EULA 일반 안전 범위 (Selenium 류). 산출물은 내부 문서용 only. 공개 배포 금지.
3. **GitKraken 버전 종속**: image anchor 는 12.1.1 기준. 업그레이드 시 `anchors/12.1.x/` 재캡처 필요.
4. **시크릿 위험**: handson/screenshots 의 PNG 가 OAuth token / repo name / commit message 같은 민감 정보 노출 가능 → .gitignore 로 미커밋.
5. **multi-monitor / DPI**: hello.ahk2 결과의 `A_ScreenWidth/Height/DPI` 확인. monitor 변경 시 image anchor 좌표 검증 필요.

## Plan #40 진행 상황

- ✅ Phase 0 — AHK v2 portable + run-ahk2 wrapper + hello 검증 (현재)
- ⏳ Phase 1 — 7 영역 시나리오 enumerate
- ⏳ Phase 2 — PoC Settings 1 시나리오
- ⏳ Phase 3 — 6 영역 확장
- ⏳ Phase 4 — Claude narration + Codex cross-validation
- ⏳ Phase 5 — git-fried vs GitKraken 비교표
- ⏳ Phase 6 — memory + obsidian + commit

상세: [docs/plan/40-gitkraken-ahk-handson.md](../../docs/plan/40-gitkraken-ahk-handson.md)
