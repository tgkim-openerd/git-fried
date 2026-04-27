# PR

## Summary

<!-- 1~3줄. 변경 의도 + 영향 범위 -->

## Plan reference (선택)

<!-- 해당 plan 번호 / §번호. 예: docs/plan/14 §A1 -->

## 검증

<!-- 모두 체크되어야 머지 가능 -->

- [ ] `bun run typecheck` — 0 에러
- [ ] `bun run lint` — 0 에러
- [ ] `cargo test --lib` — 모두 pass (신규 회귀 테스트 추가 시 +N)
- [ ] `cargo clippy --all-targets -- -D warnings` — 통과
- [ ] 한글 round-trip 회귀 (해당 시) — `docs/plan/06 §회귀 차단` 정합
- [ ] 사용자 본인 레포 1개 dogfood 검증 (해당 시)
- [ ] 메모리 baseline +20% 이내 (큰 변경 시 — `docs/plan/20`)

## ⚠️ Commit message 정합 (CLAUDE.md 정합)

- [ ] 한글 메시지는 HEREDOC + `'EOF'` 사용 (단일 라인 `-m "..."` 금지)
- [ ] **`Co-Authored-By: Claude` trailer 미포함**
- [ ] **`Generated with Claude Code` / `🤖` 푸터 미포함**

## 변경 / 추가 / 삭제

<!-- 핵심 파일 + 변경 요약 -->

## 회귀 위험 / 미결정 (선택)

<!-- 알려진 위험 또는 후속 sprint 후보 -->
