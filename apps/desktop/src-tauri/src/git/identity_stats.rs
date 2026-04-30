// Sprint c36 — IdentityCard dogfood 통계 IPC.
//
// plan/26 Phase 2 의 차별점 패널이 노출하는 정량 데이터:
//   - 활성 레포의 한글 commit 메시지 카운트 (한글 안전 차별점 검증)
//
// 휴리스틱:
//   - 최근 10,000 commits 한정 (성능 / 사용자 인식 충분)
//   - subject 만 검사 (body 는 안 봄 — false positive 줄임)
//   - 한글 유니코드 AC00-D7A3 (가-힣 음절 영역) 1자 이상 포함 시 카운트.
//     자모 (1100-11FF) 는 NFD 분리형 — runner.rs 의 NFC 정규화 후 거의 0 이라 무시.

use crate::error::AppResult;
use crate::git::runner::{git_run, GitRunOpts};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::OnceLock;

/// 한글 음절 영역 (가-힣) 1자 이상 매칭 정규식. 컴파일 1회.
fn hangul_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        // \u{AC00}-\u{D7A3} = 가-힣 (현대 한글 음절 11,172자)
        Regex::new("[\u{AC00}-\u{D7A3}]").expect("hangul regex valid")
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HangulCommitStats {
    /// 검사된 최근 commit 수 (최대 10,000).
    pub scanned: u64,
    /// 그 중 한글 음절 1자 이상 포함된 subject 수.
    pub hangul: u64,
    /// hangul / scanned (0~1.0). scanned=0 시 0.
    pub ratio: f32,
}

/// 활성 레포의 최근 commits subject 검사 후 한글 비율 계산.
///
/// 빈 레포 / commit 0 시 모두 0 반환 (에러 X).
/// `git log --no-merges` 로 머지 commit 제외 (의미 없는 "Merge branch ..." 자동 제거).
pub async fn count_hangul_commits(repo: &Path) -> AppResult<HangulCommitStats> {
    let out = git_run(
        repo,
        &[
            "log",
            "--no-merges",
            "--pretty=format:%s",
            "-n",
            "10000",
            "HEAD",
        ],
        &GitRunOpts::default(),
    )
    .await?;
    // log 가 빈 레포에서 exit_code != 0 가능 — 그 경우 0 반환 (silent fallback).
    if out.exit_code != Some(0) {
        return Ok(HangulCommitStats {
            scanned: 0,
            hangul: 0,
            ratio: 0.0,
        });
    }
    let re = hangul_re();
    let mut scanned: u64 = 0;
    let mut hangul: u64 = 0;
    for line in out.stdout.lines() {
        scanned += 1;
        if re.is_match(line) {
            hangul += 1;
        }
    }
    let ratio = if scanned > 0 {
        hangul as f32 / scanned as f32
    } else {
        0.0
    };
    Ok(HangulCommitStats {
        scanned,
        hangul,
        ratio,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hangul_re_matches_korean() {
        let re = hangul_re();
        assert!(re.is_match("한글 commit"));
        assert!(re.is_match("[chore] 한글 메시지"));
        assert!(re.is_match("가"));
        assert!(re.is_match("힣"));
    }

    #[test]
    fn hangul_re_skips_ascii() {
        let re = hangul_re();
        assert!(!re.is_match("feat: add login"));
        assert!(!re.is_match("WIP"));
        assert!(!re.is_match(""));
    }

    #[test]
    fn hangul_re_skips_jamo_nfd() {
        // NFC 정규화 후엔 거의 안 나옴. 명시적 자모 단독은 매칭 안 함.
        let re = hangul_re();
        // \u{1112} = ᄒ (jamo, NFD 분리형) — AC00-D7A3 범위 밖.
        assert!(!re.is_match("\u{1112}"));
    }

    #[test]
    fn hangul_re_matches_chinese_japanese_negative() {
        // 중국어 / 일본어는 한글 영역 X.
        let re = hangul_re();
        assert!(!re.is_match("中文 commit"));
        assert!(!re.is_match("こんにちは"));
    }
}
