# Multi-session git race condition — 다른 session 의 git operation 이 본 session working tree wipe

- **일시**: 2026-05-18 (Sprint c95+ 끝점)
- **트리거**: ~/.claude toolkit 측 commit 진행 중 외부 session 의 `cherry-pick / amend / reset / checkout` 으로 모든 변경 lost
- **scope**: Claude Code multi-session 환경 (특히 ~/.claude toolkit 같은 공유 repo)
- **confidence**: high (실 incident 확보, reflog 증거)

## 증상

Claude Code session 에서 ~/.claude toolkit repo 변경 (solution 신규 + skill 보강 + INDEX/STATS 갱신) 진행 중 다음 sequence 발생:

```text
[Session A — 본 작업] Write solution + Edit skill + build INDEX + Edit README STATS → ready to commit
[Session B — 외부]    backup/scroll-local-7114d2a checkout → cherry-pick → amend → reset to origin/main → main checkout
[Session A 다시 작업]  git status → 'M CLAUDE.md' 만 (본 session 의 모든 변경 lost)
```

`git reflog` 증거:
```
HEAD@{0}: commit (amend): feat(solutions): 3 scroll system 솔루션 (from git-fried c77)
HEAD@{1}: cherry-pick
HEAD@{2}: checkout: moving from main to feat/scroll-system-3-solutions
HEAD@{3}: reset: moving to origin/main
HEAD@{4}: checkout: moving from backup/scroll-local-7114d2a to main
```

### Validator race symptoms

Session A 의 pre-commit hook 가 validator 돌릴 때마다 다른 결과:
- 1차: 0 errors / 111 warnings
- 2차: 1 error V37 (cross-link broken count 11 vs baseline 10)
- 3차: 6 errors V24 (STATS counter 모두 stale: agents 57≠59, skills 211≠226, commands 37≠38, solutions 159≠192, hooks 14≠15, scripts 83≠94)
- 4차: 2 errors V24 + V7 (solutions declared 192 ≠ actual 191 + 잘못된 related-agent reference 의 stale entry)
- → README.md STATS marker 가 외부 session 의 reset 으로 stale value 와 current value 사이 flicker

## 원인

### 근본 원인 1 — Multi-session 의 shared toolkit repo

`~/.claude` 는 사용자 personal Claude Code config + skill / agent / solution 저장소. **multiple Claude Code session 이 같은 working tree 공유** (단일 git repo). 한 session 의 `git checkout / reset / cherry-pick / amend` 가 다른 session 의 unstaged 변경 영구 lost.

### 근본 원인 2 — Pre-commit hook 의 validator 가 race-aware 아님

Toolkit 의 pre-commit hook 가 `scripts/validate-toolkit.js` 통해 V7 (frontmatter) / V18 (INDEX drift) / V24 (STATS marker) / V37 (cross-link) 검증. 검증 중 외부 session 의 git operation 으로 file 이 reset 되면:
- V24 stale STATS marker (방금 갱신한 값이 reset 됨)
- V18 INDEX drift (방금 build 한 INDEX 가 reset)
- → commit 계속 차단되며 fix → race → fix → race 반복

### 근본 원인 3 — Race detection 메커니즘 부재

git 자체는 working tree race detect 메커니즘 없음 (`git status -s` 만 보여줌). Pre-commit hook 가 "이 commit 의 baseline 이 의도된 baseline 인가" 검증 안 함.

## 해결

### 즉시 회피 — Race 영향 없는 위치로 작업 이동

Toolkit (`~/.claude`) 측 변경이 race 영향 받으면 → **프로젝트 측 (git-fried 등) 으로 fallback**:
- Solution 기록 = `~/.claude/docs/solutions/` 대신 `docs/solutions/` (프로젝트 내)
- Memory 갱신 = `~/.claude/projects/{path}/memory/` (별도 path, race 무영향 영역 확인 후)

다음 session 에서 toolkit 측 sync:
1. `git status -s` clean 확인 (외부 session 작업 종료)
2. 본 sprint 의 git-fried 측 solution 을 toolkit 측 으로 mirror
3. INDEX/STATS sync + commit

### 영구 해결 — Feature branch 격리

Toolkit 측 큰 작업 (solution 신규 + skill 보강) 시작 전:

```bash
# 1. 즉시 feature branch 생성 (외부 session 의 main reset 무영향)
cd ~/.claude
git switch -c feat/{topic-name}

# 2. 작업 진행 (write / edit / build / validate)
# ... 자유롭게 진행

# 3. 작업 완료 시 main rebase + push
git switch main
git pull --rebase origin main
git rebase feat/{topic-name}
git push
```

장점: feature branch 의 working tree 는 다른 session 의 main checkout 으로 reset 안 됨.

### Defensive — 작업 시작 시 baseline snapshot

```bash
# 작업 시작 시점 reflog mark
echo "$(date) START sprint" >> .git/HEAD-snapshot
git rev-parse HEAD > .git/baseline-sha

# 작업 중간 race 의심 시 baseline 비교
[[ "$(git rev-parse HEAD)" == "$(cat .git/baseline-sha)" ]] || echo "RACE DETECTED"
```

## 예방

### Rule 1 — Toolkit 측 큰 작업은 feature branch 우선

신규 solution 1+ 또는 skill 100+ LOC 보강 시 main 직접 작업 금지. Feature branch 격리:

```bash
git switch -c feat/multimodal-vision-solution
# 작업
git switch main && git rebase feat/multimodal-vision-solution
```

### Rule 2 — Multi-session 환경 인식

`~/.claude` 와 같은 shared repo 작업 시 다른 session 의 작업 진행 가능성 항상 가정. 작업 시작 시:
- `git reflog | head -5` 로 다른 session 작업 흔적 확인
- 외부 작업 active 면 본 session 작업 보류 또는 격리

### Rule 3 — Project 측 fallback

Toolkit race condition 의심 시:
1. 프로젝트 측 (git-fried `docs/solutions/`) 으로 임시 기록
2. 다음 session 또는 외부 session 정리 후 toolkit 측 mirror
3. memory next_session_entry.md 에 pending sync 명시

### Rule 4 — Pre-commit validator 의 race-aware 보강 (별도 sprint)

`scripts/validate-toolkit.js` 가 다음 detect:
- V24 STATS marker 와 actual count 의 drift 가 본 commit 의 영향인지 외부 reset 의 영향인지 구분
- INDEX rebuild 후 즉시 검증 (race window 최소화)
- Race detect 시 user 명시 "외부 session 작업 진행 중, retry 권고"

## 관련 문서

- `multimodal-vision-cross-validation-false-positive.md` — 본 sprint 의 toolkit sync 영구 fail 사례 (Stage 2/3 race lost)
- `codex-background-shared-session-drift.md` — Codex multi-session shared session 영역의 유사 race (sprint c91~c93)
- `~/.claude/projects/d--01-Work-08-rf-git-fried/memory/next_session_entry.md` — 다음 session 진입점 (본 race 의 정리 + toolkit sync 위임)
