// UltraPlan v0.4 sidebar GitKraken DIFF — SB-008 fix.
//
// Tag / ref 의 semver 정렬 utility. git2 의 default alphabetical 정렬은
// `v1.10.0 < v2.0.0` 같은 의도를 깬다 (v1.10.0 이 v1.2.0 보다 앞에 오는 문제).
// GitKraken parity 차원에서 semver descending (최신 우선) 정책 채택.
//
// 본 utility 는 strict semver 아닌 lenient 매처 — `v1.0.0`, `1.0.0`, `release/v2.0.0`,
// `v1.0.0-rc.1` 등 다양한 prefix/suffix 허용. semver 미매칭 ref 는 fallback localeCompare.

const SEMVER_RE = /v?(\d+)\.(\d+)\.(\d+)(?:[-.+]([0-9A-Za-z.-]+))?/

interface SemverParts {
  major: number
  minor: number
  patch: number
  /** pre-release 식별자 (예: "rc.1", "alpha.2"). 없으면 빈 문자열. */
  prerelease: string
}

function parseSemver(name: string): SemverParts | null {
  const m = name.match(SEMVER_RE)
  if (!m) return null
  return {
    major: parseInt(m[1], 10),
    minor: parseInt(m[2], 10),
    patch: parseInt(m[3], 10),
    prerelease: m[4] ?? '',
  }
}

/**
 * semver 비교 — `a` 가 `b` 보다 새 버전이면 양수 반환.
 * descending sort 에 사용 시 `[...tags].sort((a, b) => semverCompare(b.name, a.name))`.
 *
 * Rules:
 * - major.minor.patch 차이 우선
 * - 동일 major.minor.patch 시: prerelease 없음 (stable) 가 prerelease 있음 (pre) 보다 새
 * - 둘 다 prerelease 시: prerelease 문자열 localeCompare
 * - semver 미매칭 시: name 자체 localeCompare (alphabetical fallback)
 */
export function semverCompare(a: string, b: string): number {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (!pa || !pb) return a.localeCompare(b)
  if (pa.major !== pb.major) return pa.major - pb.major
  if (pa.minor !== pb.minor) return pa.minor - pb.minor
  if (pa.patch !== pb.patch) return pa.patch - pb.patch
  // 동일 버전 — prerelease 없음 (stable) 우선
  if (pa.prerelease === '' && pb.prerelease !== '') return 1
  if (pa.prerelease !== '' && pb.prerelease === '') return -1
  return pa.prerelease.localeCompare(pb.prerelease)
}
