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
    await w.trigger('click')
    expect(w.emitted('select')).toBeTruthy()
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
    const btn = w.find('button')
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
