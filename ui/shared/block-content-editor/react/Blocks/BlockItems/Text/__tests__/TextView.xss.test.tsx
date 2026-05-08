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

// Regression coverage for XSS at the block-content-editor TextView sink.
//
// TextView renders user-authored block content via dangerouslySetInnerHTML.
// Without sanitization, an attacker who lands HTML in a text block can ship
// inline event handlers (onerror=…) or <script> tags straight into the
// reader's DOM. Backend allowlisting is not sufficient on its own — DOM
// round-trips can mutate attribute boundaries and revive payloads — so we
// also sanitize at the sink. These tests assert the sink is hardened: the
// rendered DOM must contain zero on*-handler attributes and no <script>
// tags, regardless of input.

import {render} from '@testing-library/react'
import React from 'react'
import {TextView} from '../TextView'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

describe('TextView — XSS regression', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
  })

  it('strips inline event handlers from rendered DOM', () => {
    const payload = '<img src=x onerror="window.__xss_fired = true">'
    const {container} = render(<TextView content={payload} />)

    expectNoEventHandlers(container)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips <script> tags', () => {
    const payload = '<script>window.__xss_fired = true</script>'
    const {container} = render(<TextView content={payload} />)

    expect(container.querySelector('script')).toBeNull()
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('renders benign formatting (<strong>, <em>)', () => {
    const payload = '<p><strong>bold</strong> and <em>italic</em> text</p>'
    const {container} = render(<TextView content={payload} />)

    expect(container.querySelector('strong')?.textContent).toBe('bold')
    expect(container.querySelector('em')?.textContent).toBe('italic')
    expectNoEventHandlers(container)
  })
})
