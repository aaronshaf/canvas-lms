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

// Regression coverage for the alertText `dangerouslySetInnerHTML` sink in
// DisallowThreadedFixAlert. The string is built from an I18n.t template
// with a `<a target="_blank" href="...">` wrapper and reaches the DOM via
// dangerouslySetInnerHTML. CFA-863 wraps that sink with the shared
// DOMPurify helper as defense-in-depth so a hostile locale override or
// future template change cannot smuggle event-handler attributes into
// the rendered DOM.
//
// Strategy: stub `@canvas/i18n` so the I18n.t call that takes a `wrappers`
// option returns the adversarial HTML. All other I18n.t calls (button
// labels, headings) keep returning their key text so the component still
// mounts cleanly. With the DOMPurify wrapper in place the rendered DOM
// has no event handlers and no <script>; without it the payload is live
// HTML.

import React from 'react'
import {render} from '@testing-library/react'

let xssPayload = ''

vi.mock('@canvas/i18n', () => ({
  useScope: () => ({
    t: (key, opts) => {
      if (opts && opts.wrappers) {
        return xssPayload
      }
      return typeof key === 'string' ? key : ''
    },
  }),
}))

import DisallowThreadedFixAlert from '../DisallowThreadedFixAlert'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = root => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

describe('DisallowThreadedFixAlert — XSS regression', () => {
  beforeEach(() => {
    window.ENV = {
      COURSE_ID: '1',
      permissions: {moderate: true},
      HAS_SIDE_COMMENT_DISCUSSIONS: true,
      current_context: {type: 'Course'},
    }
    delete window.__xss_fired
  })

  afterEach(() => {
    window.localStorage.removeItem('disallow_threaded_fix_alert_dismissed_1')
    delete window.__xss_fired
    xssPayload = ''
  })

  it('strips inline event handlers from the alertText sink', () => {
    xssPayload = '<img src=x onerror="window.__xss_fired = true">attack'
    const {container} = render(<DisallowThreadedFixAlert />)
    expectNoEventHandlers(container)
    expect(container.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
    expect(window.__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from the alertText sink', () => {
    xssPayload = 'before<script>window.__xss_fired = true</script>after'
    const {container} = render(<DisallowThreadedFixAlert />)
    expect(container.querySelector('script')).toBeNull()
    expect(container.innerHTML).not.toMatch(/<script/i)
    expect(window.__xss_fired).toBeUndefined()
  })

  it('renders benign anchor + strong tags unchanged', () => {
    xssPayload = '<a href="https://example.com">link</a> and <strong>bold</strong>'
    const {container} = render(<DisallowThreadedFixAlert />)
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.com')
    expect(container.querySelector('strong')?.textContent).toBe('bold')
    expectNoEventHandlers(container)
  })
})
