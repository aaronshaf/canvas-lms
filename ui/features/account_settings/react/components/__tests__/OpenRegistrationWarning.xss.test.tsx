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

// Regression coverage for the OpenRegistrationWarning innerHTML sink.
// `warningMessage` is built via `I18n.t(..., {wrapper: ...})`, where the
// wrapper template interpolates `props.loginUrl` directly into an
// `<a href="...">` attribute string. A loginUrl carrying quote-breakout
// or `javascript:` content can therefore reach the
// `dangerouslySetInnerHTML` sink as live HTML. CFA-872 wraps that sink
// with the shared DOMPurify wrapper as defense-in-depth: even if a
// non-literal source slips a hostile attribute or tag through, the sink
// strips event handlers, <script>, and javascript: URIs.

import {render} from '@testing-library/react'
import React from 'react'
import OpenRegistrationWarning from '../OpenRegistrationWarning'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

describe('OpenRegistrationWarning — XSS regression', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
  })

  it('strips inline event handlers reaching the sink via loginUrl', () => {
    // Quote-breakout in loginUrl: closes the wrapper href, then injects an
    // <img onerror>. Without sink sanitization this becomes live DOM.
    const hostileUrl = '"><img src=x onerror="window.__xss_fired = true">'
    const {baseElement} = render(
      <OpenRegistrationWarning loginUrl={hostileUrl} closeModal={() => {}} />,
    )

    expectNoEventHandlers(baseElement as HTMLElement)
    // any onerror handler must NOT survive as an attribute on an <img>
    baseElement.querySelectorAll('img').forEach(img => {
      expect(img.getAttribute('onerror')).toBeNull()
    })
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips <script> tags reaching the sink via loginUrl', () => {
    const hostileUrl = '"><script>window.__xss_fired = true</script>'
    const {baseElement} = render(
      <OpenRegistrationWarning loginUrl={hostileUrl} closeModal={() => {}} />,
    )

    expect(baseElement.querySelector('script')).toBeNull()
    expect(baseElement.innerHTML).not.toMatch(/<script/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips javascript: hrefs reaching the sink via loginUrl', () => {
    const hostileUrl = 'javascript:window.__xss_fired = true'
    const {baseElement} = render(
      <OpenRegistrationWarning loginUrl={hostileUrl} closeModal={() => {}} />,
    )

    baseElement.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href') ?? ''
      expect(href.toLowerCase()).not.toMatch(/^\s*javascript:/)
    })
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('renders a benign loginUrl as a normal anchor', () => {
    const {baseElement} = render(
      <OpenRegistrationWarning loginUrl="https://example.com/login" closeModal={() => {}} />,
    )

    const anchors = Array.from(baseElement.querySelectorAll('a'))
    const loginAnchor = anchors.find(a => a.getAttribute('href') === 'https://example.com/login')
    expect(loginAnchor).toBeDefined()
    expectNoEventHandlers(baseElement as HTMLElement)
  })
})
