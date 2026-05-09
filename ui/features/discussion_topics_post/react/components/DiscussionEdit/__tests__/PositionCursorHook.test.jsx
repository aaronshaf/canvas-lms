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

import {describe, expect, it, vi} from 'vitest'
import {positionForCreateReply} from '../PositionCursorHook'

describe('PositionCursorHook.positionForCreateReply — sanitization round-trip', () => {
  // The sink is `mentionContainer.innerHTML = currentText + reactSentinel`.
  // currentText is read FROM the live DOM, then ASSIGNED back to it. A
  // mXSS payload that renders as benign-looking DOM but re-serializes
  // dangerously can survive that round-trip — the wrap with sanitizeHTML
  // closes that path.
  const buildEditor = mentionContainerInnerHTML => {
    const mentionContainer = document.createElement('p')
    mentionContainer.innerHTML = mentionContainerInnerHTML
    document.body.appendChild(mentionContainer)
    const editor = {
      dom: {
        select: selector => {
          if (selector === 'p') return [mentionContainer]
          return Array.from(document.querySelectorAll(selector))
        },
      },
      selection: {setCursorLocation: vi.fn()},
    }
    return {editor, mentionContainer}
  }

  it('strips event handler attributes that survive innerHTML round-trip', () => {
    // RAW innerHTML write places the payload in DOM as-is. The shim's
    // job: when the function reads currentText and writes it back,
    // run sanitizeHTML on the way out.
    const {editor, mentionContainer} = buildEditor('<img src="x" onerror="window.__pwned=1">')
    // Sanity: jsdom kept the attribute on the initial assignment (this
    // is the red baseline — without sanitizeHTML the attribute survives
    // the round-trip).
    expect(mentionContainer.querySelector('img').getAttribute('onerror')).toBe('window.__pwned=1')

    positionForCreateReply(editor, mentionContainer)

    // After the sanitizing round-trip, the dangerous attribute is gone.
    const img = mentionContainer.querySelector('img')
    expect(img).not.toBeNull()
    expect(img.getAttribute('onerror')).toBeNull()
    // The static sentinel span is still appended.
    expect(mentionContainer.querySelector('span.post_mention')).not.toBeNull()
    document.body.removeChild(mentionContainer)
  })

  it('strips inline <script> from the round-trip', () => {
    const {editor, mentionContainer} = buildEditor(
      '<span>before<script>window.__pwned=1</script></span>',
    )
    expect(mentionContainer.querySelector('script')).not.toBeNull()

    positionForCreateReply(editor, mentionContainer)

    expect(mentionContainer.querySelector('script')).toBeNull()
    expect(mentionContainer.querySelector('span.post_mention')).not.toBeNull()
    document.body.removeChild(mentionContainer)
  })

  it('preserves benign mention markup', () => {
    const {editor, mentionContainer} = buildEditor(
      '<span class="mention" data-uid="42">@Alice</span>',
    )

    positionForCreateReply(editor, mentionContainer)

    expect(mentionContainer.querySelector('span.mention')?.textContent).toBe('@Alice')
    expect(mentionContainer.querySelector('span.post_mention')).not.toBeNull()
    document.body.removeChild(mentionContainer)
  })

  it('moves the cursor to the appended sentinel span', () => {
    const {editor, mentionContainer} = buildEditor('<span>hello</span>')

    positionForCreateReply(editor, mentionContainer)

    expect(editor.selection.setCursorLocation).toHaveBeenCalledTimes(1)
    const [target, offset] = editor.selection.setCursorLocation.mock.calls[0]
    expect(target.classList.contains('post_mention')).toBe(true)
    expect(offset).toBe(0)
    document.body.removeChild(mentionContainer)
  })
})
