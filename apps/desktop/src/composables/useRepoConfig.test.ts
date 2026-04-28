import { describe, expect, it } from 'vitest'
import { EMPTY_REPO_CONFIG } from './useRepoConfig'

describe('EMPTY_REPO_CONFIG', () => {
  it('Sprint B14-3 — 13 필드 모두 null (Repo-Specific Preferences 폼 default)', () => {
    expect(EMPTY_REPO_CONFIG.hooksPath).toBe(null)
    expect(EMPTY_REPO_CONFIG.commitEncoding).toBe(null)
    expect(EMPTY_REPO_CONFIG.logOutputEncoding).toBe(null)
    expect(EMPTY_REPO_CONFIG.gitflowBranchMaster).toBe(null)
    expect(EMPTY_REPO_CONFIG.gitflowBranchDevelop).toBe(null)
    expect(EMPTY_REPO_CONFIG.gitflowPrefixFeature).toBe(null)
    expect(EMPTY_REPO_CONFIG.gitflowPrefixRelease).toBe(null)
    expect(EMPTY_REPO_CONFIG.gitflowPrefixHotfix).toBe(null)
    expect(EMPTY_REPO_CONFIG.commitGpgsign).toBe(null)
    expect(EMPTY_REPO_CONFIG.userSigningkey).toBe(null)
    expect(EMPTY_REPO_CONFIG.gpgFormat).toBe(null)
    expect(EMPTY_REPO_CONFIG.userName).toBe(null)
    expect(EMPTY_REPO_CONFIG.userEmail).toBe(null)
  })

  it('immutable spec — null literal 만 존재 (truthy field 없음)', () => {
    for (const v of Object.values(EMPTY_REPO_CONFIG)) {
      expect(v).toBe(null)
    }
  })
})
