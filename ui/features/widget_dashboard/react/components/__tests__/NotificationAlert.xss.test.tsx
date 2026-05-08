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

// Regression coverage for the NotificationAlert dangerouslySetInnerHTML sink.
// Account-notification message HTML is rendered via innerHTML; defense-in-depth
// requires that no script tags or event-handler attributes survive in the
// rendered DOM, regardless of what shape the input HTML took. The shared
// @canvas/sanitize-html (DOMPurify) helper is the final pass at the sink.

import {render} from '@testing-library/react'
import React from 'react'
import NotificationAlert, {AccountNotificationData} from '../NotificationAlert'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const baseNotification: AccountNotificationData = {
  id: '1',
  subject: 'Test Subject',
  message: '<p>placeholder</p>',
  startAt: '2026-01-01T00:00:00Z',
  endAt: '2026-12-31T23:59:59Z',
  accountName: 'Test Account',
  siteAdmin: false,
  notificationType: 'info',
}

const renderWithMessage = (message: string) =>
  render(<NotificationAlert notification={{...baseNotification, message}} onDismiss={() => {}} />)

describe('NotificationAlert — XSS regression', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
  })

  it('strips <script> tags from the rendered notification message', () => {
    const {container} = renderWithMessage(
      '<p>before<script>window.__xss_fired = true</script>after</p>',
    )
    expect(container.querySelector('script')).toBeNull()
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips inline event handlers from the rendered notification message', () => {
    const {container} = renderWithMessage(
      '<p>hi <img src=x onerror="window.__xss_fired = true"></p>',
    )
    expectNoEventHandlers(container)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('does not promote a title-attribute breakout payload into a live event handler', () => {
    // Defense-in-depth shape: even if the input text contains tag-like content
    // inside a title attribute and a downstream string mutator were to break
    // the attribute boundary, the sink-level sanitizer must strip any
    // resulting on* handler in the rendered DOM.
    const {container} = renderWithMessage(
      '<p title="<a ><img src=x onerror=\'window.__xss_fired = true\'>">visible</p>',
    )
    expectNoEventHandlers(container)
    expect((window as any).__xss_fired).toBeUndefined()
  })
})
