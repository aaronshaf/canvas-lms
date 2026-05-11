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

// XSS regression coverage for LongDescriptionModal. The longDescription
// prop is rendered via `dangerouslySetInnerHTML`, so the sink must run
// untrusted HTML through DOMPurify (via @canvas/sanitize-html) before it
// becomes real DOM.
//
// LongDescriptionModal formats the input through `newlinesToBrTags` (a
// pure string transform with no sanitization). To verify that the
// @canvas/sanitize-html wrapper at the sink provides independent
// defense-in-depth, we mock `newlinesToBrTags` to a pass-through. That
// isolates the sink-level sanitizer as the only defense, so removing
// sanitizeHTML would let the payload through and turn these tests red.

import {render} from '@testing-library/react'
import React from 'react'

vi.mock('@canvas/util/TextHelper', async importOriginal => {
  const actual = await importOriginal<typeof import('@canvas/util/TextHelper')>()
  return {
    ...actual,
    // Pass-through: simulates the formatter being bypassed.
    // Safety must come from the @canvas/sanitize-html wrapper at the sink.
    newlinesToBrTags: (str: string) => str,
  }
})

// Import after the mock is registered so the component sees the pass-through.
import {LongDescriptionModal} from '../LongDescriptionModal'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const renderModal = (longDescription: string) =>
  render(<LongDescriptionModal open={true} onClose={() => {}} longDescription={longDescription} />)

describe('LongDescriptionModal — XSS regression (sink-level sanitizer)', () => {
  it('strips inline event handlers from rendered HTML', () => {
    const {baseElement} = renderModal('<img src="x" onerror="window.__xss_fired=true">')
    expectNoEventHandlers(baseElement)
    expect(baseElement.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
  })

  it('strips <script> tags', () => {
    const {baseElement} = renderModal('<script>window.__xss_fired=true</script>safe text')
    expect(baseElement.innerHTML).not.toContain('<script')
    expect(baseElement.innerHTML).not.toContain('window.__xss_fired')
  })

  it('renders benign formatting (bold, italics, paragraphs) intact', () => {
    const {baseElement} = renderModal('<p><strong>bold</strong> and <em>italics</em></p>')
    expect(baseElement.querySelector('strong')?.textContent).toBe('bold')
    expect(baseElement.querySelector('em')?.textContent).toBe('italics')
  })
})
