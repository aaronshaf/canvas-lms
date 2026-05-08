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

// Regression coverage for stored-XSS via student attempt body. TextEntry's
// read-only path renders submission.body through `dangerouslySetInnerHTML`
// after `apiUserContent.convert(...)`. apiUserContent is a content-rewriter,
// not a sanitizer — it preserves arbitrary author-supplied HTML, so an
// authenticated student (or any actor able to seed a submission body) could
// land an `onerror=` handler or a `<script>` tag that the next viewer of the
// submission would execute.
//
// The "safety" assertion here is "no event handler attribute survives in
// the rendered DOM" and "no <script> tag survives" — DOMPurify allows
// formatting tags but strips on* handlers and script tags, so benign
// markup may appear while remaining inert.

import {render} from '@testing-library/react'
import React from 'react'
import TextEntry from '../TextEntry'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = root => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const buildProps = body => ({
  createSubmissionDraft: vi.fn(),
  focusOnInit: false,
  readOnly: true,
  onContentsChanged: vi.fn(),
  submission: {
    id: '1',
    _id: '1',
    body,
    state: 'submitted',
  },
  submitButtonRef: {current: null},
})

describe('TextEntry — XSS regression (read-only submission body)', () => {
  beforeEach(() => {
    delete window.__xss_fired
  })

  afterEach(() => {
    delete window.__xss_fired
  })

  it('strips inline event handlers from the read-only submission body', () => {
    const malicious = '<img src=x onerror="window.__xss_fired = true">'
    const {container} = render(<TextEntry {...buildProps(malicious)} />)
    expectNoEventHandlers(container)
    expect(window.__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from the read-only submission body', () => {
    const malicious = '<p>hello</p><script>window.__xss_fired = true</script>'
    const {container} = render(<TextEntry {...buildProps(malicious)} />)
    expect(container.querySelector('script')).toBeNull()
    expect(container.innerHTML).not.toMatch(/<script/i)
    expect(window.__xss_fired).toBeUndefined()
  })

  it('renders benign formatting markup intact', () => {
    const benign = '<p>hello <strong>world</strong></p>'
    const {container} = render(<TextEntry {...buildProps(benign)} />)
    expect(container.querySelector('strong')).not.toBeNull()
    expect(container.querySelector('strong').textContent).toBe('world')
    expectNoEventHandlers(container)
  })
})
