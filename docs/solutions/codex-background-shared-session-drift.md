# Codex background Agent shared session drift — `/codex:rescue --wait` slash fallback

## 증상

- `Agent({ subagent_type: "codex:codex-rescue", run_in_background: true, prompt: "..." })` 으로 background spawn 시 `Codex Task started in the background as task-mpXXXXXX-XXXXXX. agentId: aXXXXXX...` return 받지만,
- 후속 polling (TaskOutput / Read `~/.codex/sessions/2026/MM/DD/rollout-*.jsonl` / `tasks/{agentId}.output`) 시 **결과가 다른 task 와 session share** 되어 git-fried audit 결과 누락 빈발.
- output 파일이 0 byte 또는 다른 무관한 task (예: iTruck APK / Nerdooicons 아이콘) 의 마지막 메시지로 차지됨.

## 실측 (ULTRAPLAN c82, 2026-05-14, 22 commit 세션)

| task ID | 의도 | 결과 |
|---|---|---|
| `task-mp4yop03` | /analyze Round 1 Codex Agent 4 | ✅ 정상 도착 (SEC-201 panic stderr + SEC-202 deep-link 발견) |
| `task-mp4z8bh8` | Plan Round 2 D 카테고리 audit | ❌ 0 byte output / session 다른 task 와 share |
| `task-mp51kqky` | Plan Round 5 Codex 재시도 | ❌ 0 byte / `windows sandbox: setup refresh failed exit code 1` |
| `task-mp53zjgg` | c82 audit (8 finding cross-validation) | ✅ 도착 (8/10 confidence + SAF-302 stdout PARTIAL 발견) |
| `task-mp554150` | consultation (7 priority + sprint 순서) | ✅ 도착 |
| `task-mp58kl7y` | /code-review Codex | ❌ shared session drift |

**Background 호출 신뢰성 ≈ 50% (3/6 성공)**.

## 원인

1. **Codex shared session runtime** — `/codex:setup --json` 의 `sessionRuntime: { mode: "shared", endpoint: "pipe:..." }` 로 본 Claude session 의 모든 Codex 호출이 **하나의 Codex runtime instance** 를 공유.
2. 같은 endpoint 에 동시 또는 연속 task 가 spawn 되면 Codex 측이 task ID 별 격리 안 함 → 마지막 task 의 messages 가 이전 task 의 jsonl 에 누적.
3. Sandbox 환경 (Windows) 실패 (`setup refresh failed`) 시 background 가 silent 0 byte 반환.

## 해결 — slash command fallback

`/codex:rescue --wait --effort high "<prompt>"` 슬래시 커맨드는:
- **사용자 trigger** 만 가능 (Claude 직접 호출 불가).
- 별도 Codex runtime instance 로 격리 → shared session drift 없음.
- ULTRAPLAN c82 의 R5 D 카테고리 audit 가 background 2회 실패 후 `/codex:rescue --wait` 로 정상 도착 (4 신규 finding + Claude finding 4건 정정).

## 권고 패턴

| 시나리오 | 권고 |
|---|---|
| 자동 trigger 필요한 multi-round audit (예: /analyze 4 agent) | Agent tool background 시도 + 실패 시 graceful fallback (Claude 단독 진행) — drift 통과 25~50% 가정 |
| 사용자 trigger 가능한 1회성 critical audit | `/codex:rescue --wait` 슬래시 권고 — 사용자에게 "Codex audit 추가 권고 시 슬래시 호출" 명시 |
| 다중 task 연속 spawn | 같은 fan-out 안에서는 `trigger_cap_applied` skip 적극 활용. 첫 1 task 만 spawn + 결과 도착 후 다음 task 결정 |
| session continuity (SendMessage continue) | agent ID 보존하되 shared session drift 위험 인지 — 마지막 메시지가 다른 task 일 가능성 항상 검증 |

## 검증 방법 (parent context)

```bash
# Codex session 의 마지막 message 가 본 task 의 의도 keyword 포함하는지 검증
grep '"type":"message"' ~/.codex/sessions/2026/MM/DD/rollout-{timestamp}*.jsonl \
  | tail -1 | python3 -c "
import sys, json
line = sys.stdin.read().strip()
obj = json.loads(line)
for c in obj.get('payload', {}).get('content', []):
    if c.get('type') in ('text', 'output_text'):
        t = c.get('text', '')
        if 'EXPECTED_KEYWORD' in t:
            print('TASK_MATCH:', t[:5000])
        else:
            print('DRIFT to other task:', t[:200])
"
```

`DRIFT to other task` 출력 시 본 task 결과 누락 — slash fallback 또는 retry.

## 토큰 절약 패턴

background polling 의 sleep loop (`until grep ... do sleep 5; done`) 가 cache miss 발생. 대신:
- 한 번에 다른 작업 진행 + Codex 자연 도착 대기
- 도착 안 하면 보고서에 "Codex bg 미도착" 명시 + slash fallback 사용자 권고

## Related

- [universal/dev/codex-cross-verification](~/.claude/skills/universal/dev/codex-cross-verification/skill.md) — 호출 경로 5종 매트릭스 (본 solution 반영 완료)
- ULTRAPLAN c82 sprint memory: [sprint_2026_05_14_c82_ultraplan](~/.claude/projects/d--01-Work-08-rf-git-fried/memory/sprint_2026_05_14_c82_ultraplan.md)
