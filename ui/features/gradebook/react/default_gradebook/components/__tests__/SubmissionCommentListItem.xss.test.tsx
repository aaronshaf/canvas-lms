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

// Regression coverage for the SubmissionCommentListItem
// dangerouslySetInnerHTML sink. The submission comment body is rendered via
// innerHTML; defense-in-depth requires that no script tags or event-handler
// attributes survive in the rendered DOM, regardless of what shape the input
// HTML took. The shared @canvas/sanitize-html (DOMPurify) helper is the final
// pass at the sink.

import React from 'react'
import {render} from '@testing-library/react'
import SubmissionCommentListItem from '../SubmissionCommentListItem'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const defaultProps = (overrides: Record<string, any> = {}) => ({
  id: '1',
  author: 'An Author',
  authorAvatarUrl: '//authorAvatarUrl/',
  authorUrl: '//authorUrl/',
  cancelCommenting() {},
  createdAt: new Date(),
  editedAt: null,
  currentUserIsAuthor: true,
  comment: '<p>a comment</p>',
  editing: false,
  editSubmissionComment() {},
  last: false,
  deleteSubmissionComment() {},
  updateSubmissionComment() {},
  processing: false,
  setProcessing() {},
  ...overrides,
})

const renderWithComment = (comment: string) =>
  render(<SubmissionCommentListItem {...defaultProps({comment})} />)

describe('SubmissionCommentListItem — XSS regression', () => {
  beforeEach(() => {
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
