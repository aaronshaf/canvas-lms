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

import {makeAllExternalLinksExternalLinks} from '../external_links'

vi.useFakeTimers()
afterAll(() => vi.useRealTimers())

const setup = html => {
  document.body.innerHTML = `<div id="content">${html}</div>`
}

const run = () => {
  makeAllExternalLinksExternalLinks()
  vi.runAllTimers()
}

beforeEach(() => {
  delete window.location
  window.location = {hostname: 'canvas.instructure.com'}
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('makeAllExternalLinksExternalLinks', () => {
  it('adds .external and target=_blank to external links', () => {
    setup('<a href="https://example.com/">link</a>')
    run()
    const link = document.querySelector('a')
    expect(link.classList.contains('external')).toBe(true)
    expect(link.getAttribute('target')).toEqual('_blank')
    expect(link.getAttribute('rel')).toEqual('noreferrer noopener')
  })

  it('adds the external link icon', () => {
    setup('<a href="https://example.com/">link</a>')
    run()
    expect(document.querySelector('span.external_link_icon')).toBeInTheDocument()
  })

  it('wraps link children in a span', () => {
    setup('<a href="https://example.com/">link text</a>')
    run()
    const span = document.querySelector('a > span:not(.external_link_icon)')
    expect(span).toBeInTheDocument()
    expect(span.textContent).toEqual('link text')
  })

  it('preserves nested element structure in the wrapping span', () => {
    setup('<a href="https://example.com/"><em>italic</em> text</a>')
    run()
    const span = document.querySelector('a > span:not(.external_link_icon)')
    expect(span.querySelector('em')).toBeInTheDocument()
    expect(span.textContent).toEqual('italic text')
  })

  it('preserves text with HTML special characters in the wrapping span', () => {
    setup('<a href="https://example.com/">AT&amp;T</a>')
    run()
    const span = document.querySelector('a > span:not(.external_link_icon)')
    expect(span.textContent).toEqual('AT&T')
  })

  it('skips links containing images', () => {
    setup('<a href="https://example.com/"><img src="x.png" /></a>')
    run()
    expect(document.querySelector('a.external')).not.toBeInTheDocument()
  })

  it('skips links already marked .external', () => {
    setup('<a href="https://example.com/" class="external">already done</a>')
    run()
    // only one span.external_link_icon would appear if re-processed; none should
    expect(document.querySelectorAll('span.external_link_icon')).toHaveLength(0)
  })

  it('skips links marked .not_external', () => {
    setup('<a href="https://example.com/" class="not_external">skip me</a>')
    run()
    expect(document.querySelector('a.external')).not.toBeInTheDocument()
  })

  it('skips links marked .open_in_a_new_tab', () => {
    setup('<a href="https://example.com/" class="open_in_a_new_tab">skip me</a>')
    run()
    expect(document.querySelector('a.external')).not.toBeInTheDocument()
  })

  it('does nothing when #content element is absent', () => {
    document.body.innerHTML = '<a href="https://example.com/">link</a>'
    expect(() => run()).not.toThrow()
    expect(document.querySelector('a.external')).not.toBeInTheDocument()
  })
})
