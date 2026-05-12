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

import {sanitizeUrl} from '../sanitizeUrl'

describe('sanitizeUrl', () => {
  describe('allowlist: safe schemes pass through', () => {
    it('allows http: URLs', () => {
      expect(sanitizeUrl('http://instructure.com')).toBe('http://instructure.com')
    })

    it('allows https: URLs', () => {
      expect(sanitizeUrl('https://instructure.com')).toBe('https://instructure.com')
    })

    it('allows mailto: URLs', () => {
      expect(sanitizeUrl('mailto:user@example.com')).toBe('mailto:user@example.com')
    })

    it('allows tel: URLs', () => {
      expect(sanitizeUrl('tel:+15555551234')).toBe('tel:+15555551234')
    })

    it('allows root-relative URLs', () => {
      expect(sanitizeUrl('/canvas/path')).toBe('/canvas/path')
    })

    it('allows schemeless relative URLs', () => {
      expect(sanitizeUrl('lolcats.gif')).toBe('lolcats.gif')
    })
  })

  describe('blocklist: dangerous schemes return about:blank', () => {
    it('blocks javascript: scheme', () => {
      expect(
        sanitizeUrl('javascript:prompt(document.cookie);prompt(document.domain);'),
      ).toBe('about:blank')
    })

    it('blocks JAVASCRIPT: case variants via URL normalization', () => {
      expect(sanitizeUrl('JAVASCRIPT:alert(1)')).toBe('about:blank')
    })

    it('blocks jaVascripT: mixed-case via URL normalization', () => {
      expect(sanitizeUrl('jaVascripT:prompt(document.cookie);')).toBe('about:blank')
    })

    it('blocks data:text/html URLs', () => {
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('about:blank')
    })

    it('blocks data:text/javascript URLs', () => {
      expect(sanitizeUrl('data:text/javascript,alert(1)')).toBe('about:blank')
    })

    it('blocks data:application/javascript URLs', () => {
      expect(sanitizeUrl('data:application/javascript,alert(1)')).toBe('about:blank')
    })

    it('blocks vbscript: URLs', () => {
      expect(sanitizeUrl('vbscript:foo')).toBe('about:blank')
    })

    it('blocks blob: URLs', () => {
      expect(sanitizeUrl('blob:https://canvas.example/abc')).toBe('about:blank')
    })
  })

  describe('edge cases', () => {
    it('replaces totally invalid urls with about:blank', () => {
      expect(sanitizeUrl('https://#')).toBe('about:blank')
    })

    it('handles newline-obfuscated javascript: with about:blank', () => {
      expect(sanitizeUrl('javascri\npt:prompt(document.cookie);')).toBe('about:blank')
    })
  })
})
