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

// Regression coverage for the CommentRow dangerouslySetInnerHTML sink.
// The submission comment body in the assignments comments tray is rendered
// via innerHTML; defense-in-depth requires that no script tags or
// event-handler attributes survive in the rendered DOM, regardless of
// what shape the input HTML took. The shared @canvas/sanitize-html
// (DOMPurify) helper is the final pass at the sink.

import React from 'react'
import {render} from '@testing-library/react'
import CommentRow from '../CommentRow'

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

const renderWithComment = (htmlComment: string) => {
  const props: any = {
    comment: {
      attachments: [],
      __typename: 'SubmissionComment',
      _id: '23',
      author: {
        __typename: 'User',
        avatarUrl: null,
        shortName: 'Test Student',
      },
      htmlComment,
      mediaObject: null,
      read: true,
      updatedAt: '2025-03-26T07:02:26-06:00',
    },
  }
  return render(<CommentRow {...props} />)
}

describe('CommentRow — XSS regression', () => {
  beforeEach(() => {
    ;(globalThis as any).ENV = {current_user: {id: '1'}}
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
  })

  it('strips <script> tags from the rendered comment HTML', () => {
    const {container} = renderWithComment(
      '<p>before<script>window.__xss_fired = true</script>after</p>',
    )
    expect(container.querySelector('script')).toBeNull()
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips inline event handlers from the rendered comment HTML', () => {
    const {container} = renderWithComment(
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
    const {container} = renderWithComment(
      '<p title="<a ><img src=x onerror=\'window.__xss_fired = true\'>">visible</p>',
    )
    expectNoEventHandlers(container)
    expect((window as any).__xss_fired).toBeUndefined()
  })
})
