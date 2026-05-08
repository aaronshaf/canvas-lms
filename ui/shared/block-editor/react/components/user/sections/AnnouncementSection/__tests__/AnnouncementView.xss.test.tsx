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

// Regression coverage for the AnnouncementView dangerouslySetInnerHTML sink.
// The announcement.message is rendered via innerHTML; defense-in-depth
// requires that no script tags or event-handler attributes survive in the
// rendered DOM. The shared @canvas/sanitize-html (DOMPurify) helper is the
// final pass at the sink.

import {render} from '@testing-library/react'
import React from 'react'
import {AnnouncementView} from '../AnnouncementView'
import {users} from '../../../../../assets/data/announcements'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const renderWithMessage = (message: string) =>
  render(
    <AnnouncementView
      announcement={{
        id: '1',
        user_id: users[0].id,
        title: 'Title',
        message,
      }}
    />,
  )

describe('AnnouncementView — XSS regression', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
  })

  it('strips inline event handlers from announcement message', () => {
    const {container} = renderWithMessage('<img src=x onerror="window.__xss_fired = true">')
    expectNoEventHandlers(container)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from announcement message', () => {
    const {container} = renderWithMessage('<script>window.__xss_fired = true</script>')
    expect(container.querySelector('script')).toBeNull()
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('renders benign HTML formatting (bold/italics/links)', () => {
    const {container} = renderWithMessage(
      '<p><strong>important</strong> <em>note</em> <a href="https://example.com">link</a></p>',
    )
    expect(container.querySelector('strong')).not.toBeNull()
    expect(container.querySelector('em')).not.toBeNull()
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.com')
  })
})
