// Sprint c46 DX-1 — FileRow 컴포넌트 unit test.
// status badge (label + aria-label) + dragstart MIME + dblclick emit.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FileRow from './FileRow.vue'
import type { FileChange } from '@/types/git'

const mockFile: FileChange = {
  path: 'src/foo.ts',
  status: 'modified',
} as FileChange

describe('FileRow', () => {
  it('label + path 렌더', () => {
    const w = mount(FileRow, {
      props: {
        file: mockFile,
        label: 'M',
        color: 'text-warning-amber',
        action: '+',
        actionTitle: 'Stage',
      },
    })
    expect(w.text()).toContain('M')
    expect(w.text()).toContain('src/foo.ts')
  })

  it('status badge aria-label 포함 (color-blind a11y)', () => {
    const w = mount(FileRow, {
      props: {
        file: mockFile,
        label: 'M',
        color: 'text-warning-amber',
        action: '+',
        actionTitle: 'Stage',
      },
    })
    const badge = w.find('[role="status"]')
    expect(badge.exists()).toBe(true)
    expect(badge.attributes('aria-label')).toBe('M src/foo.ts')
  })

  it('selected=true → bg-accent ring class', () => {
    const w = mount(FileRow, {
      props: {
        file: mockFile,
        label: 'M',
        color: 'text-warning-amber',
        action: '+',
        actionTitle: 'Stage',
        selected: true,
      },
    })
    expect(w.attributes('class')).toContain('bg-accent')
    expect(w.attributes('class')).toContain('ring-1')
  })

  it('click → select emit', async () => {
    const w = mount(FileRow, {
      props: {
        file: mockFile,
        label: 'M',
        color: 'text-warning-amber',
        action: '+',
        actionTitle: 'Stage',
      },
    })
    // WL-2: select 는 내부 full-width <button> (행 li 는 더 이상 role=button 아님)
    await w.get('button').trigger('click')
    expect(w.emitted('select')).toBeTruthy()
  })

  it('WL-2 a11y: 행 li 는 role=button 아님 + 내부 select button 에 status badge 포함', () => {
    const w = mount(FileRow, {
      props: {
        file: mockFile,
        label: 'M',
        color: 'text-warning-amber',
        action: '+',
        actionTitle: 'Stage',
      },
    })
    // nested-interactive 제거: li 는 비상호작용 컨테이너
    expect(w.attributes('role')).toBeUndefined()
    // primary select 는 내부 button (badge 를 감쌈)
    expect(w.get('button').find('[role="status"]').exists()).toBe(true)
  })

  it('dblclick → dblclick emit (fullscreen diff trigger)', async () => {
    const w = mount(FileRow, {
      props: {
        file: mockFile,
        label: 'M',
        color: 'text-warning-amber',
        action: '+',
        actionTitle: 'Stage',
      },
    })
    await w.trigger('dblclick')
    expect(w.emitted('dblclick')).toBeTruthy()
  })

  it('action button hover 시 표시 + click → action emit', async () => {
    const w = mount(FileRow, {
      props: {
        file: mockFile,
        label: 'M',
        color: 'text-warning-amber',
        action: '+',
        actionTitle: 'Stage this file',
      },
    })
    // WL-2: 첫 button 은 내부 select 래퍼 → action 버튼은 title 로 특정
    const btn = w.get('button[title="Stage this file"]')
    expect(btn.text()).toBe('+')
    expect(btn.attributes('title')).toBe('Stage this file')
    await btn.trigger('click')
    expect(w.emitted('action')).toBeTruthy()
    // click.stop → outer select 발화 안 됨
    expect(w.emitted('select')).toBeFalsy()
  })

  it('draggable="true" 속성 (StatusPanel drag-drop)', () => {
    const w = mount(FileRow, {
      props: {
        file: mockFile,
        label: 'M',
        color: 'text-warning-amber',
        action: '+',
        actionTitle: 'Stage',
      },
    })
    expect(w.attributes('draggable')).toBe('true')
  })

  it('extra slot 노출', () => {
    const w = mount(FileRow, {
      props: {
        file: mockFile,
        label: 'M',
        color: 'text-warning-amber',
        action: '+',
        actionTitle: 'Stage',
      },
      slots: { extra: '<span class="extra-test">EXTRA</span>' },
    })
    expect(w.find('.extra-test').exists()).toBe(true)
  })
})
