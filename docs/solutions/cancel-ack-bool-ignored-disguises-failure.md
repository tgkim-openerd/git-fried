# Cancel-ack boolean 무시 → 진짜 실패가 "취소됨"으로 위장

- **일시**: 2026-06-16 (plan #45 code-review finding C-1/H-1, CRITICAL)
- **트리거**: 진행 중 git op(clone) 취소 핸들러가 `cancelGitOp(jobId): boolean` 의 반환값을 무시하고 무조건 `cloneCancelled = true` 를 세움
- **scope**: 취소/중단(abort/cancel) 가능한 비동기 작업을 가진 모든 프런트엔드 (특히 결과를 "취소됨 vs 실패" 로 분기하는 onError 핸들러)
- **confidence**: high (실 코드리뷰 finding + fix `a5039bb` 머지, 재리뷰 0)

## 증상

`CloneRepoModal` 에서 사용자가 진행 중인 clone 을 취소하면, 그 clone 이 **이미 실패했거나 완료된** 경우에도 UI 가 항상 "취소됨"(중립 메시지)으로 표시됐다. 즉 **진짜 실패(네트워크 오류, 인증 실패 등)가 "사용자가 취소함"으로 위장**되어 사용자에게 에러 피드백이 도달하지 못함.

추가로, 취소 핸들러가 async `@click` 인데 그 안의 IPC 가 reject 하면 **아무 데서도 잡히지 않고 조용히 사라짐** (Vue 의 `app.config.errorHandler` 는 async event-handler rejection 을 잡지 못함).

## 원인

취소 핸들러가 "취소 신호가 실제로 전달됐는지" 를 나타내는 **boolean 반환값을 버리고**, 취소 플래그를 무조건 세웠다:

```ts
// BEFORE — cancelGitOp 의 boolean 반환을 무시
async function cancelClone() {
  const id = cloneJobId.value
  if (id) {
    cloneCancelled.value = true        // ← 무조건 세움
    await cancelGitOp(id)              // ← 반환값(전달 여부) 버림 + reject 시 silent
  }
}
```

`cancelGitOp(id)` 은 **child kill 신호가 BE 에 실제로 전달됐는지** 를 `boolean` 으로 돌려준다.
- `true` = 취소 신호 전달됨 → 결과를 "취소됨"으로 처리하는 게 맞음
- `false` = job 이 이미 끝났거나(성공/실패) 미등록 → **취소가 아님**

그런데 호출부가 반환을 무시하고 `cloneCancelled = true` 를 항상 세우니, `false` 케이스(이미 실제 에러로 끝난 clone)에서도 `onError` 가 "취소됨" 중립 분기로 들어가 **진짜 에러를 은폐**.

두 번째 결함: async event handler 의 rejection 은 Vue 전역 errorHandler 가 못 잡으므로, try/catch 없이 `await` 하면 실패가 어디에도 surface 되지 않음.

## 해결

반환 boolean 으로 분기 + async rejection 직접 catch/surface (`a5039bb`):

```ts
// AFTER
async function cancelClone() {
  const id = cloneJobId.value
  if (!id) return
  // cancelGitOp 은 취소 신호가 실제 전달됐는지 boolean 을 반환한다.
  // true 일 때만 cloneCancelled 를 세워 onError 가 "취소됨"(중립)으로 표시.
  // false(이미 완료/미등록)면 플래그를 세우지 않아 진짜 결과(성공/실제 에러)가 그대로 surface.
  try {
    if (await cancelGitOp(id)) {
      cloneCancelled.value = true
    }
  } catch (e) {
    toast.error('클론 취소 실패', describeError(e)) // async @click rejection 직접 surface
  }
}
```

핵심: **상태 플래그(cloneCancelled)를 "신호 전달 성공" 조건 안쪽에서만 세운다.** 그래야 "취소 시도했지만 이미 실패로 끝난" 경우가 취소로 위장되지 않는다.

## 예방

- **취소/중단 API 가 의미 있는 값(boolean/result)을 반환하면 반드시 분기하라.** `void` 처럼 버리면 "실패가 취소로 위장" 또는 그 반대(취소가 실패로 표시)가 발생. 무조건 세우는 상태 플래그를 의심하라.
- **"취소됨 vs 실패" 를 구분하는 onError 분기가 있으면**, 그 구분의 입력(cancel 플래그)이 **실제 취소 신호 전달 여부**에 묶여 있는지 확인. 사용자가 버튼을 눌렀다는 사실 ≠ 취소가 성사됐다는 사실.
- **Vue 의 async `@click`/event handler 는 try/catch 로 직접 감싸 surface.** 전역 `errorHandler` 는 동기 렌더/watcher 에러는 잡지만 async event-handler rejection 은 못 잡는다. (단건 API 의 일반 호출은 interceptor 가 처리하므로 try/catch 불필요 — 이 예외는 "event-handler 경계 + 복구/후속 동작" 이 있을 때)
- code-review 시 **"무조건 true 로 세우는 상태 플래그 + 바로 위/아래의 버려진 반환값"** 조합을 silent-failure 적색 신호로 본다.

## 관련 문서

- 토킷 글로벌 solution `better-auth-withdraw-resign-failure-path-guard` (`~/.claude/docs/solutions/`) — **`void` 반환** 변형: 파괴적 단계가 `void` 라 호출부가 실패를 못 봐 다음 단계 진행. 본 건은 "boolean 을 반환하는데 호출부가 버린" 변형 — 같은 축(실패 전파 누락), failure-path-first 설계 원칙 공유.
- 토킷 글로벌 solution `image-upload-resize-undercuts-backend-minsize-silent-drop` — partial-success 200 `{failed[]}` 를 클라가 무시하는 silent-drop (동류: consumer 가 결과 신호 무시).
- 글로벌 CLAUDE.md pitfall: "다단계 파괴적 흐름은 failure-path-first + `void` 반환 금지", "단건 API 호출 try/catch 금지(interceptor 처리)" — 본 건은 그 예외 경계(async event-handler).
