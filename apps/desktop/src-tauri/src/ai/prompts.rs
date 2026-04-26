// AI prompt 템플릿 + secret 마스킹.
//
// 회사 워크스페이스에서는 prompt 송출 전 사용자 승인 필수
// (Vue 측 ForgeSetup / AI panel 에서 처리, Rust 는 마스킹만).

use once_cell::sync::Lazy;
use regex::Regex;

/// secret 패턴 — 송출 전 마스킹.
static SECRET_PATTERNS: Lazy<Vec<Regex>> = Lazy::new(|| {
    vec![
        // GitHub PAT (classic + fine-grained)
        Regex::new(r"\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b").unwrap(),
        // GitLab PAT
        Regex::new(r"\bglpat-[A-Za-z0-9_-]{20,}\b").unwrap(),
        // AWS keys
        Regex::new(r"\bAKIA[0-9A-Z]{16}\b").unwrap(),
        // private key 헤더
        Regex::new(r"-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+PRIVATE KEY-----")
            .unwrap(),
        // .env 흔한 패턴
        Regex::new(r"(?i)(api[_-]?key|secret|password|token)\s*[=:]\s*[^\s]+").unwrap(),
        // 한국 주민등록번호 (대략)
        Regex::new(r"\b\d{6}-?[1-4]\d{6}\b").unwrap(),
    ]
});

pub fn mask_secrets(input: &str) -> String {
    let mut out = input.to_string();
    for re in SECRET_PATTERNS.iter() {
        out = re.replace_all(&out, "[MASKED]").into_owned();
    }
    out
}

/// AI commit message 생성 prompt.
///
/// 사용자 워크플로우:
///   - Conventional Commits 80%+ (`feat/fix/chore/...`)
///   - 한글 메시지 55~72%
///   - traditional merge (squash 안 씀)
pub fn commit_message_prompt(diff: &str, recent_subjects: &[String]) -> String {
    let masked = mask_secrets(diff);
    let recent = if recent_subjects.is_empty() {
        String::from("(없음)")
    } else {
        recent_subjects
            .iter()
            .take(5)
            .map(|s| format!("  - {s}"))
            .collect::<Vec<_>>()
            .join("\n")
    };
    format!(
        r#"다음 staged diff 에 대한 Conventional Commit 메시지를 한국어로 작성해주세요.

**규칙**:
- type: feat / fix / chore / refactor / docs / perf / test / ci / build / style / revert
- 형식: `<type>(<scope>)?: <subject>` (subject 70자 이내)
- 본문 (선택): 빈 줄 후 한국어로 'why' 설명. 'what' 은 코드가 보여줌.
- footer (선택): `Refs: #123` 같은 메타.
- **금지**: `Co-Authored-By: Claude` trailer / "Generated with Claude" 푸터.

**최근 5개 commit 의 스타일 참고**:
{recent}

**Staged diff**:
```diff
{masked}
```

응답은 commit message 본문만. 설명/마크다운 코드블록 없이.
"#
    )
}

/// AI PR body 생성 prompt.
pub fn pr_body_prompt(commits: &[String], diff_stat: &str, head_branch: &str, base_branch: &str) -> String {
    let cs = if commits.is_empty() {
        String::from("(없음)")
    } else {
        commits
            .iter()
            .map(|s| format!("  - {s}"))
            .collect::<Vec<_>>()
            .join("\n")
    };
    let masked_stat = mask_secrets(diff_stat);
    format!(
        r#"다음 변경사항에 대한 PR body 를 한국어로 작성해주세요.

**규칙**:
- 섹션: ## 요약 / ## 변경 사항 / ## 테스트 방법 / ## 참고
- 한국어, 마크다운.
- 길이는 적절히 (200~600자).
- **금지**: `Co-Authored-By: Claude` trailer / "Generated with Claude" 푸터.

**브랜치**: {head_branch} → {base_branch}

**커밋 (시간 역순)**:
{cs}

**diff stat**:
```
{masked_stat}
```

응답은 PR body 본문만 (제목 제외).
"#
    )
}

/// 3-way merge 충돌 해결 prompt.
///
/// 사용자 워크플로우 — 회사 traditional merge 비율 높음 (`docs/plan/02 §3 W1`).
/// 충돌 마커 파일 + ours/theirs/base 를 함께 보내서 해결안 추천.
pub fn merge_resolution_prompt(
    file_path: &str,
    working: &str,
    ours: &str,
    theirs: &str,
    base: Option<&str>,
) -> String {
    let masked_w = mask_secrets(working);
    let masked_o = mask_secrets(ours);
    let masked_t = mask_secrets(theirs);
    let base_block = match base {
        Some(b) => format!(
            "\n**BASE (공통 조상)**:\n```\n{}\n```\n",
            mask_secrets(b)
        ),
        None => String::new(),
    };
    format!(
        r#"다음 3-way 머지 충돌을 해결해주세요. 한국어 사고, **결과 파일 본문만** 출력.

**파일**: `{file_path}`

**OURS (현재 브랜치)**:
```
{masked_o}
```

**THEIRS (들어오는)**:
```
{masked_t}
```
{base_block}
**WORKING (conflict marker 포함)**:
```
{masked_w}
```

**규칙**:
- conflict marker (<<<<<<< ======= >>>>>>>) 모두 제거
- 양쪽 의도 가능한 한 모두 보존 (semantic merge)
- 명확히 하나만 선택해야 하면 OURS 우선 (현재 브랜치)
- 코드 스타일 / indentation 보존
- 마크다운 코드블록 백틱 출력 금지 — 파일 내용만

응답: 결과 파일 본문 그대로 (설명 없이).
"#
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_merge_resolution_prompt_includes_all_sides() {
        let p = merge_resolution_prompt(
            "src/foo.rs",
            "<<<<<<< HEAD\n안녕 1\n=======\n안녕 2\n>>>>>>> feat",
            "안녕 1",
            "안녕 2",
            Some("안녕 0"),
        );
        assert!(p.contains("OURS"));
        assert!(p.contains("THEIRS"));
        assert!(p.contains("BASE"));
        assert!(p.contains("안녕 1"));
        assert!(p.contains("안녕 2"));
        assert!(p.contains("안녕 0"));
        assert!(p.contains("src/foo.rs"));
    }

    #[test]
    fn test_mask_github_pat() {
        let s = "token=ghp_abcdef1234567890ABCDEF and ok";
        assert!(mask_secrets(s).contains("[MASKED]"));
        assert!(!mask_secrets(s).contains("ghp_abcdef"));
    }

    #[test]
    fn test_mask_aws() {
        assert!(mask_secrets("key AKIAIOSFODNN7EXAMPLE end").contains("[MASKED]"));
    }

    #[test]
    fn test_mask_keeps_normal_text() {
        let s = "feat: 한글 메시지 + 영문 ok";
        assert_eq!(mask_secrets(s), s);
    }

    #[test]
    fn test_mask_env_pattern() {
        let s = "API_KEY=mySecretKey123";
        assert!(mask_secrets(s).contains("[MASKED]"));
    }

    #[test]
    fn test_commit_prompt_includes_diff_and_recent() {
        let p = commit_message_prompt(
            "diff --git a/foo.rs b/foo.rs\n+hello",
            &["feat: 첫 커밋".to_string()],
        );
        assert!(p.contains("Conventional"));
        assert!(p.contains("hello"));
        assert!(p.contains("feat: 첫 커밋"));
    }
}
