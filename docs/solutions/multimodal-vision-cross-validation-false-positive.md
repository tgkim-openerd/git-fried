# Multimodal Vision 단독 분석 false positive (35% 오류율) — Codex cross-validation 필수

- **일시**: 2026-05-18 (Sprint c95+)
- **트리거**: GitKraken Desktop V2 baseline 캡처 (1738×1091 PNG) 분석
- **scope**: cross-project (Claude Code 의 multimodal vision 사용 전반)
- **toolkit sync 보류**: 본 solution 은 git-fried 측 우선 기록. ~/.claude/docs/solutions/ 측 sync 는 다음 session 의 첫 작업 (race condition 회피, [`multi-session-git-race-condition.md`](multi-session-git-race-condition.md) 참조)

## 증상

Claude 가 multimodal vision (Read tool 로 PNG 캡처 분석) 으로 desktop app UI 를 분석할 때, **단독 interpretation 이 false positive 다수 발생**.

git-fried Sprint c95+ GitKraken V2 baseline 분석 v0.1 에서 **20 단정 중 7 정정 (35% 오류율)**:

| # | Claude v0.1 단정 | Codex (`a64b02ce6b0c4a718`) 검증 | 영향 |
|---|---|---|---|
| 1 | Workspace folder list "argo/car/common/d2e/dr/..." visible | **REFUTED** — 실제 `LOCAL/REMOTE/WORKTREES/STASHES/CLOUD PATCHES/PULL REQUESTS/TEAMS` section + `chore/docs/feat/feature/fix/hotfix` 폴더 그룹 | SB-054 backlog 신규 → **폐기** |
| 2 | "Showing 100" branch limit indicator | **PARTIAL** — 실제 "Viewing 106" wording | SB-052 wording 정정 |
| 3 | List/Agents segmented control 미발견 | **CONFIRMED visible** (Codex CDX-V2-011) | 신규 발견 |
| 4 | Merge commit donut + avatar-centered marker 미언급 | **CONFIRMED visible** (Codex CDX-V2-004) | 신규 SB-XXX |
| 5 | Graph 곡선 lanes + tint bands + avatar nodes 미언급 | **CONFIRMED visible** (Codex CDX-V2-006) | 신규 SB-055 LARGE |
| 6 | HEAD indicator "● marker" 추정 | **REFUTED** — 실제 sidebar branch row checkmark | 보고서 정정 |
| 7 | Ref pill type color mapping (S3 brand) 이전 finding 그대로 인용 | **REFUTED** — V2 lane-following hue, type 분기 검증 안 됨 | 이전 microdiff 정합성 검증 영역 |

Cross-validation: Claude 20 단정 중 **11 CONFIRMED / 2 REFUTED / 3 PARTIAL / 4 INCONCLUSIVE**.

## 원인

### 근본 원인 1 — 검증 5필드 룰이 image 분석에 미적용

CLAUDE.md § Verification Before Reporting / § Coverage Claim Discipline 룰은:
- text 분석 (file content / grep 결과 / count 단정) 에 5필드 강제
- **image multimodal vision interpretation 에는 적용 룰 부재**

결과: vision 단정이 **명시적 verification 단계 우회**. "이미지에 X 가 보인다" → 즉시 보고서 / backlog / fix 권고.

### 근본 원인 2 — Vision interpretation 의 confidence-높음 like behavior

Claude vision 은 text 분석과 달리 **단정 톤이 confidence-높음 default**:
- 작은 UI element (예: 좌상단 List/Agents segmented control) 놓치는 **false negative**
- 비슷한 layout 영역 (예: workspace folder list vs section group) 오인 **false positive**
- 색상 / 폰트 / 픽셀 수치 — 추정 vs 실측 구분 모호

### 근본 원인 3 — 단일 model interpretation 의 학습 분포 bias

Claude 와 Codex 는 학습 분포 + vision encoder 가 다름. 같은 픽셀 영역 다른 interpretation:
- Claude 가 "argo/car/common/..." 으로 본 영역 → Codex 는 "LOCAL/REMOTE/WORKTREES/STASHES/CLOUD PATCHES/PULL REQUESTS/TEAMS section" 으로 봄
- 어느 쪽이 ground truth 인가는 사용자 직접 확인 또는 추가 model 의 majority vote 필요

## 해결

### Rule 1 — Vision finding 도 검증 5필드 명시

```markdown
- **claim**: "스크린샷 좌측 사이드바 최상단에 List/Agents segmented control 이 visible"
- **verification_source**: PNG 파일 경로 + image region 명시 (예: "Left panel, Y=120~150 좌표")
- **verification_result**: literal pixel pattern (예: "두 segmented button, 'List'/'Agents' label, active state border")
- **verdict**: CONFIRMED | REFUTED | INCONCLUSIVE | PARTIAL
- **confidence**: certain | likely | uncertain
```

### Rule 2 — INCONCLUSIVE 라벨 적극 사용

다음 영역은 image 만으로 식별 불가 → 무조건 INCONCLUSIVE:
- 픽셀 수치 (정확한 px 단위 width/height/spacing)
- 색상 hex 값 (visual estimation 만 가능)
- 폰트 family (Noto Sans KR vs system fallback)
- hover delay (ms 단위)
- 잘림 / 작은 element

### Rule 3 — Codex Cross-Validation Default (vision-heavy 워크플로우)

GitKraken UI/UX 흡수 / Figma design diff / screenshot 비교 같은 vision-heavy 작업은 Codex background agent 표준 패턴:

```javascript
Agent({
  subagent_type: "codex:codex-rescue",
  run_in_background: true,
  prompt: `본 PNG (path) 의 [A/B/C 영역] 검증.
    Claude 단독 분석 결과 (paste) 와 cross-check. 5필드 명시.
    REFUTED / INCONCLUSIVE / CONFIRMED 분류 + Claude 미발견 신규.`
})
```

### Rule 4 — Disagree 시 Codex 보수적 판단 채택

Claude vision 단정 ↔ Codex 검증 결과 충돌 시 **항상 Codex 측**. Claude false positive 비용 (잘못된 보고서 / 폐기될 backlog / 잘못된 fix 권고) > Codex false negative 비용.

본 sprint 실 사례: 7 정정 중 6 가 Codex REFUTED → Claude 단정 폐기 (SB-054 OAUTH/OTHERS backlog 폐기 회피).

### Rule 5 — Visible/Invisible 단정 + Destructive Follow-up Gate

- Vision 의 "X 가 visible" → **신규 backlog 등록 직전** Codex 검증 통과 필수
- Vision 의 "Y 는 visible 안 됨" → **기존 backlog 폐기 직전** Codex 검증 통과 필수

## 예방

### Toolkit 보강 (다음 session 진입 시 toolkit 측 sync — race 회피)

다음 session 첫 작업으로 `~/.claude` 측에 다음 적용:

1. **신규 solution**: `~/.claude/docs/solutions/multimodal-vision-cross-validation-false-positive.md` (본 file 의 cross-project 버전)
2. **skill 보강**: `~/.claude/skills/universal/dev/multi-angle-analysis/skill.md` 에 § Multimodal Vision Cross-Validation (5 Rule + 실 사례 표 + Codex pair pattern). 251 → ~317 LOC 예상 (soft 800 미만)
3. **CLAUDE.md global 룰 § Verification Discipline 확장**:
   ```markdown
   ## Verification Discipline (multimodal vision 확장)
   - Image/screenshot/PDF vision 분석도 검증 5필드 적용
   - Vision-heavy 워크플로우는 Codex background agent cross-validation default
   - Disagree 시 Codex 측 채택
   - INCONCLUSIVE 라벨 적극 사용 (픽셀/폰트/색상 hex/px 측정 등)
   - Visible/invisible 단정 + destructive follow-up 동반 시 Codex 검증 통과 후만
   ```

### Memory feedback (이미 git-fried 측 정착, c95+)

`~/.claude/projects/d--01-Work-08-rf-git-fried/memory/feedback_research_first_ui_handson.md` Rule 3 으로 정착됨.

## 관련 문서

- `docs/ux-eval/2026-05-18-153317-gitkraken-handson-v2-baseline.md` v0.2 — 본 solution 의 실 사례 (Codex 합류)
- `docs/solutions/multi-session-git-race-condition.md` — 본 sprint 의 toolkit sync 영구 fail 영역 (별도 solution)
- `~/.claude/projects/d--01-Work-08-rf-git-fried/memory/feedback_research_first_ui_handson.md` Rule 3
- 기존 family solutions (toolkit 측):
  - `positive-coverage-claim-false-pass` — text positive 단정 false pass 의 vision 확장
  - `subagent-grep-false-negative-dead-config` — text false negative 의 vision 확장
  - `pattern-definition-vs-measurement-lockstep-drift` — verification family
