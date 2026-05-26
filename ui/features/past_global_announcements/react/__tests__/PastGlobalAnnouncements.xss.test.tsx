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

// Regression coverage for stored-XSS through past_global_announcements.
//
// AnnouncementFactory and AnnouncementPagination both render server-supplied
// HTML through `dangerouslySetInnerHTML`. Backend allowlisting normally
// strips dangerous markup, but defense-in-depth client sanitization at the
// sink is what guarantees that downstream regex/DOM mutators or any backend
// gap cannot promote attribute-encoded payloads into live event handlers.
//
// The "safety" assertion in these tests is "no event handler attribute
// survives in the rendered DOM" — DOMPurify legitimately allows benign tags
// while stripping on* handlers, javascript: URIs, and <script>.

import {render, fireEvent} from '@testing-library/react'
import React from 'react'
import fakeENV from '@canvas/test-utils/fakeENV'
import PastGlobalAnnouncements from '../PastGlobalAnnouncements'
import AnnouncementFactory from '../AnnouncementFactory'
import AnnouncementPagination from '../AnnouncementPagination'

vi.mock('@canvas/rce/serviceRCELoader')
const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const INLINE_HANDLER_PAYLOAD =
  '<div><p>safe copy</p>' + '<img src=x onerror="window.__xss_fired = true">' + '</div>'

const SCRIPT_PAYLOAD =
  '<div><p>safe copy</p>' + '<script>window.__xss_fired = true</script>' + '</div>'

const BENIGN_PAYLOAD =
  '<div><p>hello <strong>world</strong></p><a href="https://example.com">link</a></div>'

describe('past_global_announcements — XSS regression at dangerouslySetInnerHTML sinks', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
    fakeENV.teardown()
  })

  describe('AnnouncementFactory (single announcement branch)', () => {
    it('strips inline event handlers from a single rendered announcement', () => {
      const {container} = render(
        <div>{AnnouncementFactory([INLINE_HANDLER_PAYLOAD], 'Current')}</div>,
      )
      expectNoEventHandlers(container)
      expect((window as any).__xss_fired).toBeUndefined()
    })

    it('strips <script> tags from a single rendered announcement', () => {
      const {container} = render(<div>{AnnouncementFactory([SCRIPT_PAYLOAD], 'Current')}</div>)
      expect(container.querySelector('script')).toBeNull()
      expect((window as any).__xss_fired).toBeUndefined()
    })

    it('renders benign formatting (text + <strong> + safe link)', () => {
      const {container, getByText} = render(
        <div>{AnnouncementFactory([BENIGN_PAYLOAD], 'Current')}</div>,
      )
      expect(getByText('world').tagName).toBe('STRONG')
      const anchor = container.querySelector('a')
      expect(anchor).not.toBeNull()
      expect(anchor!.getAttribute('href')).toBe('https://example.com')
      expectNoEventHandlers(container)
    })
  })

  describe('AnnouncementPagination (multi-announcement branch)', () => {
    it('strips inline event handlers across paged announcements', () => {
      const {container, getByText} = render(
        <AnnouncementPagination
          announcements={[INLINE_HANDLER_PAYLOAD, INLINE_HANDLER_PAYLOAD]}
          section="Current"
        />,
      )
      expectNoEventHandlers(container)
      // Flip to page 2 so we exercise the same sink with another payload.
      fireEvent.click(getByText('2'))
      expectNoEventHandlers(container)
      expect((window as any).__xss_fired).toBeUndefined()
    })

    it('strips <script> tags across paged announcements', () => {
      const {container, getByText} = render(
        <AnnouncementPagination
          announcements={[SCRIPT_PAYLOAD, SCRIPT_PAYLOAD]}
          section="Current"
        />,
      )
      expect(container.querySelector('script')).toBeNull()
      fireEvent.click(getByText('2'))
      expect(container.querySelector('script')).toBeNull()
      expect((window as any).__xss_fired).toBeUndefined()
    })
  })

  describe('PastGlobalAnnouncements integration via ENV.global_notifications', () => {
    it('strips inline event handlers when announcements ship from ENV', () => {
      fakeENV.setup({
        global_notifications: {
          current: [INLINE_HANDLER_PAYLOAD],
          past: [],
        },
      })
      // @ts-expect-error - WithBreakpoints HOC injects breakpoints prop
      const {container} = render(<PastGlobalAnnouncements />)
      expectNoEventHandlers(container)
      expect((window as any).__xss_fired).toBeUndefined()
    })

    it('strips <script> tags when announcements ship from ENV', () => {
      fakeENV.setup({
        global_notifications: {
          current: [SCRIPT_PAYLOAD],
          past: [],
        },
      })
      // @ts-expect-error - WithBreakpoints HOC injects breakpoints prop
      const {container} = render(<PastGlobalAnnouncements />)
      expect(container.querySelector('script')).toBeNull()
      expect((window as any).__xss_fired).toBeUndefined()
    })
  })
})
