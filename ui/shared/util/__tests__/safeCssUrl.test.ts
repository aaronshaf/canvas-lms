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

import safeCssUrl from '../safeCssUrl'

describe('safeCssUrl', () => {
  describe('valid URLs', () => {
    it('wraps an https URL in url()', () => {
      expect(safeCssUrl('https://example.com/img.jpg')).toBe("url('https://example.com/img.jpg')")
    })

    it('wraps an http URL in url()', () => {
      expect(safeCssUrl('http://example.com/img.jpg')).toBe("url('http://example.com/img.jpg')")
    })

    it('accepts URLs with query strings', () => {
      expect(safeCssUrl('https://example.com/img.jpg?v=1&size=large')).toBe(
        "url('https://example.com/img.jpg?v=1&size=large')",
      )
    })

    it('contains ) safely inside quotes — would break bare url(${…}) but not here', () => {
      // bare:  url(https://x.com/path)) → ) closes url(), injecting CSS after
      // fixed: url('https://x.com/path)') → ) is harmless inside single quotes
      expect(safeCssUrl('https://x.com/path)')).toBe("url('https://x.com/path)')")
    })
  })

  describe('CSS string breakout — quote characters', () => {
    it('escapes a single quote so it cannot close the CSS string', () => {
      // old (FilesystemObjectThumbnail): url('https://x.com/it's.jpg')
      //   → ' closes the string, enabling CSS property injection after
      // fixed: url('https://x.com/it\'s.jpg') → ' is escaped
      const result = safeCssUrl("https://example.com/it's-a-photo.jpg")
      expect(result).toBe("url('https://example.com/it\\'s-a-photo.jpg')")
    })

    it('escapes a backslash before escaping quotes (order matters)', () => {
      const result = safeCssUrl("https://example.com/path\\'injected")
      // \\ → \\\\ then ' → \'
      expect(result).toBe("url('https://example.com/path\\\\\\'injected')")
    })
  })

  describe('scheme validation', () => {
    it('returns null for javascript: scheme', () => {
      expect(safeCssUrl('javascript:alert(1)')).toBeNull()
    })

    it('returns null for data: scheme', () => {
      expect(safeCssUrl('data:text/css,body{background:red}')).toBeNull()
    })

    it('returns null for vbscript: URL', () => {
      expect(safeCssUrl('vbscript:msgbox(1)')).toBeNull()
    })
  })

  describe('null / empty / malformed input', () => {
    it('returns null for null', () => {
      expect(safeCssUrl(null)).toBeNull()
    })

    it('returns null for undefined', () => {
      expect(safeCssUrl(undefined)).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(safeCssUrl('')).toBeNull()
    })

    it('returns null for a non-URL string', () => {
      expect(safeCssUrl('not a url')).toBeNull()
    })
  })
})
