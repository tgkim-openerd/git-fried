# 16. Line-level stage v2 — Sprint H 후속 작업 plan

작성: 2026-04-27 / 트리거: Sprint H (`a0dd950` Hunk-level stage) 후속 — `parseDiff.ts` modified 상태로 작업 진행 중

> **목적**: 12 plan v3 §15.A 의 Line-level stage 를 정밀 spec 으로 구체화. CodeMirror selection 또는 라인 옆 checkbox 로 라인 선택 → 선택 라인만 추출 → minimal patch 재조립 → `git apply --cached`.
>
> **연계**: Sprint H 의 [`HunkStageModal.vue`](apps/desktop/src/components/HunkStageModal.vue), [`parseDiff.ts`](apps/desktop/src/utils/parseDiff.ts), [`buildHunkPatch`](apps/desktop/src/utils/parseDiff.ts), 12 plan v3 §15.A.

---

## 1. 30초 요약

| 항목 | 내용 |
| --- | --- |
| **scope** | StatusPanel 의 unstaged 파일 → "Line stage" 모드. line 선택 → patch 재조립 → `git apply --cached`. 역방향 (staged → unstage) 도 동일 로직 |
| **신규 코드** | `buildLinePatch(hunks, selectedLineIds)` (parseDiff.ts) + `LineStageModal.vue` 또는 HunkStageModal 확장 + IPC 신규 0 (기존 `apply_patch` / `stage_partial` 재사용 검증) |
| **patch math 핵심** | 선택 외 `+` → skip / 선택 외 `-` → context / hunk 헤더 a/b/c/d 재계산 |
| **회귀 시나리오** | 한글 path / multi-line 인접+이격 / 다중 hunk 동시 / 마지막 라인 newline / EOL CRLF / binary 거부 |
| **작업량** | M~L (4~12h) — patch math 까다로움. AI pair 보정 ~1~2h |
| **위험** | `git apply --cached` 실패 시 사용자에게 자세한 에러 표시 필요. silent 실패 차단 |

---

## 2. 데이터 모델

### 2-1. 기존 Hunk 구조 (Sprint H, parseDiff.ts)

```ts
// 추정 — 실제 read 후 정합 검증 필요
export interface Hunk {
  oldStart: number   // a (old start line)
  oldCount: number   // b (old count)
  newStart: number   // c (new start line)
  newCount: number   // d (new count)
  header: string     // "@@ -a,b +c,d @@ section"
  lines: Line[]
}

export interface Line {
  kind: ' ' | '+' | '-'   // context / addition / deletion
  content: string         // raw line (no newline)
  oldLineNo?: number      // present for ' ' and '-'
  newLineNo?: number      // present for ' ' and '+'
}
```

### 2-2. 신규 Selection 모델

```ts
// 신규 in parseDiff.ts 또는 useLineStage.ts
export interface LineId {
  fileIndex: number   // 다중 파일 선택 시
  hunkIndex: number
  lineIndex: number
}

// 또는 단순화: 'fileIndex:hunkIndex:lineIndex' 문자열 key
export type LineKey = string  // `${fileIndex}:${hunkIndex}:${lineIndex}`

export interface LineSelection {
  selected: Set<LineKey>
}
```

선택 가능한 라인 = `+` 또는 `-` 만 (context ` ` 는 자동 포함 — 선택 안 함). UI 에서 ` ` 라인은 disabled.

---

## 3. patch math 알고리즘

### 3-1. 핵심 규칙

각 hunk 의 line 을 순회하며 selection 에 따라 변환:

| 원본 line | selection | 출력 line | newCount delta |
| --- | --- | --- | --- |
| `+content` | 선택 ✓ | `+content` (그대로) | +1 |
| `+content` | 선택 ✗ | (skip — patch 에 안 넣음) | 0 |
| `-content` | 선택 ✓ | `-content` (그대로) | 0 |
| `-content` | 선택 ✗ | ` content` (context 변환, ` ` prefix) | +1 |
| ` content` | (해당 없음) | ` content` (그대로) | +1 |

→ `oldCount` 는 변하지 않음 (원본 파일의 라인 수 그대로). `newCount` 는 위 표대로 재계산.

### 3-2. hunk 헤더 재계산

```ts
function rebuildHunkHeader(hunk: Hunk, newCount: number): string {
  // oldStart/oldCount 는 그대로
  // newCount 만 변경
  const a = hunk.oldStart
  const b = hunk.oldCount
  const c = hunk.newStart
  const d = newCount  // 재계산된 값

  // 단일 라인이면 count 생략 형식 ("-a +c" 가능, 단순화 위해 항상 ",b" 형식 유지)
  const sectionTail = hunk.header.match(/@@\s*-\d+(?:,\d+)?\s*\+\d+(?:,\d+)?\s*@@\s*(.*)$/)?.[1] ?? ''
  return `@@ -${a},${b} +${c},${d} @@${sectionTail ? ' ' + sectionTail : ''}`
}
```

### 3-3. `buildLinePatch` 시그니처

```ts
export function buildLinePatch(
  fileDiffHeader: string,    // "diff --git a/path b/path\nindex ...\n--- a/path\n+++ b/path"
  hunks: Hunk[],
  selectedLineKeys: Set<LineKey>,
  fileIndex: number,
): string {
  const out: string[] = [fileDiffHeader]

  for (let hi = 0; hi < hunks.length; hi++) {
    const hunk = hunks[hi]
    const transformedLines: string[] = []
    let newCount = 0

    for (let li = 0; li < hunk.lines.length; li++) {
      const line = hunk.lines[li]
      const key = `${fileIndex}:${hi}:${li}`
      const selected = selectedLineKeys.has(key)

      if (line.kind === ' ') {
        transformedLines.push(' ' + line.content)
        newCount++
      } else if (line.kind === '+') {
        if (selected) {
          transformedLines.push('+' + line.content)
          newCount++
        }
        // else: skip
      } else if (line.kind === '-') {
        if (selected) {
          transformedLines.push('-' + line.content)
          // newCount 변화 없음
        } else {
          transformedLines.push(' ' + line.content)
          newCount++
        }
      }
    }

    // 이 hunk 가 선택된 line 0개면 전체 skip (patch 에 빈 hunk 안 넣음)
    const hasAnySelected = hunk.lines.some((line, li) => {
      const key = `${fileIndex}:${hi}:${li}`
      return (line.kind === '+' || line.kind === '-') && selectedLineKeys.has(key)
    })
    if (!hasAnySelected) continue

    out.push(rebuildHunkHeader(hunk, newCount))
    out.push(...transformedLines)
  }

  return out.join('\n') + '\n'
}
```

### 3-4. 다중 파일 처리

여러 파일에 걸쳐 선택된 경우, 각 파일마다 `buildLinePatch` 호출 후 결과 concatenate:

```ts
export function buildMultiFileLinePatch(
  files: { header: string; hunks: Hunk[] }[],
  selectedLineKeys: Set<LineKey>,
): string {
  return files
    .map((f, i) => buildLinePatch(f.header, f.hunks, selectedLineKeys, i))
    .filter((p) => p.split('\n').length > 1)  // header 만 있는 빈 patch 제외
    .join('')
}
```

---

## 4. UI 통합

### 4-1. 진입점

(a) **HunkStageModal 확장** (권장 — Sprint H 의 modal 위에 line 모드 추가)

```vue
<HunkStageModal>
  <header>
    <button :class="{ active: mode === 'hunk' }" @click="mode = 'hunk'">Hunk</button>
    <button :class="{ active: mode === 'line' }" @click="mode = 'line'">Line</button>
  </header>
  <main>
    <!-- mode === 'hunk' -->
    <HunkList v-if="mode === 'hunk'" :hunks="hunks" v-model:selectedHunks="selH" />
    <!-- mode === 'line' -->
    <LineList v-else :hunks="hunks" v-model:selectedLines="selL" />
  </main>
  <footer>
    <button @click="apply">Apply ({{ selectedCount }} {{ mode }}{{ selectedCount > 1 ? 's' : '' }})</button>
  </footer>
</HunkStageModal>
```

(b) **CodeMirror selection 기반** (옵션, 더 직관적이지만 복잡)

DiffViewer 의 split / inline mode 에서 텍스트 선택 → 선택된 라인 수집 → `buildLinePatch` 호출. 다중 파일은 어렵.

→ **권장 = (a) HunkStageModal mode 토글**. CodeMirror 통합은 follow-up 으로.

### 4-2. LineList 컴포넌트 spec

```vue
<template>
  <div class="font-mono text-xs">
    <div v-for="(hunk, hi) in hunks" :key="hi" class="border-b border-border">
      <header class="bg-muted px-2 py-1 text-muted-foreground">
        {{ hunk.header }}
      </header>
      <ul>
        <li
          v-for="(line, li) in hunk.lines"
          :key="li"
          class="flex items-start gap-2 px-2"
          :class="lineClass(line)"
        >
          <input
            v-if="line.kind !== ' '"
            type="checkbox"
            :checked="selectedLines.has(key(hi, li))"
            @change="toggle(hi, li)"
          />
          <span v-else class="w-3" />
          <span class="w-10 text-right text-muted-foreground">
            {{ line.oldLineNo ?? '' }}
          </span>
          <span class="w-10 text-right text-muted-foreground">
            {{ line.newLineNo ?? '' }}
          </span>
          <span class="w-3">{{ line.kind }}</span>
          <span class="flex-1 whitespace-pre">{{ line.content }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
```

색상:
- `+` 라인: `bg-green-500/10`
- `-` 라인: `bg-red-500/10`
- ` ` 라인: 기본 (선택 불가, opacity 50)
- 선택된 라인: `border-l-2 border-primary`

### 4-3. 키보드 인터랙션

- `↑` `↓`: 활성 라인 이동 (`+` `-` 만)
- `Space`: 활성 라인 toggle
- `⇧↑` `⇧↓`: range 확장
- `⌘A`: 모든 `+/-` 선택
- `⌘D`: 선택 해제
- `Enter`: Apply
- `Esc`: Modal 닫기

---

## 5. Backend / IPC

### 5-1. 기존 IPC 재사용 검증

Sprint H 의 hunk apply 가 어떤 IPC 사용하는지 확인 필요:

```bash
grep -rE "apply_patch|stage_partial|invoke.*patch" apps/desktop/src/utils/parseDiff.ts apps/desktop/src/components/HunkStageModal.vue apps/desktop/src/api/git.ts
```

예상:
- 기존 IPC `apply_patch(repo_id, patch_text, cached: bool)` 가 있음 → 그대로 재사용
- 또는 `stage_partial(repo_id, patch_text)` (cached=true 고정)

→ **신규 IPC 0건** (Sprint H 가 이미 만든 것 재사용).

### 5-2. Validation 단계

apply 전에 dry-run:

```rust
// apps/desktop/src-tauri/src/git/stage.rs (또는 기존 위치)
pub async fn validate_patch(repo_path: &Path, patch: &str) -> AppResult<()> {
    let mut tmp = tempfile::NamedTempFile::new()?;
    tmp.write_all(patch.as_bytes())?;

    let out = git_run(repo_path, &["apply", "--cached", "--check", tmp.path().to_str().unwrap()], &Default::default()).await?;
    if !out.success {
        return Err(AppError::Git(format!("patch invalid:\n{}", out.stderr)));
    }
    Ok(())
}
```

→ apply 전에 항상 호출. 실패 시 사용자에게 stderr 표시 (toast 또는 modal).

---

## 6. 회귀 시나리오 (회귀 차단 체크)

### 6-1. cargo unit test (`#[cfg(test)]` in parseDiff or git/stage.rs Rust 측 검증)

- [ ] **단일 + 라인 선택** — 1개 hunk 의 1개 `+` 선택 → patch apply 성공 → staged 영역에 1줄만 추가
- [ ] **단일 - 라인 선택** — 1개 hunk 의 1개 `-` 선택 → 1줄만 삭제 staged
- [ ] **인접 라인 선택** — `+` `+` `+` 3줄 연속 선택 → 3줄 staged
- [ ] **이격 라인 선택** — `+` (skip) `+` (skip) `+` 패턴 → 첫번째 `+` 와 세번째 `+` 만 staged
- [ ] **`+` `-` 혼합** — 1개 hunk 안에서 `-` 1줄 + `+` 1줄 선택 → 정확한 patch
- [ ] **다중 hunk** — 한 파일 내 hunk 2개에서 각각 선택
- [ ] **다중 파일** — 2 파일 동시 선택
- [ ] **빈 선택** — 0개 선택 시 apply 버튼 disabled
- [ ] **마지막 라인 newline** — `\n` 없는 마지막 라인 처리 (`\\ No newline at end of file`)
- [ ] **CRLF EOL** — Windows 환경에서 `\r\n` round-trip
- [ ] **한글 path** — `feature/한글.txt` round-trip
- [ ] **한글 content** — diff 내 한글 라인 stage round-trip
- [ ] **binary file** — `Binary files differ` 표시 — line stage 비활성화
- [ ] **선택 외 `-` → context 변환** — 정확히 ` ` prefix
- [ ] **hunk 헤더 a/b/c/d 재계산** — `@@ -10,5 +10,3 @@` 같은 형태로 정확

### 6-2. Vitest unit test (`buildLinePatch`)

```ts
// apps/desktop/src/utils/__tests__/parseDiff.test.ts (기존 + 추가)
describe('buildLinePatch', () => {
  it('single + line stages only that line', () => {
    const hunks = [{
      oldStart: 1, oldCount: 3, newStart: 1, newCount: 5,
      header: '@@ -1,3 +1,5 @@',
      lines: [
        { kind: ' ', content: 'a', oldLineNo: 1, newLineNo: 1 },
        { kind: '+', content: 'b1', newLineNo: 2 },
        { kind: '+', content: 'b2', newLineNo: 3 },
        { kind: ' ', content: 'c', oldLineNo: 2, newLineNo: 4 },
        { kind: ' ', content: 'd', oldLineNo: 3, newLineNo: 5 },
      ],
    }]
    const sel = new Set(['0:0:1'])  // first + only
    const patch = buildLinePatch('diff ...\n--- a/x\n+++ b/x', hunks, sel, 0)
    expect(patch).toContain('@@ -1,3 +1,4 @@')   // newCount = 4
    expect(patch).toContain('+b1')
    expect(patch).not.toContain('+b2')
  })
  // ... 다른 시나리오
})
```

### 6-3. E2E (옵션)

- 실제 repo 에서 commit 직전 dogfood — 한글 변경 / 다중 파일 / 인접+이격 모두

---

## 7. 작업 시간 단위 분해 (~1.5h AI pair)

| 시간 | 작업 |
| --- | --- |
| 0:00–0:20 | parseDiff.ts modified 상태 read + 기존 Hunk/Line 타입 검증, IPC 재사용 가능 여부 확인 |
| 0:20–0:50 | `buildLinePatch` 함수 작성 + 4 시나리오 Vitest 추가 |
| 0:50–1:10 | HunkStageModal 의 mode 토글 + LineList 렌더 |
| 1:10–1:30 | 키보드 인터랙션 (↑↓ Space 등) |
| 1:30–1:45 | `validate_patch` Rust 함수 + apply 전 dry-run + 에러 toast |
| 1:45–2:00 | 회귀 시나리오 12개 cargo + Vitest 추가, 통과 검증 |
| 2:00–2:15 | 한글 / EOL / binary edge case 회귀 |
| 2:15–2:30 | dogfood + REVIEW.md "Line-level stage v2 ✅" 갱신 |

→ 총 **~2.5h** (시간 단위 분해 기준).

---

## 8. 위험 / 미결정

| # | 항목 | 옵션 | 권장 |
| - | --- | --- | --- |
| 1 | UI 진입 — HunkStageModal 토글 vs CodeMirror selection | (a) HunkStageModal (b) CodeMirror | **(a) HunkStageModal** — 다중 파일 / 키보드 일관 |
| 2 | hunk 헤더 단일 라인 형식 (`@@ -a +c @@` count 생략) | 단순화 위해 항상 `,b` 포함 | git apply 가 양쪽 모두 받음 — 항상 `,b` 형식으로 단순 |
| 3 | binary file 처리 | 거부 vs hunk-level 만 허용 | **거부** — line 개념 없음 |
| 4 | 선택 외 `-` → context 변환 시 newLineNo 갱신 | 자동 | git apply 는 newLineNo 무시하므로 무시 가능 |
| 5 | apply 후 부분 unstage 도 같은 방식? | (a) 동일 로직 + cached 반대 (b) 별도 모드 | **(a) 동일 로직, `--reverse` flag** 추가 |

---

## 9. 검증 체크리스트 (PR 머지 직전)

- [ ] `bun run typecheck` 0 에러
- [ ] `bun run lint` 통과 (15 plan Sprint 1 완료 가정)
- [ ] `cargo test --lib` 통과 (74 → 신규 +N)
- [ ] `bunx vitest run` 통과 (parseDiff.test.ts 신규 12 시나리오)
- [ ] 한글 path 회귀 통과
- [ ] CRLF EOL 회귀 통과
- [ ] memory baseline +20% 이내
- [ ] commit message HEREDOC + `'EOF'`, `Co-Authored-By` 금지
- [ ] REVIEW.md "Line-level stage v2 ✅" 추가
- [ ] `docs/plan/12 §15.A` ✅ 표기 갱신

---

## 10. 다음 행동

1. **`parseDiff.ts` modified 상태 read** — 진행 중인 변경 파악 (`git diff apps/desktop/src/utils/parseDiff.ts`)
2. §3-3 의 `buildLinePatch` 시그니처 그대로 작성
3. §6-1 / §6-2 회귀 12 시나리오 추가
4. §8 미결정 5건 빠른 결정 (대부분 권장 채택)

---

다음 문서 → 작성 완료 후 `17-v1.x-roadmap.md` 진입 시
