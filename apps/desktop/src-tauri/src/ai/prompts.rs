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

#[cfg(test)]
mod tests {
    use super::*;

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
            &vec!["feat: 첫 커밋".to_string()],
        );
        assert!(p.contains("Conventional"));
        assert!(p.contains("hello"));
        assert!(p.contains("feat: 첫 커밋"));
    }
}
