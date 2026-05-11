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

// CFA-999: @canvas/sanitize-html must strip protocol-relative URLs from
// URL-bearing attributes. DOMPurify's default ALLOWED_URI_REGEXP permits
// //host/path on src, href, action, etc. — the browser resolves it to
// https://host/path, enabling cross-origin loads from inside Canvas.

import {sanitizeHTML} from '../index'

const strip = (html: string): string => sanitizeHTML(html)
const srcOf = (html: string): string | null => {
  const d = document.createElement('div')
  d.innerHTML = strip(html)
  const el = d.querySelector('[src]')
  return el ? el.getAttribute('src') : null
}
const hrefOf = (html: string): string | null => {
  const d = document.createElement('div')
  d.innerHTML = strip(html)
  const el = d.querySelector('[href]')
  return el ? el.getAttribute('href') : null
}
const attrOf = (html: string, selector: string, attr: string): string | null => {
  const d = document.createElement('div')
  d.innerHTML = strip(html)
  const el = d.querySelector(selector)
  return el ? el.getAttribute(attr) : null
}

describe('sanitizeHTML protocol-relative URL hardening (CFA-999)', () => {
  it('strips //evil.com src from iframe', () => {
    const result = strip('<iframe src="//evil.com/x"></iframe>')
    const d = document.createElement('div')
    d.innerHTML = result
    const iframe = d.querySelector('iframe')
    expect(iframe?.getAttribute('src') ?? null).toBeNull()
  })

  it('strips //evil.com src from img', () => {
    expect(srcOf('<img src="//evil.com/x">')).toBeNull()
  })

  it('strips //evil.com src from video', () => {
    expect(srcOf('<video src="//evil.com/x"></video>')).toBeNull()
  })

  it('strips //evil.com src from audio', () => {
    expect(srcOf('<audio src="//evil.com/x"></audio>')).toBeNull()
  })

  it('strips //evil.com href from anchor', () => {
    expect(hrefOf('<a href="//evil.com/x">click</a>')).toBeNull()
  })

  it('strips \\t//evil.com href (leading whitespace variant)', () => {
    expect(hrefOf('<a href="\t//evil.com/x">click</a>')).toBeNull()
  })

  it('strips //evil.com poster from video', () => {
    expect(attrOf('<video poster="//evil.com/x"></video>', 'video', 'poster')).toBeNull()
  })

  it('preserves /courses/1/files/2 src (same-origin relative)', () => {
    expect(srcOf('<img src="/courses/1/files/2">')).toBe('/courses/1/files/2')
  })

  it('preserves https://www.youtube.com/embed/abc src', () => {
    expect(srcOf('<iframe src="https://www.youtube.com/embed/abc"></iframe>')).toBe(
      'https://www.youtube.com/embed/abc',
    )
  })

  it('preserves https absolute href', () => {
    expect(hrefOf('<a href="https://external.example.com/x">link</a>')).toBe(
      'https://external.example.com/x',
    )
  })

  it('preserves relative image path', () => {
    expect(srcOf('<img src="images/foo.png">')).toBe('images/foo.png')
  })

  it('strips srcset entirely when any candidate is protocol-relative', () => {
    const d = document.createElement('div')
    d.innerHTML = strip('<img src="/good.jpg" srcset="//evil.com/x 1x, /canvas/y.jpg 2x">')
    const img = d.querySelector('img')
    expect(img).not.toBeNull()
    // srcset must be gone — no protocol-relative candidate survives
    expect(img?.getAttribute('srcset')).toBeNull()
  })

  it('preserves srcset with only safe candidates', () => {
    const d = document.createElement('div')
    d.innerHTML = strip(
      '<img src="/good.jpg" srcset="/image@2x.jpg 2x, https://cdn.example.com/img.jpg 1x">',
    )
    const img = d.querySelector('img')
    expect(img?.getAttribute('srcset')).not.toBeNull()
  })
})
