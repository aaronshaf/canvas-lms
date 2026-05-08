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

// Regression coverage for the RCE content rendering href sinks.
// renderLink and renderLinkedImage build HTML strings that TinyMCE
// inserts into editor content; a javascript: URL flowing through the
// pipeline must not reach the resulting <a href>. The combined chain
// of sanitizeUrl + cleanUrl + absoluteToRelativeUrl is the defense.

import {renderLink, renderLinkedImage} from '../contentRendering'

const canvasOrigin = 'https://mycanvas.com:3000'

const parseAnchor = html => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const a = doc.querySelector('a')
  if (!a) throw new Error(`expected <a> in: ${html}`)
  return a
}

describe('contentRendering renderLink — URL sanitization', () => {
  it('does not produce a javascript: href for a javascript: input', () => {
    const rendered = renderLink(
      {href: 'javascript:alert(1)', text: 'click', title: 'x'},
      'click',
      canvasOrigin,
    )
    expect(parseAnchor(rendered).getAttribute('href') ?? '').not.toMatch(/^\s*javascript:/i)
  })

  it('passes through legitimate https: hrefs unchanged', () => {
    const rendered = renderLink(
      {href: 'https://example.com/file.pdf', text: 'pdf', title: 'x'},
      'pdf',
      canvasOrigin,
    )
    expect(parseAnchor(rendered).getAttribute('href')).toBe('https://example.com/file.pdf')
  })
})

describe('contentRendering renderLinkedImage — URL sanitization', () => {
  it('does not produce a javascript: href for a javascript: linkElem input', () => {
    const linkElem = {getAttribute: () => 'javascript:alert(1)'}
    const image = {href: 'https://example.com/thumb.png', width: 32, height: 32}
    const rendered = renderLinkedImage(linkElem, image, canvasOrigin)
    expect(parseAnchor(rendered).getAttribute('href') ?? '').not.toMatch(/^\s*javascript:/i)
  })

  it('does not strip a benign relative href', () => {
    const linkElem = {getAttribute: () => '/courses/1/pages/intro'}
    const image = {href: 'https://example.com/thumb.png', width: 32, height: 32}
    const rendered = renderLinkedImage(linkElem, image, canvasOrigin)
    expect(parseAnchor(rendered).getAttribute('href')).toBe('/courses/1/pages/intro')
  })
})
