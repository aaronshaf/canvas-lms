/*
 * Copyright (C) 2026 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import {initScreenreaderOnFormat} from '../screenreaderOnFormat'

type FormatHandler = (event: {format: string}) => void

function makeEditor() {
  const handlers: Record<string, FormatHandler> = {}
  return {
    on: (eventName: string, handler: FormatHandler) => {
      handlers[eventName] = handler
    },
    fire: (eventName: string, format: string) => {
      handlers[eventName]?.({format})
    },
  }
}

function announceText(): string | null {
  const container = document.getElementById('rce_message_screenreader_holder')
  return container?.textContent ?? null
}

describe('initScreenreaderOnFormat (regression: 9fbcc14821c)', () => {
  let editor: ReturnType<typeof makeEditor>

  beforeEach(() => {
    editor = makeEditor()
    initScreenreaderOnFormat(editor as any)
    document.getElementById('rce_message_screenreader_holder')?.remove()
  })

  afterEach(() => {
    document.getElementById('rce_message_screenreader_holder')?.remove()
  })

  describe('FormatApply events', () => {
    it('announces "Bold applied" when bold is applied', () => {
      editor.fire('FormatApply', 'bold')
      expect(announceText()).toContain('Bold applied')
    })

    it('announces "Italic applied" when italic is applied', () => {
      editor.fire('FormatApply', 'italic')
      expect(announceText()).toContain('Italic applied')
    })

    it('announces "Underline applied" when underline is applied', () => {
      editor.fire('FormatApply', 'underline')
      expect(announceText()).toContain('Underline applied')
    })

    it('announces heading level when h1 is applied', () => {
      editor.fire('FormatApply', 'h1')
      expect(announceText()).toContain('h1')
    })

    it('announces heading level when h3 is applied', () => {
      editor.fire('FormatApply', 'h3')
      expect(announceText()).toContain('h3')
    })

    it('announces "Paragraph applied" when p is applied', () => {
      editor.fire('FormatApply', 'p')
      expect(announceText()).toContain('Paragraph applied')
    })

    it('does not announce anything for unknown formats', () => {
      editor.fire('FormatApply', 'unknownFormat')
      expect(announceText()).toBeNull()
    })
  })

  describe('FormatRemove events', () => {
    it('announces "Bold removed" when bold is removed', () => {
      editor.fire('FormatRemove', 'bold')
      expect(announceText()).toContain('Bold removed')
    })

    it('announces "Italic removed" when italic is removed', () => {
      editor.fire('FormatRemove', 'italic')
      expect(announceText()).toContain('Italic removed')
    })

    it('announces heading level when h2 is removed', () => {
      editor.fire('FormatRemove', 'h2')
      expect(announceText()).toContain('h2')
    })
  })

  describe('alert container', () => {
    it('creates a screenreader-only live region on first announce', () => {
      editor.fire('FormatApply', 'bold')
      const container = document.getElementById('rce_message_screenreader_holder')
      expect(container).not.toBeNull()
      expect(container?.getAttribute('role')).toBe('status')
      expect(container?.getAttribute('aria-live')).toBe('assertive')
    })

    it('reuses the existing container on subsequent announces', () => {
      editor.fire('FormatApply', 'bold')
      editor.fire('FormatApply', 'italic')
      const containers = document.querySelectorAll('#rce_message_screenreader_holder')
      expect(containers).toHaveLength(1)
      expect(announceText()).toContain('Italic applied')
    })
  })
})
