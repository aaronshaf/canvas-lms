/*
 * Copyright (C) 2024 - present Instructure, Inc.
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

import React from 'react'
import {fireEvent, render, screen, within} from '@testing-library/react'
import {MemoryRouter, Route, Routes, useParams} from 'react-router-dom'
import EventStream from '../components/event_stream'
import QuestionInspector from '../components/question_inspector'
import K from '../../constants'

const questions = [
  {
    id: '1',
    position: 1,
    questionType: 'multiple_choice_question',
    questionText: '<p>what’s the right choice!?</p>',
    answers: [],
    matches: null,
    readableType: 'Multiple choice',
  },
]

const events = [
  {
    id: 'e-session',
    type: K.EVT_SESSION_STARTED,
    createdAt: '2021-01-04T20:32:50Z',
    data: {},
  },
  {
    id: 'e-viewed',
    type: K.EVT_QUESTION_VIEWED,
    createdAt: '2021-01-04T20:33:05Z',
    data: [{quizQuestionId: '1'}],
  },
]

const submission = {startedAt: '2021-01-04T20:32:49Z'}

function QuestionRouteHarness() {
  const {id} = useParams()
  const question = questions.find(q => q.id === id)
  return React.createElement(QuestionInspector, {question, events: []})
}

function renderLogApp() {
  return render(
    React.createElement(
      MemoryRouter,
      {initialEntries: ['/']},
      React.createElement(
        Routes,
        null,
        React.createElement(Route, {
          path: '/',
          element: React.createElement(EventStream, {
            events,
            submission,
            questions,
            attempt: 2,
          }),
        }),
        React.createElement(Route, {
          path: '/questions/:id',
          element: React.createElement(QuestionRouteHarness),
        }),
      ),
    ),
  )
}

describe('quiz_log_auditing/events question-number navigation', () => {
  it('renders a "#1" link in the EventStream for a viewed question', () => {
    renderLogApp()

    const eventStream = screen.getByTestId('event-stream')
    expect(eventStream).toHaveAttribute('id', 'ic-EventStream')

    const questionLinks = within(eventStream).getAllByText('#1')
    expect(questionLinks.length).toBeGreaterThan(0)
    expect(questionLinks[0]).toHaveAttribute('href', expect.stringContaining('/questions/1'))
  })

  it('navigates to the QuestionInspector with the "Question #1" header when the "#1" link is clicked', () => {
    renderLogApp()

    const eventStream = screen.getByTestId('event-stream')
    const questionLink = within(eventStream).getAllByText('#1')[0]

    fireEvent.click(questionLink)

    const inspectorHeader = document.querySelector('.ic-QuestionInspector__QuestionHeader')
    expect(inspectorHeader).not.toBeNull()
    expect(inspectorHeader!.textContent).toContain('Question #1')
    expect(screen.queryByTestId('event-stream')).toBeNull()
  })
})
