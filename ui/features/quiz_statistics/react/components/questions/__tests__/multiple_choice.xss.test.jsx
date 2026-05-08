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

// Regression coverage for stored-XSS classes against quiz_statistics
// question/answer rendering. The MultipleChoice component renders
// `props.questionText` and each `answer.text` directly into the DOM via
// `dangerouslySetInnerHTML`. Authors can stash arbitrary HTML in those
// fields, so any payload that survives backend sanitization (or arrives
// from a sharded/old source) would execute on the statistics page.
//
// The "safety" assertion here is "no event handler attribute survives in
// the rendered DOM" and "<script> tags are stripped" — DOMPurify may keep
// benign tags like <img> / <p>, but on* handlers and <script> must be gone.

import {render} from '@testing-library/react'
import React from 'react'
import MultipleChoice from '../multiple_choice'
import {camelize} from '@canvas/quiz-legacy-client-apps/util/convert_case'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = root => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const buildFixture = ({questionText, answerText}) =>
  camelize({
    id: '11',
    question_type: 'multiple_choice_question',
    question_text: questionText,
    position: 1,
    responses: 2,
    answers: [
      {
        id: '3866',
        text: answerText,
        correct: true,
        responses: 1,
      },
      {
        id: '2040',
        text: 'b',
        correct: false,
        responses: 1,
      },
    ],
    answered_student_count: 2,
    top_student_count: 1,
    middle_student_count: 0,
    bottom_student_count: 1,
    correct_student_count: 1,
    incorrect_student_count: 1,
    correct_top_student_count: 1,
    correct_middle_student_count: 0,
    correct_bottom_student_count: 0,
    point_biserials: [],
  })

describe('quiz_statistics MultipleChoice — XSS regression', () => {
  beforeEach(() => {
    delete window.__xss_fired
  })

  afterEach(() => {
    delete window.__xss_fired
  })

  it('strips inline event handlers from questionText', () => {
    const fixture = buildFixture({
      questionText: '<p>Pick one <img src=x onerror="window.__xss_fired = true"></p>',
      answerText: 'A',
    })
    const {container} = render(<MultipleChoice {...fixture} />)

    expectNoEventHandlers(container)
    expect(window.__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from questionText', () => {
    const fixture = buildFixture({
      questionText: '<p>Hi</p><script>window.__xss_fired = true</script>',
      answerText: 'A',
    })
    const {container} = render(<MultipleChoice {...fixture} />)

    expect(container.querySelector('script')).toBeNull()
    expect(window.__xss_fired).toBeUndefined()
  })

  it('strips inline event handlers from answer text', () => {
    const fixture = buildFixture({
      questionText: '<p>Pick one</p>',
      answerText: '<img src=x onerror="window.__xss_fired = true">',
    })
    const {container} = render(<MultipleChoice {...fixture} />)

    expectNoEventHandlers(container)
    expect(window.__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from answer text', () => {
    const fixture = buildFixture({
      questionText: '<p>Pick one</p>',
      answerText: 'ok<script>window.__xss_fired = true</script>',
    })
    const {container} = render(<MultipleChoice {...fixture} />)

    expect(container.querySelector('script')).toBeNull()
    expect(window.__xss_fired).toBeUndefined()
  })

  it('renders benign formatting in questionText', () => {
    const fixture = buildFixture({
      questionText: '<p>Hello <strong>world</strong></p>',
      answerText: 'A',
    })
    const {container} = render(<MultipleChoice {...fixture} />)

    expect(container.querySelector('.question-text strong')).not.toBeNull()
    expect(container.querySelector('.question-text strong').textContent).toBe('world')
  })
})
