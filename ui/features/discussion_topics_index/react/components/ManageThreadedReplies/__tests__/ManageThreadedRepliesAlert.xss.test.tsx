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

// Regression coverage for the alertTitle and alertText
// `dangerouslySetInnerHTML` sinks in ManageThreadedRepliesAlert. Both
// strings are I18n.t templates with `<strong>` / `<a target="_blank">`
// wrappers and reach the DOM via dangerouslySetInnerHTML. CFA-863 wraps
// each sink with the shared DOMPurify helper as defense-in-depth so a
// hostile locale override or future template change cannot smuggle
// event-handler attributes into the rendered DOM.
//
// We mock @canvas/i18n so I18n.t calls with a `wrappers` option return
// adversarial HTML; calls without it (button labels) keep returning their
// key text.

import React from 'react'
import {render} from '@testing-library/react'
import {useManageThreadedRepliesStore} from '../../../hooks/useManageThreadedRepliesStore'
import fakeENV from '@canvas/test-utils/fakeENV'

vi.mock('../../../hooks/useManageThreadedRepliesStore', () => ({
  useManageThreadedRepliesStore: vi.fn(),
}))

let xssPayload = ''

vi.mock('@canvas/i18n', () => ({
  useScope: () => ({
    t: (...args: unknown[]) => {
      // I18n.t(key, opts) or I18n.t({one,other}, opts)
      const opts = args[args.length - 1]
      if (opts && typeof opts === 'object' && 'wrappers' in (opts as object)) {
        return xssPayload
      }
      const key = args[0]
      return typeof key === 'string' ? key : ''
    },
  }),
}))

import ManageThreadedRepliesAlert from '../ManageThreadedRepliesAlert'

const mockUseManageThreadedRepliesStore = useManageThreadedRepliesStore as unknown as ReturnType<
  typeof vi.fn
>

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

describe('ManageThreadedRepliesAlert — XSS regression', () => {
  beforeEach(() => {
    fakeENV.setup()
    window.ENV.AMOUNT_OF_SIDE_COMMENT_DISCUSSIONS = '5'
    mockUseManageThreadedRepliesStore.mockReturnValue(true)
    delete (window as unknown as {__xss_fired?: unknown}).__xss_fired
    xssPayload = ''
  })

  afterEach(() => {
    fakeENV.teardown()
    delete (window as unknown as {__xss_fired?: unknown}).__xss_fired
  })

  it('strips inline event handlers from the alert sinks', () => {
    xssPayload = '<img src=x onerror="window.__xss_fired = true">attack'
    const {container} = render(<ManageThreadedRepliesAlert onOpen={vi.fn()} />)
    expectNoEventHandlers(container)
    expect(container.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
    expect((window as unknown as {__xss_fired?: unknown}).__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from the alert sinks', () => {
    xssPayload = 'before<script>window.__xss_fired = true</script>after'
    const {container} = render(<ManageThreadedRepliesAlert onOpen={vi.fn()} />)
    expect(container.querySelector('script')).toBeNull()
    expect(container.innerHTML).not.toMatch(/<script/i)
    expect((window as unknown as {__xss_fired?: unknown}).__xss_fired).toBeUndefined()
  })

  it('renders benign anchor + strong tags unchanged', () => {
    xssPayload = '<a href="https://example.com">link</a> and <strong>bold</strong>'
    const {container} = render(<ManageThreadedRepliesAlert onOpen={vi.fn()} />)
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.com')
    expect(container.querySelectorAll('strong').length).toBeGreaterThan(0)
    expectNoEventHandlers(container)
  })
})
