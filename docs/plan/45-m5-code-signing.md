# Plan #45 M5 — Code Signing 설계 + 체크리스트

> plan #45 Phase 4. **M5a (설계 + 체크리스트)** = 본 문서. **M5b (실 적용)** = cert 보유
> 환경에서 사용자가 본 체크리스트대로 적용 (cert 미보유 CI/dev 빌드를 깨지 않도록 본 단계는
> config 를 *문서화만* 하고 always-on 으로 박지 않는다 — release.yml 의 서명 step 은
> secret 존재 시에만 동작하는 gated step 으로 추가).

## 배경 / 갭

현재 git-fried 배포 바이너리는 **미서명** (grounding 2026-06-16): tauri.conf.json bundle 에
`certificateThumbprint`/`signCommand`(Windows) 도, macOS `signingIdentity`/notarization 도
없다. 미서명 = Windows SmartScreen / macOS Gatekeeper 경고 + 공급망 무결성 부재.

> 결정 (2026-06-16): cert **취득 완료**. **updater 는 나중(defer)** — 본 plan 범위 제외.

## A. Windows Authenticode

### 적용 위치 (cert 보유 시 사용자가 채움)

`apps/desktop/src-tauri/tauri.conf.json` 의 `bundle.windows` (택1):

```jsonc
// 옵션 1 — 설치된 cert 의 thumbprint (로컬 dev / self-hosted runner)
"bundle": {
  "windows": {
    "certificateThumbprint": "<SHA1 THUMBPRINT>",
    "digestAlgorithm": "sha256",
    "timestampUrl": "http://timestamp.digicert.com"
  }
}

// 옵션 2 — 커스텀 signCommand (CI / Azure Trusted Signing / HSM)
"bundle": {
  "windows": {
    "signCommand": "trusted-signing-cli -e <ENDPOINT> -a <ACCOUNT> -c <CERT_PROFILE> %1"
  }
}
```

> **always-on 금지 이유**: `signCommand`/`certificateThumbprint` 가 박히면 cert 없는 환경의
> `tauri build` 가 서명 단계에서 **실패**한다. 따라서 본 키는 cert 보유 후 적용하거나,
> CI 에서 secret 존재 시에만 주입(아래 release.yml 패턴).

### CI 적용 (release.yml — **이미 존재**)

`.github/workflows/release.yml` 에 secret-gated EV signtool step 이 **이미 구현됨**
(`signtool (EV) — optional`, `if: env.EV_THUMBPRINT != ''`, sectigo timestamp, sha256,
MSI/NSIS 순회 서명). `EV_THUMBPRINT` secret 미등록 시 자동 skip → unsigned 빌드(기존 동작
보존). 또한 Tauri 자체 서명용 `TAURI_SIGNING_PRIVATE_KEY` env 도 빌드 step 에 배선됨.

→ **M5b 의 CI wiring 은 완료 상태**. 남은 작업 = (1) `EV_THUMBPRINT` (또는 OV) secret 등록
+ HSM(eToken/Yubikey FIPS) 준비, (2) 필요 시 위 `bundle.windows` 키를 tauri.conf.json 에
적용(cert 보유 후 — 미보유 시 빌드 파손 주의).

### 체크리스트 (Windows)

- [ ] cert 종류 결정: OV/EV `.pfx` thumbprint vs Azure Trusted Signing vs HSM
- [ ] `digestAlgorithm: sha256` + RFC 3161 `timestampUrl` (서명 만료 후에도 유효)
- [ ] CI secret 등록: `WINDOWS_CERT_THUMBPRINT` (또는 Azure endpoint/account/profile)
- [ ] release.yml gated step 추가 (secret 없으면 unsigned — 빌드 미파손)
- [ ] 서명 후 검증: `signtool verify /pa <artifact>` + SmartScreen 경고 감소 실측

## B. macOS Developer ID + Notarization

### 적용 위치

`tauri.conf.json` `bundle.macOS`:

```jsonc
"bundle": {
  "macOS": {
    "signingIdentity": "Developer ID Application: <NAME> (<TEAMID>)",
    "providerShortName": "<TEAMID>",
    "entitlements": null
  }
}
```

notarization 은 `tauri build` 후 `notarytool` (env: `APPLE_ID`/`APPLE_PASSWORD`/`APPLE_TEAM_ID`).

### 체크리스트 + 함정 (docs/solutions 기존 자산 참조)

- [ ] Developer ID **Application** + **Installer** cert 2종 (.p12 별도)
- [ ] openssl 3.x `.p12` → macOS `security import` 시 **`-legacy` 필수** (3.x 기본 거부)
- [ ] `notarytool` 은 **`--keychain` 명시** 필요
- [ ] 신규 Apple 계정 첫 공증 ~52분 소요(락 아님 — 대기)
- 상세: [docs/solutions/dotnet-selfcontained-macos-app-adhoc-codesign-deep.md](../solutions/dotnet-selfcontained-macos-app-adhoc-codesign-deep.md)

## 검증 (M5b 적용 후)

1. Windows: `signtool verify /pa *.msi *.exe` → 서명 체인 valid
2. macOS: `codesign --verify --deep --strict *.app` + `spctl -a -vvv *.app` → Gatekeeper accept
3. 실 다운로드 + 실행 → SmartScreen/Gatekeeper 경고 감소 육안 확인
4. release.yml: secret **부재** 시 unsigned 빌드가 여전히 green (gated step skip) 확인

## 미적용 사유 (M5b deferred-to-user)

본 세션은 cert 미보유 환경 + 서명은 실 cert 없이는 검증 불가. tauri.conf.json 에 서명 키를
always-on 으로 박으면 cert 없는 빌드가 깨지므로, 본 단계는 **설계+체크리스트(M5a)** 로 확정하고
실 적용(M5b)은 cert 보유 사용자가 위 체크리스트대로 수행. updater 는 별도 결정(현재 defer).
