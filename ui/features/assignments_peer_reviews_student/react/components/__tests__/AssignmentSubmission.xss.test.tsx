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

// Regression coverage for stored XSS via the AssignmentSubmission text-entry
// sink in the peer-review student view. The reviewee's submission.body is
// rendered via dangerouslySetInnerHTML; @canvas/sanitize-html is the sink pass.

import React from 'react'
import {render} from '@testing-library/react'
import AssignmentSubmission from '../AssignmentSubmission'

vi.mock('../RubricPanel', () => ({
  RubricPanel: () => <div data-testid="rubric-panel-stub" />,
}))
vi.mock('../CommentsPanel', () => ({
  CommentsPanel: () => <div data-testid="comments-panel-stub" />,
}))
vi.mock('../../hooks/useRubricAssessment', () => ({
  useRubricAssessment: () => ({
    rubricAssessmentData: [],
    rubricAssessmentCompleted: false,
    rubricViewMode: 'traditional',
    setRubricViewMode: vi.fn(),
    handleRubricSubmit: vi.fn(),
    resetRubricAssessment: vi.fn(),
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

// Routes AssignmentSubmission down the renderTextEntry branch so the body
// payload reaches the #submission_preview sink. Sibling panels and the
// rubric assessment hook are stubbed above to isolate the innerHTML pass.
const buildProps = (body: string) =>
  ({
    submission: {
      _id: '1',
      submissionType: 'online_text_entry',
      body,
      user: {_id: 'student-a'},
    },
    assignment: {_id: 'a1', rubric: null},
    isPeerReviewCompleted: false,
    rubricAssessment: null,
    reviewerSubmission: null,
    handleNextPeerReview: vi.fn(),
    onPeerReviewSubmitted: vi.fn(),
    hasSeenPeerReviewModal: false,
    isAnonymous: false,
  }) as any

describe('AssignmentSubmission peer-review text body — XSS regression', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
  })

  it('strips <script> tags from the rendered submission body', () => {
    const {container} = render(
      <AssignmentSubmission
        {...buildProps(
          '<p>before</p><script>window.__xss_fired = true</script><p>after</p>',
        )}
      />,
    )

    const sink = container.querySelector<HTMLElement>('#submission_preview')!
    expect(sink.querySelector('script')).toBeNull()
    expect(sink.innerHTML.toLowerCase()).not.toContain('<script')
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips inline event handlers from the rendered submission body', () => {
    const {container} = render(
      <AssignmentSubmission
        {...buildProps('<p>hi <img src=x onerror="window.__xss_fired = true"></p>')}
      />,
    )

    const sink = container.querySelector<HTMLElement>('#submission_preview')!
    expectNoEventHandlers(sink)
    expect(sink.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('does not promote a title-attribute breakout payload into a live event handler', () => {
    // mXSS probe: apiUserContent.convert's jQuery round-trip can promote
    // attributes the backend allowlist treats as inert text. The sink-level
    // sanitizer must strip any resulting on* handler regardless.
    const {container} = render(
      <AssignmentSubmission
        {...buildProps(
          '<p title="<a ><img src=x onerror=\'window.__xss_fired = true\'>">visible</p>',
        )}
      />,
    )

    const sink = container.querySelector<HTMLElement>('#submission_preview')!
    expectNoEventHandlers(sink)
    expect((window as any).__xss_fired).toBeUndefined()
  })
})
