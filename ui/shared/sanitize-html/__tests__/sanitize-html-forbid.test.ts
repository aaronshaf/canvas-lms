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

// Rails UJS treats certain data-* attributes as instructions, not opaque
// metadata. Deny the UJS-actionable subset in the frontend wrapper as
// defense-in-depth on top of backend `CanvasSanitize`.

import {sanitizeHTML} from '../index'

const parse = (html: string): Document =>
  new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')

describe('@canvas/sanitize-html FORBID_ATTR — Rails UJS data-*', () => {
  it('strips data-method on an anchor (UJS verb override)', () => {
    const out = sanitizeHTML('<a href="/x" data-method="delete">x</a>')
    const a = parse(out).querySelector('a')
    expect(a).not.toBeNull()
    expect(a?.hasAttribute('data-method')).toBe(false)
    // anchor itself + benign attrs survive
    expect(a?.getAttribute('href')).toBe('/x')
  })

  it('strips data-remote (UJS XHR trigger)', () => {
    const out = sanitizeHTML('<a href="/x" data-remote="true">x</a>')
    expect(parse(out).querySelector('a')?.hasAttribute('data-remote')).toBe(false)
  })

  it('strips data-url (UJS request target override)', () => {
    const out = sanitizeHTML('<span data-url="https://attacker.test">x</span>')
    expect(parse(out).querySelector('span')?.hasAttribute('data-url')).toBe(false)
  })

  it('strips data-confirm (UJS confirm dialog text override)', () => {
    const out = sanitizeHTML('<a href="/admin/destroy" data-confirm="Friendly?">x</a>')
    expect(parse(out).querySelector('a')?.hasAttribute('data-confirm')).toBe(false)
  })

  it('strips data-disable-with (UJS button-disable label)', () => {
    const out = sanitizeHTML('<a href="/x" data-disable-with="...">x</a>')
    expect(parse(out).querySelector('a')?.hasAttribute('data-disable-with')).toBe(false)
  })

  it('strips a full Rails-magic UJS payload', () => {
    const out = sanitizeHTML(
      '<a href="/legitimate" ' +
        'data-method="delete" ' +
        'data-url="https://attacker.test/admin" ' +
        'data-remote="true" ' +
        'data-confirm="Are you sure?" ' +
        'data-disable-with="working...">click</a>',
    )
    const a = parse(out).querySelector('a')
    expect(a).not.toBeNull()
    expect(a?.hasAttribute('data-method')).toBe(false)
    expect(a?.hasAttribute('data-url')).toBe(false)
    expect(a?.hasAttribute('data-remote')).toBe(false)
    expect(a?.hasAttribute('data-confirm')).toBe(false)
    expect(a?.hasAttribute('data-disable-with')).toBe(false)
    expect(a?.getAttribute('href')).toBe('/legitimate')
  })
})

describe('@canvas/sanitize-html FORBID_ATTR does not over-strip', () => {
  it('preserves benign data-* attributes (data-old-link, data-api-endpoint, etc.)', () => {
    const out = sanitizeHTML(
      '<a href="/x" data-old-link="/legacy" data-api-endpoint="/api/v1/foo">x</a>',
    )
    const a = parse(out).querySelector('a')
    expect(a?.getAttribute('data-old-link')).toBe('/legacy')
    expect(a?.getAttribute('data-api-endpoint')).toBe('/api/v1/foo')
  })

  it('preserves Studio iframe data-media-id / data-media-type', () => {
    const out = sanitizeHTML(
      '<iframe src="https://canvas.test/m" data-media-id="m-abc" data-media-type="video"></iframe>',
    )
    const iframe = parse(out).querySelector('iframe')
    expect(iframe?.getAttribute('data-media-id')).toBe('m-abc')
    expect(iframe?.getAttribute('data-media-type')).toBe('video')
  })

  it('preserves form-family elements (legitimate RCE-authored interactive content)', () => {
    const out = sanitizeHTML(
      '<form><input type="text" name="q" />' +
        '<select><option value="a">A</option></select>' +
        '<textarea></textarea>' +
        '<button type="submit">Go</button></form>',
    )
    const doc = parse(out)
    expect(doc.querySelector('form')).not.toBeNull()
    expect(doc.querySelector('input')).not.toBeNull()
    expect(doc.querySelector('select')).not.toBeNull()
    expect(doc.querySelector('textarea')).not.toBeNull()
    expect(doc.querySelector('button')).not.toBeNull()
  })

  it('preserves benign block-level RCE content (paragraphs, lists, tables, links)', () => {
    const input =
      '<h2>Heading</h2>' +
      '<p>A paragraph with <a href="https://canvas.test">a link</a>.</p>' +
      '<ul><li>one</li><li>two</li></ul>' +
      '<table><tr><td>cell</td></tr></table>'
    const out = sanitizeHTML(input)
    const doc = parse(out)
    expect(doc.querySelector('h2')?.textContent).toBe('Heading')
    expect(doc.querySelector('p a')?.getAttribute('href')).toBe('https://canvas.test')
    expect(doc.querySelectorAll('li').length).toBe(2)
    expect(doc.querySelector('table td')?.textContent).toBe('cell')
  })
})
