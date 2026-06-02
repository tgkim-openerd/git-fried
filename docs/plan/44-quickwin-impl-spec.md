# Plan #44 Quick-win 구현 Spec (14:00 Codex 페어 세션용 prep)

> Claude 가 14:00 전 준비 (2026-06-02 13:5x). 각 fix 의 **검증된 현재 코드 + 정확한 제안 변경 + 테스트 계획**. 2시 Codex 세션은 이 spec 을 검토+적용만 하면 됨.
>
> **Baseline (Claude 측정)**: vitest **912/912 pass (91 files)**, 24.2s. dev server `localhost:1420` (devMock) 가동 중. scope = 아래 5건만 (임의 확장 금지). devMock detail/AI fixture keep.

---

## F3 — repositories "기타" 그룹 ×3 분리 버그 (HIGH)

**파일**: `apps/desktop/src/composables/useSidebarGroups.ts:77-98` (groups computed)

**현재 코드 (검증)**:
```ts
function groupKey(r: Repo): string {
  if (groupMode.value === 'org') return r.forgeOwner ?? '__no-org__'
  if (groupMode.value === 'forge') { /* Gitea/GitHub/Remote/Local-only */ }
  return parentDirName(r.localPath) ?? '__solo__'   // ← dir 모드: singleton 마다 다른 key
}
const groups = computed<readonly RepoGroup[]>(() => {
  const map = new Map<string, Repo[]>()
  for (const r of list) { const k = groupKey(r); ...map.get(k).push(r) }
  const result: RepoGroup[] = []
  for (const [key, repoList] of map.entries()) {
    const isSolo = groupMode.value === 'forge' ? false
      : key === '__solo__' || key === '__no-org__' || repoList.length === 1
    result.push({ key, label: isSolo ? null : key, repos: repoList })  // ← isSolo 마다 별도 그룹 (label=null="기타")
  }
  ...
})
```

**근본 원인**: dir 모드에서 parentDirName 이 서로 다른 singleton repo 들이 각각 다른 `key` → 별도 그룹. 각 그룹 `repoList.length===1` → `isSolo` → `label:null` → repositories.vue 가 "기타" 로 렌더 → **"기타(1)" ×N**.

**제안 변경**: groups computed 후처리에서 `isSolo` 그룹 전부를 단일 `__misc__` 그룹으로 병합:
```ts
const labeled: RepoGroup[] = []
const miscRepos: Repo[] = []
for (const [key, repoList] of map.entries()) {
  const isSolo = groupMode.value === 'forge' ? false
    : key === '__solo__' || key === '__no-org__' || repoList.length === 1
  if (isSolo) miscRepos.push(...repoList)
  else labeled.push({ key, label: key, repos: repoList })
}
if (miscRepos.length) labeled.push({ key: '__misc__', label: null, repos: miscRepos })
// forge 모드 고정순서 로직은 isSolo=false 라 영향 없음 — 기존 정렬 유지
```
→ 결과: 모든 singleton 이 하나의 "기타(N)" 그룹. (forge 모드는 isSolo 항상 false 라 무변경.)

**테스트**: useSidebarGroups 단위 테스트 존재 시 "dir 모드 singleton 3개 → 그룹 1개(label null, repos 3)" 케이스 추가. 화면: /repositories 에서 "기타" 헤더 1개 + count 3 확인 (재캡처).

---

## F5 — Command Palette raw command-id leak (MED)

**파일**: `apps/desktop/src/components/CommandPalette.vue:181`

**현재 (검증)**: `<span class="text-[10px] text-muted-foreground">{{ c.hint || c.id }}</span>`

**제안**: `{{ c.hint || '' }}` (hint 없으면 우측 빈칸 — 내부 id `repo.unselect`/`repo.tab.close-others`/`navigate /settings` 노출 제거).
+ `apps/desktop/src/locales/ko.json` 의 개발용 hint 정리: "invalidate everything" 등 영문 dev 문자열 → 사람친화 문구 또는 제거 (Codex 가 ko.json:1657-1711 영역 지목). 단축키가 있는 command 는 hint 에 단축키 표기 유지.

**테스트**: useCommandCatalog.test.ts 에 "hint 없는 command 는 빈 문자열 표시" assertion. 화면: ⌘P 팔레트에서 우측 컬럼에 id 안 보임 확인.

---

## F2 — CJK 라벨 2줄 wrap (HIGH)

**파일 A**: `apps/desktop/src/components/ActiveRepoQuickActions.vue:116,121,126`
- 현재: `<div class="grid grid-cols-5 gap-1">` + button `px-1 py-1 text-[10px]` + `<span class="leading-tight">{{ t(qt.labelKey) }}</span>`
- "브랜치"(CJK 3자)가 좁은 5-col 셀에서 2줄 wrap.
- **제안**: label span 에 `whitespace-nowrap` 추가 → `<span class="leading-tight whitespace-nowrap">`. (overflow 시 truncate 고려: `truncate` 병용 가능하나 5 라벨 모두 짧아 nowrap 만으로 1줄 유지.)

**파일 B**: `apps/desktop/src/pages/settings.vue:243` (nav `w-40` 고정폭) + 289 (라벨 렌더)
- "에디터 / 터미널 (★ AI CLI)", "외부 도구 연결 (v0.5 예정)" 2줄.
- **제안**: nav 항목에 `truncate` + `:title` tooltip (전체 라벨 hover 표시), 또는 nav 폭 `w-40`→`w-52`. truncate+title 권장 (폭 확장은 메인 영역 침범).

**테스트**: 화면 재캡처 — sidebar quick-action 5버튼 행 높이 균일(1줄) + settings nav 2줄 wrap 해소 확인.

---

## B5 — useContextMenu submenu focus desync 버그 (HIGH, 실제 defect)

**파일**: `apps/desktop/src/composables/useContextMenu.ts:213-233`

**현재 (검증)**: `submenuFocusedIndex` 는 **visible index** (moveSubFocus 가 `% visibleTotal`). Enter(L249-251)는 `visibleSub[submenuFocusedIndex]` 로 올바름. 그러나 `focusSubMenuItem(rawIdx)` (L222-233)는 인자를 **raw index** 로 보고 raw→visible 재변환 → **double-conversion** → divider 선행 시 focus ring 이 Enter 실행대상보다 이른 항목에 표시 (see-one/activate-another desync).

**제안**: `focusSubMenuItem` 가 visible index 를 직접 받게 통일 (재변환 제거):
```ts
function focusSubMenuItem(visIdx: number) {   // visIdx = visible index (submenuFocusedIndex 와 동일 공간)
  void nextTick(() => {
    const buttons = submenuRef.value?.querySelectorAll<HTMLButtonElement>('[data-ctx-sub-item]')
    buttons?.[visIdx]?.focus()   // [data-ctx-sub-item] 은 visible 만 렌더되므로 직접 인덱싱
  })
}
```
(moveSubFocus 의 `focusSubMenuItem(submenuFocusedIndex.value)` 호출은 그대로 — 이제 visible index 일치.)

**테스트**: useContextMenu 단위 테스트에 "submenu 에 divider 선행 항목 ArrowDown 후 Enter → focus ring 항목 == 실행 항목" 케이스. (divider 포함 submenu fixture 필요.)

---

## A6 — closeAllModals 가 compareOpen 미닫음 (MED, Codex-only)

**파일**: `apps/desktop/src/composables/useAppModals.ts:47-54`

**현재 (검증)**: closeAllModals 가 7 modal(syncTemplate/bisect/reflog/repoSwitcher/createPr/help/commitSearch) close, **compareOpen(:31) 누락**.

**제안**: `function closeAllModals()` 에 `compareOpen.value = false` 한 줄 추가.

**테스트**: useAppModals 테스트에 "openCompare 후 closeAllModals → compareOpen false" assertion. 화면: Compare 열고 ⌘W → 닫힘 확인.

---

## 검증 계획 (구현 후)

1. `bun run --cwd apps/desktop test` — 912 → 912+신규 유지 (회귀 0).
2. `bun run --cwd apps/desktop typecheck` + lint.
3. dev server(localhost:1420) 재캡처: F3(기타 1그룹) / F2(라벨 1줄) / F5(palette 우측 id 제거) — before/after 비교 (`docs/ux-eval/audit-2026-06-02/` 와 대조).
4. commit: CLAUDE.md 준수 (>3 file 시 논리 단위 분할, --no-verify 금지, Co-Authored-By/Generated 푸터 금지). 개인 프로젝트라 main 직접 OK.

---

## F1 언어 일관성 — 정책 결정 prep (Phase F, 2시 scope 제외 / 사용자 결정 대기)

> F1 은 정책 결정 선행 필요. 아래는 결정용 인벤토리.

**하드코딩 영어 (i18n key 없음 — repositories.vue)**:
- `:183` `<h1>Repository Management</h1>`
- `:192` `📂 Browse` / `:200` `⬇ Clone`

**ko.json 값이 영어 (Codex 지목 ko.json:763-772 settings nav)**: repoSpecific="Repository-Specific" / conflictPrevention="Conflict Prevention" / commit / issueTracker="Issue Tracker" / gitHooks="Git Hooks" / sparseCheckout="Sparse Checkout" / ui="UI Customization" / general / about

**view-tab 라벨**: 그래프/브랜치(KO) + Stash/Sub/LFS/PR/WT(EN/축약) 혼용

**의도적 영어 (브랜드/기술용어 — 유지 권장)**: Launchpad, Gitea, GitHub, LFS, PR, AI CLI, SSH, GPG

**정책 옵션 (사용자 결정)**:
- (A) 전면 한글화: Repository Management→저장소 관리, Browse→찾아보기, Clone→복제, Conflict Prevention→충돌 예방, UI Customization→UI 커스터마이징, General→일반, About→정보, Issue Tracker→이슈 트래커, Sparse Checkout→스파스 체크아웃. 브랜드/기술약어(Launchpad/LFS/PR/Gitea/GitHub)만 영어 유지.
- (B) 괄호 병기: "충돌 예방 (Conflict Prevention)" 형태.
- (C) 현행 유지 (기술 친화 — 단 일관성 낮음).
→ 권장: (A) — Korean-first 정체성 정합, 브랜드/약어만 예외. 결정 시 별도 sprint (i18n key 추가 + 값 번역, effort S-M).
