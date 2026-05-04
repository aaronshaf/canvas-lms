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

import {decodeHTML, sanitizeAndFormatHTML} from '../index'

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
})

describe('sanitizeAndFormatHTML', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeAndFormatHTML('')).toBe('')
  })

  it('returns plain text with no special characters unchanged', () => {
    expect(sanitizeAndFormatHTML('hello world')).toBe('hello world')
  })

  it('converts <br/> to <br /> for line break rendering', () => {
    expect(sanitizeAndFormatHTML('line1<br/>line2')).toBe('line1<br />line2')
  })

  it('converts \\n to <br /> for line break rendering', () => {
    expect(sanitizeAndFormatHTML('line1\nline2')).toBe('line1<br />line2')
  })

  it('handles a mix of <br/> and \\n', () => {
    expect(sanitizeAndFormatHTML('line1<br/>line2\nline3')).toBe('line1<br />line2<br />line3')
  })

  it('escapes ampersands', () => {
    expect(sanitizeAndFormatHTML('rock &amp; roll')).toBe('rock &amp; roll')
  })

  describe('XSS protection', () => {
    it('strips <script> tags', () => {
      expect(sanitizeAndFormatHTML('<script>alert(1)</script>')).toBe('')
    })

    it('strips onerror event handlers', () => {
      expect(sanitizeAndFormatHTML('<img src="x" onerror="alert(1)">')).not.toContain('onerror')
    })

    it('strips object tags with event handlers', () => {
      expect(sanitizeAndFormatHTML('<object onerror="alert(3)">x</object>')).not.toContain(
        'onerror',
      )
    })

    it('strips javascript: protocol from href', () => {
      expect(sanitizeAndFormatHTML('<a href="javascript:alert(1)">click</a>')).not.toContain(
        'javascript:',
      )
    })

    it('strips svg onload handlers', () => {
      expect(sanitizeAndFormatHTML('<svg onload="alert(1)"></svg>')).not.toContain('onload')
    })

    it('strips onclick handlers', () => {
      expect(sanitizeAndFormatHTML('<div onclick="alert(1)">text</div>')).not.toContain('onclick')
    })
  })
})
