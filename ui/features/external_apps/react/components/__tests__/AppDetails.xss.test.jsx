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

// Regression coverage for stored-XSS in the external app description sink.
//
// `app.description` is rendered via `dangerouslySetInnerHTML` in AppDetails.
// External app catalog content can include rich HTML, but inline event
// handlers and <script> tags must never reach the DOM. Defense-in-depth via
// `@canvas/sanitize-html` (DOMPurify) at this sink ensures that even if the
// upstream backend allowlist misses a payload, no executable handler
// survives client-side rendering.

import React from 'react'
import {render} from '@testing-library/react'
import AppDetails from '../AppDetails'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = root => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const buildStore = description => ({
  findAppByShortName: vi.fn().mockReturnValue({
    short_name: 'someApp',
    config_options: [],
    name: 'Some App',
    description,
  }),
})

describe('AppDetails — XSS regression (description sink)', () => {
  beforeEach(() => {
    delete window.__xss_fired
  })

  afterEach(() => {
    delete window.__xss_fired
  })

  it('strips inline event handlers from the description', () => {
    const malicious = '<p>safe</p><img src="x" onerror="window.__xss_fired=true" alt="boom" />'
    const store = buildStore(malicious)
    const {container} = render(<AppDetails baseUrl="/someUrl" shortName="someApp" store={store} />)

    expectNoEventHandlers(container)
    expect(window.__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from the description', () => {
    const malicious = '<p>safe</p><script>window.__xss_fired = true</script><span>after</span>'
    const store = buildStore(malicious)
    const {container} = render(<AppDetails baseUrl="/someUrl" shortName="someApp" store={store} />)

    expect(container.querySelector('script')).toBeNull()
    expect(window.__xss_fired).toBeUndefined()
  })

  it('renders benign formatting (e.g., <strong>, <em>, <a>) untouched', () => {
    const benign =
      '<p>Hello <strong>world</strong> and <em>friends</em></p>' +
      '<p><a href="https://example.com">link</a></p>'
    const store = buildStore(benign)
    const {container} = render(<AppDetails baseUrl="/someUrl" shortName="someApp" store={store} />)

    expect(container.querySelector('strong')).not.toBeNull()
    expect(container.querySelector('em')).not.toBeNull()
    const link = container.querySelector('a[href="https://example.com"]')
    expect(link).not.toBeNull()
    expect(link.textContent).toBe('link')
    expectNoEventHandlers(container)
  })
})
