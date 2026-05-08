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

// Regression coverage for XSS in CalendarEventModal's "Details" sink.
//
// Calendar event descriptions are user-authored HTML rendered via
// `dangerouslySetInnerHTML`. Backend sanitization is allowlist-based and
// generally good, but client-side processors (convertApiUserContent and
// friends) can mutate attribute boundaries and re-promote inert payloads
// into live DOM. The shared @canvas/sanitize-html DOMPurify wrapper at the
// sink is the defense-in-depth layer.
//
// The "safety" assertion is: no event handler attribute (on*) survives
// in the rendered DOM, and no <script> tag executes.

// @ts-nocheck

import React from 'react'
import {render, within} from '@testing-library/react'
import moment from 'moment-timezone'
import CalendarEventModal from '../index'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

function defaultProps(options: Record<string, unknown> = {}) {
  return {
    open: true,
    requestClose: vi.fn(),
    title: 'event title',
    html_url: 'http://example.com',
    courseName: 'the course',
    currentUser: {
      id: '1234',
      displayName: 'me',
      avatarUrl: 'http://example.com',
      color: '#777777',
    },
    location: 'somewhere',
    address: 'here, specifically',
    details: 'about this event',
    startTime: moment.tz('2018-09-27T13:00:00', 'Asia/Tokyo'),
    endTime: moment.tz('2018-09-27T14:00:00', 'Asia/Tokyo'),
    allDay: false,
    timeZone: 'Asia/Tokyo',
    ...options,
  }
}

describe('CalendarEventModal — XSS regression', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
  })

  it('strips inline event handlers from the details HTML', () => {
    const props = defaultProps({
      details: '<img src=x onerror="window.__xss_fired = true">',
    })
    render(<CalendarEventModal {...props} />)

    expectNoEventHandlers(document.body)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from the details HTML', () => {
    const props = defaultProps({
      details: '<p>hello</p><script>window.__xss_fired = true;</script>',
    })
    render(<CalendarEventModal {...props} />)

    // Any <script> tag inside the modal/details sink must be gone.
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement | null
    expect(dialog).not.toBeNull()
    expect(dialog!.querySelector('script')).toBeNull()
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('renders benign formatting (paragraphs, emphasis, links) intact', () => {
    const props = defaultProps({
      details:
        '<p>Bring <strong>a notebook</strong> and review the <a href="https://example.com/agenda">agenda</a>.</p>',
    })
    render(<CalendarEventModal {...props} />)

    const dialog = document.querySelector('[role="dialog"]') as HTMLElement | null
    expect(dialog).not.toBeNull()
    expect(within(dialog!).getByText('a notebook')).toBeInTheDocument()
    expect(within(dialog!).getByText('agenda')).toBeInTheDocument()
    expect(dialog!.querySelector('strong')).not.toBeNull()
    expect(dialog!.querySelector('a[href="https://example.com/agenda"]')).not.toBeNull()
    expectNoEventHandlers(dialog!)
  })
})
