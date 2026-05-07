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

// Regression coverage for a title-attribute stored-XSS class against
// DiscussionEntry.message.
//
// Payload class: angle brackets nested inside a title="..." attribute. The
// browser keeps a title value as an inert string at parse time, so the
// payload is dormant — until a downstream processor mutates the HTML in a
// way that escapes the attribute boundary. SearchSpan's `addTargetToLinks`
// (regex `/<a\s/gi` -> `<a target="_top" `) is exactly that kind of
// mutator: replacing a `<a ` *inside* the title attribute injects a `"`
// that prematurely closes title="...", promoting the embedded
// `<img onerror=…>` into a real DOM element when set as innerHTML.
//
// The "safety" assertion in these tests is "no event handler attribute
// survives in the rendered DOM" — DOMPurify legitimately allows <img>
// tags but strips on* handlers, so the tag may appear while remaining
// inert.

import {render} from '@testing-library/react'
import React from 'react'
import {sanitizeHTML} from '@canvas/sanitize-html'
import {SearchSpan} from '../SearchSpan'

const MALICIOUS_MESSAGE =
  '<p>visible</p>' +
  '<p style="display:none" ' +
  'title="<a ><img src=canvas-analytics onerror=\'window.__xss_fired=true\'>">' +
  '</p>'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

describe('SearchSpan — XSS regression (title-attribute breakout)', () => {
  let originalLocation: Location

  beforeEach(() => {
    originalLocation = window.location
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {value: originalLocation, writable: true})
    delete (window as any).__xss_fired
  })

  const setLocationSearch = (search: string) => {
    Object.defineProperty(window, 'location', {
      value: {...originalLocation, search},
      writable: true,
    })
  }

  // --- Mechanism reproducers (no React) ----------------------------------

  it('REPRO: the unsafe addTargetToLinks regex breaks out of title="..." and produces an <img onerror=…>', () => {
    // Mimic SearchSpan's `html.replace(/<a\s/gi, '<a target="_top" ')`.
    // The payload's title value contains the literal substring `<a `, so the
    // regex matches inside the attribute. The injected `"` in `target="_top"`
    // prematurely closes title="...", making the embedded img a real tag.
    const broken = MALICIOUS_MESSAGE.replace(/<a\s/gi, '<a target="_top" ')

    const div = document.createElement('div')
    div.innerHTML = broken

    const img = div.querySelector('img')
    expect(img).not.toBeNull()
    expect(img!.getAttribute('onerror')).toBe('window.__xss_fired=true')
  })

  it('FIX: sanitizing the OUTPUT of the regex munging strips the escaped event handler', () => {
    const broken = MALICIOUS_MESSAGE.replace(/<a\s/gi, '<a target="_top" ')
    const sanitized = sanitizeHTML(broken)

    // DOMPurify may keep the <img> tag, but the on* handler must be gone.
    expect(sanitized).not.toMatch(/\son[a-z]+\s*=/i)

    const div = document.createElement('div')
    div.innerHTML = sanitized
    expectNoEventHandlers(div)
  })

  // --- SearchSpan integration --------------------------------------------

  it('SearchSpan: renders the malicious payload with no event handlers (no embed, no search)', () => {
    const {container} = render(<SearchSpan htmlBody={MALICIOUS_MESSAGE} searchTerm="" />)
    expectNoEventHandlers(container)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('SearchSpan: renders safely in embed mode where addTargetToLinks fires', () => {
    setLocationSearch('?embed=true')
    const {container} = render(<SearchSpan htmlBody={MALICIOUS_MESSAGE} searchTerm="" />)
    expectNoEventHandlers(container)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('SearchSpan: renders safely when search highlighting injects a span near a title attribute', () => {
    // addSearchHighlighting splits on `<` / `>` without respecting attribute
    // boundaries. A search term that hits a chunk straddling an attribute
    // value can inject a <span> mid-attribute. Output sanitization defuses
    // whatever tags break out.
    const {container} = render(<SearchSpan htmlBody={MALICIOUS_MESSAGE} searchTerm="display" />)
    expectNoEventHandlers(container)
    expect((window as any).__xss_fired).toBeUndefined()
  })
})
