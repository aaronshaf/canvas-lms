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

// Regression coverage for stored XSS through the AnnouncementRow text
// preview sink. The component builds a detached <span>, assigns the
// RCE-authored `announcement.message` to its `innerHTML`, then reads
// `textContent`. Even though only the text is consumed, the html parser
// fires side-effect-bearing attribute values (e.g. <img onerror>) during
// the write, so the parse path itself must be inert. The other
// observable leak without sanitization: the textContent of <script> and
// <style> blocks bleeds into the visible preview as plain text, exposing
// payload source. With the @canvas/sanitize-html DOMPurify wrapper in
// place, dangerous tags are removed before textContent is read.

import React from 'react'
import {render} from '@testing-library/react'
import AnnouncementRow from '../AnnouncementRow'

vi.mock('@canvas/lock-icon', () => ({
  default: vi.fn(function MockLockIconView() {
    return {render: vi.fn(), remove: vi.fn()}
  }),
}))

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const buildProps = (message: string) => ({
  canManage: false,
  masterCourseData: {},
  announcement: {
    id: '1',
    position: 1,
    published: true,
    title: 'Hello World',
    message,
    posted_at: 'January 10, 2019 at 10:00 AM',
    author: {
      id: '5',
      name: 'John Smith',
      display_name: 'John Smith',
      html_url: '',
      avatar_image_url: null,
    },
    read_state: 'unread' as const,
    unread_count: 0,
    discussion_subentry_count: 0,
    locked: false,
    html_url: '',
    user_count: 10,
    permissions: {reply: true},
  },
})

const previewBody = (container: HTMLElement) =>
  container.querySelector('.ic-announcement-row__content')

describe('AnnouncementRow — XSS regression', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
  })

  it('does not leak <script> source into the rendered text preview', () => {
    const payload = '<p>before</p><script>window.__xss_fired = true</script><p>after</p>'
    const {container} = render(<AnnouncementRow {...buildProps(payload)} />)

    const text = previewBody(container)?.textContent ?? ''
    expect(text).toContain('before')
    expect(text).toContain('after')
    expect(text).not.toContain('__xss_fired')
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('does not fire <img onerror> handlers from announcement.message', () => {
    const payload = '<p>hello <img src=x onerror="window.__xss_fired = true"> world</p>'
    const {container} = render(<AnnouncementRow {...buildProps(payload)} />)

    expectNoEventHandlers(container)
    expect(container.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips javascript: hrefs before textContent extraction', () => {
    const payload = '<p><a href="javascript:window.__xss_fired = true">click</a></p>'
    const {container} = render(<AnnouncementRow {...buildProps(payload)} />)

    expectNoEventHandlers(container)
    expect(container.innerHTML).not.toMatch(/javascript:/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('still renders legitimate text content (control case)', () => {
    const payload = '<p>hello world</p>'
    const {container} = render(<AnnouncementRow {...buildProps(payload)} />)

    expect(previewBody(container)?.textContent).toContain('hello world')
    expectNoEventHandlers(container)
  })
})
