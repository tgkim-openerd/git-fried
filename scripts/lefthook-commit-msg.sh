#!/usr/bin/env bash
# lefthook commit-msg hook — Conventional Commits 형식 + Claude attribution 차단
# 호출: bash scripts/lefthook-commit-msg.sh <commit-msg-file>
set -euo pipefail

msg_file="${1:?usage: $0 <commit-msg-file>}"
msg="$(cat "$msg_file")"

if printf '%s\n' "$msg" | grep -qE 'Co-Authored-By: Claude|Generated with \[Claude Code\]'; then
  echo "[lefthook] commit message 에 금지된 trailer/footer 가 포함됨 (Claude attribution)" >&2
  exit 1
fi

first_line="$(printf '%s\n' "$msg" | head -n1)"
if ! printf '%s\n' "$first_line" | grep -qE '^(feat|fix|chore|docs|refactor|perf|test|ci|build|style|revert)(\([^)]+\))?!?:[[:space:]]+\S'; then
  echo "[lefthook] 첫 줄이 Conventional Commits 형식이 아님: type(scope)?: subject" >&2
  echo "[lefthook] 첫 줄: $first_line" >&2
  exit 1
fi

exit 0
