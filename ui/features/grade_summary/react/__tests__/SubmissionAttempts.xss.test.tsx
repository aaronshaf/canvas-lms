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

// Regression coverage for stored XSS via the SubmissionAttempts comment
// rendering sink. Submission comments flow through `containsHtmlTags` →
// (HTML passed through verbatim) | `formatMessage`, then land in a
// `dangerouslySetInnerHTML` wrapped by the shared @canvas/sanitize-html
// DOMPurify helper. With the wrapper in place the rendered DOM has no
// event handlers and no <script>; without the wrapper the payload is
// live HTML.

import {render} from '@testing-library/react'
import React from 'react'

vi.mock('@instructure/studio-player', () => ({
  StudioPlayer: vi.fn().mockImplementation(() => <div>StudioPlayer</div>),
}))

import SubmissionAttempts, {type SubmissionAttemptsProps} from '../SubmissionAttempts'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const buildProps = (comment: string): SubmissionAttemptsProps => ({
  attempts: {
    1: [
      {
        id: '1',
        comment,
        is_read: true,
        author_name: 'attacker',
        display_updated_at: 'Saturday December 1st',
        attachments: [],
      },
    ],
  },
})

describe('SubmissionAttempts — XSS regression', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
  })

  it('strips inline event handlers from rendered comment HTML', () => {
    const payload = '<p>hello <img src=x onerror="window.__xss_fired = true"> world</p>'
    const {container} = render(<SubmissionAttempts {...buildProps(payload)} />)

    expectNoEventHandlers(container)
    expect(container.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from rendered comment HTML', () => {
    const payload = '<p>before</p><script>window.__xss_fired = true</script><p>after</p>'
    const {container} = render(<SubmissionAttempts {...buildProps(payload)} />)

    expect(container.querySelector('script')).toBeNull()
    expect(container.innerHTML).not.toMatch(/<script/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('renders benign formatting tags unchanged', () => {
    const payload = '<p><strong>bold</strong> and <em>italic</em></p>'
    const {container} = render(<SubmissionAttempts {...buildProps(payload)} />)

    expect(container.querySelector('strong')?.textContent).toBe('bold')
    expect(container.querySelector('em')?.textContent).toBe('italic')
    expectNoEventHandlers(container)
  })
})
