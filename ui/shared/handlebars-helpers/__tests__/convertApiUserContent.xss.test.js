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

// XSS regression tests for convertApiUserContent Handlebars helper.
// The helper wraps output as Handlebars.SafeString (unescaped) without
// an explicit sanitizeHTML() call. Adding sanitizeHTML() before the
// SafeString wrap provides defense-in-depth at the unescaped output step.

import Handlebars from '../index'

const callHelper = (html, hashOpts = {}) =>
  Handlebars.helpers.convertApiUserContent(html, {hash: hashOpts})

describe('convertApiUserContent XSS hardening', () => {
  it('strips onerror from img tags in SafeString output', () => {
    const result = callHelper('<img src="x" onerror="window.__xss988=1">')
    const div = document.createElement('div')
    div.innerHTML = String(result)
    const img = div.querySelector('img')
    if (img) {
      expect(img.getAttribute('onerror')).toBeNull()
    }
    expect(window.__xss988).toBeUndefined()
  })

  it('strips javascript: hrefs in SafeString output', () => {
    const result = callHelper('<a href="javascript:window.__xss988b=1">click</a>')
    const div = document.createElement('div')
    div.innerHTML = String(result)
    const anchor = div.querySelector('a')
    if (anchor) {
      const href = anchor.getAttribute('href') ?? ''
      expect(href).not.toMatch(/^javascript:/i)
    }
    expect(window.__xss988b).toBeUndefined()
  })

  it('preserves safe HTML content', () => {
    const result = callHelper('<p><strong>Hello</strong></p>')
    expect(String(result)).toContain('Hello')
  })

  it('returns a plain string (not SafeString) when forEditing is true', () => {
    // forEditing=true means content goes to TinyMCE — must not be a SafeString
    const result = callHelper('<p>edit me</p>', {forEditing: true})
    expect(typeof result).toBe('string')
    // SafeString instances are objects, not primitives
    expect(result).not.toBeInstanceOf(Object)
  })
})
