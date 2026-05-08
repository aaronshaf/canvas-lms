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

// Regression coverage for the SubmissionDetailModal SubmissionComment
// dangerouslySetInnerHTML sink. Submission comment HTML is rendered via
// innerHTML; defense-in-depth requires that no <script> tags or event-handler
// attributes survive in the rendered DOM, regardless of what shape the input
// HTML took. The shared @canvas/sanitize-html (DOMPurify) helper is the final
// pass at the sink.

import React from 'react'
import {render} from '@testing-library/react'
import SubmissionDetailModal from '../SubmissionDetailModal'
import {defaultAssignment, defaultGradebookOptions, defaultStudentSubmissions} from './fixtures'
import type {CommentConnection, GradebookStudentDetails} from '../../../../types'
import fakeENV from '@canvas/test-utils/fakeENV'

vi.mock('@canvas/do-fetch-api-effect/apiRequest', () => ({
  executeApiRequest: vi.fn(),
}))

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const student: GradebookStudentDetails = {
  enrollments: [],
  id: 'student-1',
  loginId: 'student_1',
  name: 'Student One',
  hiddenName: 'Student One',
  sortableName: 'One, Student',
}

const buildComment = (htmlComment: string): CommentConnection => ({
  id: 'comment-1',
  htmlComment,
  attachments: [],
  author: {
    avatarUrl: '',
    id: 'author-1',
    name: 'Teacher One',
    htmlUrl: '/users/1',
  },
  updatedAt: '2026-01-01T00:00:00Z',
})

const renderWithComment = (htmlComment: string) =>
  render(
    <SubmissionDetailModal
      assignment={defaultAssignment}
      gradebookOptions={defaultGradebookOptions}
      student={student}
      submission={defaultStudentSubmissions}
      comments={[buildComment(htmlComment)]}
      modalOpen={true}
      loadingComments={false}
      submitScoreUrl="/courses/1/assignments/1/submissions/1"
      onGradeChange={() => {}}
      onPostComment={() => {}}
      handleClose={() => {}}
    />,
  )

describe('SubmissionDetailModal SubmissionComment - XSS regression', () => {
  beforeEach(() => {
    fakeENV.setup()
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    fakeENV.teardown()
    delete (window as any).__xss_fired
  })

  it('strips inline event handlers from the rendered comment HTML', () => {
    const {baseElement} = renderWithComment(
      '<p>hi <img src=x onerror="window.__xss_fired = true"></p>',
    )
    expectNoEventHandlers(baseElement as HTMLElement)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from the rendered comment HTML', () => {
    const {baseElement} = renderWithComment(
      '<p>before<script>window.__xss_fired = true</script>after</p>',
    )
    expect((baseElement as HTMLElement).querySelector('script')).toBeNull()
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('does not promote a title-attribute breakout payload into a live event handler', () => {
    // Defense-in-depth shape: even if the input text contains tag-like content
    // inside a title attribute and a downstream string mutator were to break
    // the attribute boundary, the sink-level sanitizer must strip any
    // resulting on* handler in the rendered DOM.
    const {baseElement} = renderWithComment(
      '<p title="<a ><img src=x onerror=\'window.__xss_fired = true\'>">visible</p>',
    )
    expectNoEventHandlers(baseElement as HTMLElement)
    expect((window as any).__xss_fired).toBeUndefined()
  })
})
