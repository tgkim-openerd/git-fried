# 10. 통합 터미널 — 설계 / 구현 계획

작성: 2026-04-26 (다음 세션 진입점)
상태: **준비 완료, 사용자 결정 대기 + 다음 세션에서 진행**

---

## 0. TL;DR

이 문서를 읽고 §3 의 **2가지 기술 옵션 중 하나** 선택. 그 다음 §6 의 sprint 1 부터 진행.

---

## 1. 왜 통합 터미널?

`docs/plan/03 §4` / `docs/plan/05 v1.0` 에서 "OS 터미널 위임 우선, 통합 터미널은 옵션" 결정. 그러나:

- Interactive rebase 의 옵션 C (vim 사용) 가 통합 터미널 전제
- 사용자 워크플로우 — git 이 한국어 메시지를 OS 터미널에서 mangle 하는 사례 (사용자 보고 케이스, gist-broadcenter `#40`). **앱 내부 터미널은 우리 표준 spawn 함수와 동일한 UTF-8 파이프** 적용 가능 → 한글 안전.
- AI CLI subprocess 의 stream output 을 보여줄 곳 (현재는 단일 응답)
- pre-commit hook 실행 결과 stream (현재 commit 끝난 후만 표시)

**v1.x 핵심 가치**: 한글 안전 + 스트림 표시 + Interactive rebase 지원.

---

## 2. 사용자 워크플로우 ROI

**현재 페인 포인트** (사용자 추정):
- Windows Terminal / Git Bash / WSL 사이 분산
- 한글 입력 IME 가 일부 환경에서 불안정
- AI CLI 출력을 git-fried 안에서 못 봄 (외부 터미널 띄워야)

**얻는 가치**:
- 단일 화면에서 git + AI + 일반 shell 모두
- 한글 인코딩 안전 (앱이 통제)
- 워크스페이스/레포별 cwd 자동 (사이드바 클릭 → 터미널 자동 cd)

→ **v1.x 가치 큼**, 단 기술 비용 큼. 점진 출시.

---

## 3. 기술 옵션 비교 (★ 사용자 결정)

### 옵션 A: portable-pty (Rust) + xterm.js (Vue)

**아이디어**:
- Rust 측에서 `portable-pty` crate 가 OS PTY (Windows ConPTY / Unix forkpty) 추상화
- shell (`pwsh.exe` / `bash`) 을 PTY 안에서 실행
- stdout/stdin 을 Tauri Channel 로 Vue 측 xterm.js 와 양방향 binding

**구조**:
```
[xterm.js (Vue)] ←→ Tauri Channel<Bytes> ←→ [portable-pty in Rust] ←→ [pwsh.exe]
       ↑                                              ↓
   IME 입력                                      stdout/stderr
```

**장점**:
- 진정한 터미널 (color / cursor / IME)
- ConPTY 가 Windows 10 1809+ 표준 — 신뢰성 높음
- WSL / Git Bash / pwsh 모두 호스팅 가능
- xterm.js 는 VS Code 가 검증 (수억 사용자)

**단점**:
- 의존성 큼: `portable-pty 0.8` + `xterm.js 5.x` + `xterm-addon-fit` + `xterm-addon-web-links`
- Tauri Channel 의 binary stream 효율 (V8 ↔ Rust 매번 변환) — 실측 확인 필요
- ConPTY 의 알려진 함정: 한글 IME composition 이 race 발생 가능
- shell 종료 / resize / Ctrl+C 등 신호 전달 처리

### 옵션 B: command 1회 실행 (PTY 없음, 단순 출력)

**아이디어**:
- 진정한 터미널 X. 사용자가 명령 한 줄 입력 → Rust 가 spawn → output 표시
- 인터랙티브 명령 (vim / bash 자체) 미지원

**장점**:
- 매우 간단 (PTY 인프라 없음)
- AI CLI / git 명령 stream 표시 100% 가능

**단점**:
- vim / Interactive rebase 사용 불가 (옵션 C 시나리오 깨짐)
- 사용자 기대 (진정한 터미널) 와 어긋남

### 추천

**1차: 옵션 A** (PTY + xterm.js).
- 진정한 가치 제공
- VS Code / GitButler 등 선례
- 인프라 한 번 만들면 v1.x ~ v2.0 다양한 활용 (logs / hook stream / AI stream)

**2차: 옵션 B** (단순 spawn).
- v1.0 임시 — AI CLI / git output 보여주는 panel 정도
- v1.x 에서 옵션 A 로 교체

---

## 4. 옵션 A 채택 시 — 상세 설계

### 4.1 Rust 측 모듈 (`pty/mod.rs` 신규)

```rust
// apps/desktop/src-tauri/src/pty/mod.rs

use portable_pty::{native_pty_system, CommandBuilder, PtySize, PtyPair};
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct PtySession {
    pair: Arc<Mutex<PtyPair>>,
    /// child writer (stdin 으로 사용자 입력)
    writer: Arc<Mutex<Box<dyn std::io::Write + Send>>>,
}

impl PtySession {
    pub fn new(cwd: &Path, shell: &str, cols: u16, rows: u16) -> AppResult<Self> {
        let pty_system = native_pty_system();
        let pair = pty_system.openpty(PtySize { rows, cols, ..Default::default() })?;
        let mut cmd = CommandBuilder::new(shell);
        cmd.cwd(cwd);
        cmd.env("LANG", "C.UTF-8");
        cmd.env("LC_ALL", "C.UTF-8");
        let _child = pair.slave.spawn_command(cmd)?;
        let writer = pair.master.take_writer()?;
        Ok(Self {
            pair: Arc::new(Mutex::new(pair)),
            writer: Arc::new(Mutex::new(writer)),
        })
    }

    pub async fn write(&self, data: &[u8]) -> AppResult<()> {
        let mut w = self.writer.lock().await;
        w.write_all(data)?;
        w.flush()?;
        Ok(())
    }

    pub async fn resize(&self, cols: u16, rows: u16) -> AppResult<()> {
        let pair = self.pair.lock().await;
        pair.master.resize(PtySize { rows, cols, ..Default::default() })?;
        Ok(())
    }

    /// reader 를 분리해서 backend 에서 비동기로 stdout 폴링.
    /// chunk 마다 Tauri emit / Channel 로 전송.
    pub fn reader(&self) -> AppResult<Box<dyn std::io::Read + Send>> {
        let pair = self.pair.blocking_lock();
        Ok(pair.master.try_clone_reader()?)
    }
}
```

### 4.2 IPC 명령 (`ipc/pty_commands.rs` 신규)

```rust
use tauri::ipc::Channel;

#[tauri::command]
pub async fn pty_open(
    cwd: String,
    shell: String,
    cols: u16,
    rows: u16,
    on_data: Channel<Vec<u8>>,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<u64> {
    let session = PtySession::new(Path::new(&cwd), &shell, cols, rows)?;
    let id = state.pty_sessions.register(session.clone());

    // reader 백그라운드 task — chunk 마다 emit
    tokio::task::spawn_blocking(move || {
        let mut reader = session.reader()?;
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    on_data.send(buf[..n].to_vec())?;
                }
                Err(_) => break,
            }
        }
        Ok::<_, AppError>(())
    });

    Ok(id)
}

#[tauri::command]
pub async fn pty_write(id: u64, data: Vec<u8>, state: ...) -> AppResult<()>;

#[tauri::command]
pub async fn pty_resize(id: u64, cols: u16, rows: u16, state: ...) -> AppResult<()>;

#[tauri::command]
pub async fn pty_close(id: u64, state: ...) -> AppResult<()>;
```

`AppState` 에 `pty_sessions: PtyRegistry` 추가 — `Arc<Mutex<HashMap<u64, PtySession>>>`.

### 4.3 Vue 측 (`TerminalPanel.vue` 신규)

```ts
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Channel, invoke } from '@tauri-apps/api/core'

const term = new Terminal({
  fontFamily: 'JetBrains Mono, D2Coding',
  fontSize: 13,
  theme: { background: '#0a0a0a' },
})
const fit = new FitAddon()
term.loadAddon(fit)
term.loadAddon(new WebLinksAddon())
term.open(containerRef.value)
fit.fit()

const onData = new Channel<number[]>()
onData.onmessage = (chunk) => term.write(new Uint8Array(chunk))

const id = await invoke<number>('pty_open', {
  cwd: '...',
  shell: 'pwsh.exe',
  cols: term.cols,
  rows: term.rows,
  onData,
})

term.onData((data) => invoke('pty_write', { id, data: [...new TextEncoder().encode(data)] }))
window.addEventListener('resize', () => {
  fit.fit()
  invoke('pty_resize', { id, cols: term.cols, rows: term.rows })
})
```

### 4.4 위치 / UX

- 하단 토글 패널 (split — 그래프와 같이 보임)
- 또는 `⌘\``  단축키로 toggle
- 탭 시스템 — 레포별 / shell별 (pwsh / bash / wsl)
- 사이드바 레포 클릭 → 활성 터미널의 cwd 자동 이동 (옵션)

---

## 5. 알려진 함정

### 5.1 Windows ConPTY

- `winpty` 는 deprecated. **ConPTY (Windows 10 1809+)** 만 사용.
- ConPTY 의 한글 IME composition 이 일부 환경에서 race — 입력 직후 완성 문자가 떨어지는 현상. 회피: xterm.js 의 `ime` mode + composition event handling.
- ANSI escape 일부 (예: `\e]2;...\a` 타이틀 변경) ConPTY 미지원 → xterm.js 가 자체 무시.

### 5.2 portable-pty 0.8 의 함정

- Windows 에서 spawn 한 child process 의 종료 신호 (Ctrl+C) 전달이 까다로움 — `child.kill()` 만으로 충분 한 경우와 아닌 경우 혼재.
- macOS 에서 fork+exec 후 첫 read 가 blocking — `set_nonblocking` 처리 필요.

### 5.3 Tauri Channel 성능

- Channel<Vec<u8>> 는 매번 Rust → JS 변환 (zero-copy 아님). 1MB+ 출력 시 잠시 느릴 수 있음.
- 4KB chunking 권장. 큰 paste 시 buffering.

### 5.4 한글 입력

- Windows IME 의 candidate window 가 xterm.js 위에 띄워지지만 위치 보정 필요할 수 있음.
- macOS NFC vs Windows NFC 차이 — 우리 spawn 환경변수로 `LANG=C.UTF-8` 강제하므로 OK.

### 5.5 보안

- shell 자체가 임의 명령 실행 가능 — Tauri capability 에 추가 권한 명시.
- `pty_write` 에 secret 검증 안 함 (사용자가 직접 입력하니까 OK).

---

## 6. Sprint 계획 (옵션 A 기준)

### Sprint 1: 인프라 (예상 1.5세션)
- [ ] Cargo.toml: `portable-pty = "0.8"` 추가
- [ ] `pty/mod.rs`: PtySession + Registry
- [ ] AppState 에 pty_sessions 추가
- [ ] IPC 4개 (open / write / resize / close) + Tauri Channel<Vec<u8>>
- [ ] 단위 테스트: `pwsh -Command "echo hello"` round-trip

### Sprint 2: Vue UI (예상 1.5세션)
- [ ] package.json: `@xterm/xterm` `@xterm/addon-fit` `@xterm/addon-web-links`
- [ ] `TerminalPanel.vue`: xterm 마운트 + Tauri Channel binding
- [ ] resize observer + fit.fit()
- [ ] 하단 split 패널 (높이 조절 가능, 디폴트 30%)
- [ ] `⌘\`` 단축키 (useShortcuts 추가)

### Sprint 3: 워크플로우 통합 (예상 1세션)
- [ ] 사이드바 레포 클릭 → 활성 터미널 자동 cd
- [ ] AI 출력을 별도 터미널 탭에 표시 (옵션)
- [ ] 다중 터미널 (탭) — pwsh / bash / wsl 동시 호스팅
- [ ] 색상 / 폰트 사용자 설정

### Sprint 4 (v1.x): 고급
- [ ] Interactive rebase 의 todo 편집을 터미널 안 vim 으로 가능
- [ ] split 두 터미널 동시
- [ ] tmux-like layouts

---

## 7. 사용자 결정 항목

다음 4가지 답변 주시면 다음 세션 즉시 진입:

1. **기술 옵션** — A (portable-pty + xterm.js) / B (단순 spawn 출력) ?
2. **MVP shell** — pwsh.exe (Windows 기본) / bash (Git Bash) / wsl ?
3. **위치** — 하단 split (디폴트) / 별도 페이지 (`/terminal`) / 모달 ?
4. **Interactive rebase 와의 관계** — 통합 터미널 먼저 + 거기서 `git rebase -i` (옵션 C) / 별도로 `09` 의 옵션 A 진행 ?

---

## 8. 다음 세션 첫 명령어 (옵션 A 가정)

```
"docs/plan/10 의 옵션 A 로 진행. shell=pwsh.exe, 위치=하단 split, ⌘` 단축키."
```

Claude 자동 진입:
1. Cargo.toml 의존성 추가
2. pty 모듈 + AppState 확장 + IPC
3. xterm.js 패키지 설치 + TerminalPanel
4. 사이드바 split + ⌘`
5. cargo + typecheck 검증
6. commit

---

## 9. 참고 자료

- [portable-pty crate](https://crates.io/crates/portable-pty) (wezterm 팀)
- [xterm.js](https://xtermjs.org/) (VS Code 사용)
- [Microsoft ConPTY 문서](https://devblogs.microsoft.com/commandline/windows-command-line-introducing-the-windows-pseudo-console-conpty/)
- [GitButler 의 PTY 통합 사례](https://github.com/gitbutlerapp/gitbutler/tree/master/crates/gitbutler-tauri/src) (Rust + Tauri 선례)
- [Warp Terminal](https://www.warp.dev/) (Rust 기반 터미널, 디자인 영감)

---

## 10. 09 (Interactive rebase) 와의 결합

**시나리오 1: 09 옵션 A + 10 옵션 A** (둘 다 separate)
- Interactive rebase 자체 helper binary 사용
- 통합 터미널은 일반 shell 호스팅
- 둘 분리 — 가장 유연

**시나리오 2: 09 옵션 C (터미널 위임)** = 10 만 작업
- Interactive rebase 코드 0
- 사용자가 통합 터미널에서 `git rebase -i` 직접
- vim 사용 익숙해야 함

**시나리오 3: 둘 다 옵션 A** (★ 추천)
- 09 가 나은 GUI UX 제공 (drag-drop)
- 10 이 진정한 터미널 제공
- 두 개의 인프라 — 큰 작업이지만 v1.x 본격 가치

→ 사용자가 §7 의 질문 4번에 답하면서 시나리오 결정.

---

End of plan documents. Final 다음 단계 → 메모리 갱신 + REVIEW.md 링크.
