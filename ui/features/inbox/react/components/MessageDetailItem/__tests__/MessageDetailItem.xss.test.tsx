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

// Regression coverage for the MessageDetailItem dangerouslySetInnerHTML sink.
// The conversation message body is rendered via innerHTML; defense-in-depth
// requires that no script tags or event-handler attributes survive in the
// rendered DOM, regardless of what shape the input HTML took. The shared
// @canvas/sanitize-html (DOMPurify) helper is the final pass at the sink.

import {render} from '@testing-library/react'
import React from 'react'
import {MessageDetailItem} from '../MessageDetailItem'
import fakeENV from '@canvas/test-utils/fakeENV'
import {responsiveQuerySizes} from '../../../../util/utils'

vi.mock('../../../../util/utils', async () => {
  const actual = await vi.importActual<any>('../../../../util/utils')
  return {
    ...actual,
    responsiveQuerySizes: vi.fn(() => ({desktop: {minWidth: '768px'}})),
  }
})

vi.mock('@canvas/canvas-studio-player', () => ({
  default: (props: any) => <div>Player with media_id: {props.media_id}</div>,
}))

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const renderWithBody = (htmlBody: string, body = 'plain') =>
  render(
    <MessageDetailItem
      conversationMessage={{
        author: {name: 'Tom', shortName: 'Tom'},
        recipients: [{name: 'Tom', shortName: 'Tom'}],
        createdAt: 'Tue, 20 Apr 2021 14:31:25 UTC +00:00',
        body,
        htmlBody,
      }}
      contextName="Course"
    />,
  )

describe('MessageDetailItem — XSS regression', () => {
  beforeEach(() => {
    fakeENV.setup({CONVERSATIONS: {ATTACHMENTS_FOLDER_ID: '1'}})
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: true,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }))
    ;(responsiveQuerySizes as any).mockImplementation(() => ({
      desktop: {minWidth: '768px'},
    }))
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    fakeENV.teardown()
    delete (window as any).__xss_fired
  })

  it('strips inline event handlers from the rendered message body', () => {
    const {container} = renderWithBody('<p>hi <img src=x onerror="window.__xss_fired = true"></p>')
    expectNoEventHandlers(container)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from the rendered message body', () => {
    const {container} = renderWithBody(
      '<p>before<script>window.__xss_fired = true</script>after</p>',
    )
    expect(container.querySelector('script')).toBeNull()
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('does not promote a title-attribute breakout payload into a live event handler', () => {
    // Defense-in-depth shape: even if the input text contains tag-like content
    // inside a title attribute and a downstream string mutator were to break
    // the attribute boundary, the sink-level sanitizer must strip any
    // resulting on* handler in the rendered DOM.
    const {container} = renderWithBody(
      '<p title="<a ><img src=x onerror=\'window.__xss_fired = true\'>">visible</p>',
    )
    expectNoEventHandlers(container)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips javascript: hrefs', () => {
    const {container} = renderWithBody(
      '<p><a href="javascript:window.__xss_fired=true">click</a></p>',
    )
    const anchor = container.querySelector('a')
    if (anchor) {
      expect(anchor.getAttribute('href') ?? '').not.toMatch(/^javascript:/i)
    }
    expect((window as any).__xss_fired).toBeUndefined()
  })
})
