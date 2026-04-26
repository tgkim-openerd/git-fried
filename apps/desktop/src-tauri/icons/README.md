# 아이콘 placeholder

v0.0 단계에서는 아이콘이 비어 있습니다. `bun tauri build` 가 동작하려면 아래 파일들이 필요합니다:

- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns` (macOS)
- `icon.ico` (Windows)

### 빠른 생성 방법

1. SVG / PNG 한 장(>= 1024x1024) 준비
2. `bun tauri icon ./logo.png` 실행 (Tauri CLI 가 모든 사이즈 자동 생성)

또는 [tauri-icon-generator](https://github.com/tauri-apps/tauri/tree/v2/crates/tauri-cli) 사용.

### 임시 개발

`bun tauri dev` 는 아이콘 없어도 동작합니다. `bun tauri build` 만 막힙니다.
