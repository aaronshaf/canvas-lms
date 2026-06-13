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

import {decodeHTML} from '../index'

describe('decodeHTML', () => {
  it('returns plain text unchanged', () => {
    expect(decodeHTML('hello world')).toBe('hello world')
  })

  it('decodes &#39; (Ruby html_escape apostrophe)', () => {
    expect(decodeHTML('that&#39;s that')).toBe("that's that")
  })

  it('decodes &#x27; (@instructure/html-escape apostrophe)', () => {
    expect(decodeHTML('that&#x27;s that')).toBe("that's that")
  })

  it('decodes &amp;', () => {
    expect(decodeHTML('rock &amp; roll')).toBe('rock & roll')
  })

  it('decodes &lt; and &gt;', () => {
    expect(decodeHTML('&lt;div&gt;')).toBe('<div>')
  })

  it('decodes &quot;', () => {
    expect(decodeHTML('say &quot;hello&quot;')).toBe('say "hello"')
  })

  it('handles empty string', () => {
    expect(decodeHTML('')).toBe('')
  })

  it('decodes multiple entities in one string', () => {
    expect(decodeHTML('&lt;b&gt;that&#39;s &amp; this&lt;/b&gt;')).toBe("<b>that's & this</b>")
  })

  it('preserves literal <word>-shaped plain-text tokens (does NOT strip tags)', () => {
    // Regression guard: an earlier wrapper called the destructive
    // TextHelper#htmlDecode which stripped any `<…>`-shaped substring
    // via regex, silently destroying teacher-typed placeholder text
    // like `<your initials>` in rubric criterion descriptions.
    expect(decodeHTML('Sign with <your initials>')).toBe('Sign with <your initials>')
    expect(decodeHTML('Identify <key concepts> in the text')).toBe(
      'Identify <key concepts> in the text',
    )
  })

  it('preserves bare `<` followed by a space', () => {
    expect(decodeHTML('5 < 10 students')).toBe('5 < 10 students')
  })

  it('preserves <script>-shaped tokens verbatim (server-side defense handles XSS)', () => {
    // The decoder is not the XSS perimeter. Server-side format_message
    // (app/models/rubric.rb) entity-encodes `<` to `&lt;` on save; render
    // sites wrap in DOMPurify via sanitizeHTML. Any value reaching this
    // decoder client-side has already been through the server's escape
    // pipeline.
    expect(decodeHTML('<script>alert(1)</script>')).toBe('<script>alert(1)</script>')
  })
})
