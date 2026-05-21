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

import {sanitizeToolHtml} from '../sanitizeToolHtml'

describe('sanitizeToolHtml (regression: 91af8f0373c)', () => {
  // Before fix: LTI-authored HTML was inserted into the RCE without sanitization.
  // After fix: DOMPurify strips script tags, event handlers, and javascript: URIs.

  describe('safe passthrough', () => {
    it('passes through plain text unchanged', () => {
      expect(sanitizeToolHtml('hello world')).toBe('hello world')
    })

    it('passes through safe anchor tags', () => {
      const result = sanitizeToolHtml('<a href="https://example.com" target="_blank">link</a>')
      expect(result).toContain('href="https://example.com"')
      expect(result).toContain('target="_blank"')
    })

    it('passes through safe iframe tags with allowed attributes', () => {
      const result = sanitizeToolHtml(
        '<iframe src="https://example.com" allowfullscreen sandbox="allow-scripts"></iframe>',
      )
      expect(result).toContain('<iframe')
      expect(result).toContain('allowfullscreen')
      expect(result).toContain('sandbox')
    })

    it('passes through safe img tags', () => {
      const result = sanitizeToolHtml('<img src="https://example.com/image.png" alt="a photo">')
      expect(result).toContain('src="https://example.com/image.png"')
    })

    it('handles null input', () => {
      expect(sanitizeToolHtml(null)).toBe('')
    })

    it('handles undefined input', () => {
      expect(sanitizeToolHtml(undefined)).toBe('')
    })

    it('handles empty string', () => {
      expect(sanitizeToolHtml('')).toBe('')
    })
  })

  describe('XSS event handler stripping', () => {
    it('strips onerror from img tags', () => {
      const result = sanitizeToolHtml('<img src="x" onerror="alert(1)">')
      expect(result).not.toContain('onerror')
    })

    it('strips onclick from anchor tags', () => {
      const result = sanitizeToolHtml('<a onclick="alert(1)" href="https://example.com">link</a>')
      expect(result).not.toContain('onclick')
    })

    it('strips onload from iframe tags', () => {
      const result = sanitizeToolHtml(
        '<iframe onload="alert(1)" src="https://example.com"></iframe>',
      )
      expect(result).not.toContain('onload')
    })
  })

  describe('script tag stripping', () => {
    it('strips script tags entirely', () => {
      const result = sanitizeToolHtml('<p>safe</p><script>window.__pwned=1</script>')
      expect(result).not.toContain('<script')
      expect(result).toContain('safe')
    })

    it('strips script tags with src', () => {
      const result = sanitizeToolHtml('<script src="https://evil.example/payload.js"></script>')
      expect(result).not.toContain('<script')
    })
  })

  describe('javascript: URI stripping', () => {
    it('strips javascript: URIs from href', () => {
      const result = sanitizeToolHtml('<a href="javascript:alert(1)">click</a>')
      expect(result).not.toContain('javascript:')
    })
  })

  describe('Rails UJS data-* attribute stripping', () => {
    it('strips data-method attribute', () => {
      const result = sanitizeToolHtml('<a href="/delete" data-method="delete">delete</a>')
      expect(result).not.toContain('data-method')
    })

    it('strips data-remote attribute', () => {
      const result = sanitizeToolHtml('<a href="/api" data-remote="true">go</a>')
      expect(result).not.toContain('data-remote')
    })

    it('strips data-url attribute', () => {
      const result = sanitizeToolHtml('<a data-url="/target">x</a>')
      expect(result).not.toContain('data-url')
    })

    it('strips data-confirm attribute', () => {
      const result = sanitizeToolHtml('<a href="/del" data-confirm="sure?">delete</a>')
      expect(result).not.toContain('data-confirm')
    })

    it('strips data-disable-with attribute', () => {
      const result = sanitizeToolHtml('<button data-disable-with="Loading...">Submit</button>')
      expect(result).not.toContain('data-disable-with')
    })
  })

  describe('CSS property filtering', () => {
    it('strips position from style attributes', () => {
      const result = sanitizeToolHtml('<div style="position:fixed;color:red">x</div>')
      expect(result).not.toContain('position')
      expect(result).toContain('color')
    })

    it('strips z-index from style attributes', () => {
      const result = sanitizeToolHtml('<div style="z-index:9999;font-size:12px">x</div>')
      expect(result).not.toContain('z-index')
      expect(result).toContain('font-size')
    })

    it('strips overlay-capable properties (top/left/right/bottom)', () => {
      const result = sanitizeToolHtml(
        '<div style="top:0;left:0;right:0;bottom:0;color:blue">x</div>',
      )
      expect(result).not.toContain('top:')
      expect(result).not.toContain('left:')
      expect(result).toContain('color')
    })

    it('preserves safe CSS properties', () => {
      const result = sanitizeToolHtml('<div style="color:red;font-size:14px;margin:8px">x</div>')
      expect(result).toContain('color')
      expect(result).toContain('font-size')
      expect(result).toContain('margin')
    })
  })

  describe('LTI-specific iframe attributes', () => {
    it('preserves data-media-id attribute on iframes', () => {
      const result = sanitizeToolHtml(
        '<iframe data-media-id="m-abc123" src="https://canvas.example.com/media"></iframe>',
      )
      expect(result).toContain('data-media-id="m-abc123"')
    })

    it('preserves data-media-type attribute on iframes', () => {
      const result = sanitizeToolHtml(
        '<iframe data-media-type="video" src="https://canvas.example.com/media"></iframe>',
      )
      expect(result).toContain('data-media-type="video"')
    })

    it('preserves allowfullscreen attribute', () => {
      const result = sanitizeToolHtml('<iframe allowfullscreen src="https://example.com"></iframe>')
      expect(result).toContain('allowfullscreen')
    })
  })
})
