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

// Regression coverage for XSS via essay answer HTML rendering in
// quiz_log_auditing. The "View HTML" toggle renders the answer string as
// raw HTML via dangerouslySetInnerHTML. Without sanitization, a stored
// answer containing inline event handlers or <script> tags would execute
// when an admin viewed the quiz log.
//
// The "safety" assertion is "no event handler attribute survives in the
// rendered DOM" — DOMPurify legitimately allows <img> and <p> tags but
// strips on* handlers, so a tag may appear while remaining inert.

import {render, fireEvent} from '@testing-library/react'
import React from 'react'
import Essay from '../essay'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

describe('Essay — XSS regression', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
  })

  it('strips inline event handlers from the answer HTML', () => {
    const malicious = '<img src=x onerror="window.__xss_fired=true">'
    const {getByText, container} = render(<Essay answer={malicious} />)

    fireEvent.click(getByText('View HTML'))

    expectNoEventHandlers(container)
    expect((window as any).__xss_fired).toBeUndefined()
    expect(container.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
  })

  it('strips <script> tags from the answer HTML', () => {
    const malicious = '<p>before</p><script>window.__xss_fired=true</script><p>after</p>'
    const {getByText, container} = render(<Essay answer={malicious} />)

    fireEvent.click(getByText('View HTML'))

    expect(container.querySelector('script')).toBeNull()
    expect((window as any).__xss_fired).toBeUndefined()
    expect(container.textContent).toMatch('before')
    expect(container.textContent).toMatch('after')
  })

  it('renders benign formatting markup', () => {
    const benign = '<p><strong>bold</strong> and <em>italic</em></p>'
    const {getByText, container} = render(<Essay answer={benign} />)

    fireEvent.click(getByText('View HTML'))

    expect(container.querySelector('strong')).not.toBeNull()
    expect(container.querySelector('em')).not.toBeNull()
    expect(container.textContent).toMatch('bold')
    expect(container.textContent).toMatch('italic')
  })
})
