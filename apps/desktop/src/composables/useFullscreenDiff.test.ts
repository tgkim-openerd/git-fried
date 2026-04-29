import { afterEach, describe, expect, it } from 'vitest'
import { useFullscreenDiff } from './useFullscreenDiff'

describe('useFullscreenDiff', () => {
  afterEach(() => {
    useFullscreenDiff().close()
  })

  it('초기 current 는 null', () => {
    expect(useFullscreenDiff().current.value).toBe(null)
  })

  it('openWip — source=wip + path + isStaged', () => {
    const fs = useFullscreenDiff()
    fs.openWip('src/foo.ts', false)
    expect(fs.current.value).toEqual({ source: 'wip', path: 'src/foo.ts', isStaged: false })
  })

  it('openWip staged=true', () => {
    const fs = useFullscreenDiff()
    fs.openWip('src/bar.ts', true)
    expect(fs.current.value).toEqual({ source: 'wip', path: 'src/bar.ts', isStaged: true })
  })

  it('openCommit — source=commit + sha + path', () => {
    const fs = useFullscreenDiff()
    fs.openCommit('abc1234', 'src/baz.ts')
    expect(fs.current.value).toEqual({ source: 'commit', sha: 'abc1234', path: 'src/baz.ts' })
  })

  it('open* 후 close → null', () => {
    const fs = useFullscreenDiff()
    fs.openWip('a', false)
    expect(fs.current.value).not.toBe(null)
    fs.close()
    expect(fs.current.value).toBe(null)
  })

  it('singleton — 두 번 호출해도 같은 state 공유', () => {
    const a = useFullscreenDiff()
    a.openCommit('sha1', 'p1')
    const b = useFullscreenDiff()
    expect(b.current.value).toEqual({ source: 'commit', sha: 'sha1', path: 'p1' })
  })

  it('한글 path 통과', () => {
    const fs = useFullscreenDiff()
    fs.openWip('문서/설계.md', false)
    expect(fs.current.value).toEqual({ source: 'wip', path: '문서/설계.md', isStaged: false })
  })
})
