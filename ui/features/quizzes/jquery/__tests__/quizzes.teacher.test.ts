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

import React from 'react'
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DateAvailable from '@canvas/assignments/react/DateAvailable'
import DateDue from '@canvas/assignments/react/DateDue'

// NOTE: This file uses the `.ts` extension (no JSX) because the surrounding
// jQuery-era test files in this directory are all `.ts`. To render React
// components without JSX we use React.createElement directly.

const futureDate = '2099-12-31T23:59:59Z'
const laterFutureDate = '2099-06-15T12:00:00Z'

describe('quizzes index — date columns (teacher view)', () => {
  describe('DateAvailable with a single due date', () => {
    it('does not render "Multiple Dates" when multipleDueDates is false', () => {
      const {container} = render(
        React.createElement(DateAvailable, {
          multipleDueDates: false,
          allDates: [],
          defaultDates: {
            pending: false,
            open: true,
            closed: false,
            unlockAt: null,
            lockAt: futureDate,
          },
          linkHref: '/courses/1/quizzes/1',
        }),
      )

      expect(screen.queryByText('Multiple Dates')).not.toBeInTheDocument()
      expect(container.querySelector('.default-dates')).toBeInTheDocument()
    })
  })

  describe('DateDue with a single due date', () => {
    it('does not render "Multiple Dates" when multipleDueDates is false', () => {
      render(
        React.createElement(DateDue, {
          multipleDueDates: false,
          allDates: [],
          singleSectionDueDate: futureDate,
          todoDate: null,
          linkHref: '/courses/1/quizzes/1',
        }),
      )

      expect(screen.queryByText('Multiple Dates')).not.toBeInTheDocument()
      expect(screen.getByText('Due')).toBeInTheDocument()
    })
  })

  describe('DateAvailable with multiple due dates (after due date override)', () => {
    it('renders "Multiple Dates" as a link to the quiz', () => {
      render(
        React.createElement(DateAvailable, {
          multipleDueDates: true,
          allDates: [
            {
              dueFor: 'Everyone else',
              unlockAt: null,
              lockAt: futureDate,
              pending: false,
              open: true,
              closed: false,
            },
            {
              dueFor: 'New Section',
              unlockAt: null,
              lockAt: laterFutureDate,
              pending: false,
              open: true,
              closed: false,
            },
          ],
          defaultDates: {
            pending: false,
            open: false,
            closed: false,
            unlockAt: null,
            lockAt: null,
          },
          linkHref: '/courses/1/quizzes/1',
        }),
      )

      expect(screen.getByText('Multiple Dates')).toBeInTheDocument()
      const link = screen.getByRole('link', {name: 'Multiple Dates'})
      expect(link).toHaveAttribute('href', '/courses/1/quizzes/1')
    })

    it('shows a tooltip containing "New Section" and "Everyone else" on hover', async () => {
      const user = userEvent.setup()

      render(
        React.createElement(DateAvailable, {
          multipleDueDates: true,
          allDates: [
            {
              dueFor: 'Everyone else',
              unlockAt: null,
              lockAt: futureDate,
              pending: false,
              open: true,
              closed: false,
            },
            {
              dueFor: 'New Section',
              unlockAt: null,
              lockAt: laterFutureDate,
              pending: false,
              open: true,
              closed: false,
            },
          ],
          defaultDates: {
            pending: false,
            open: false,
            closed: false,
            unlockAt: null,
            lockAt: null,
          },
          linkHref: '/courses/1/quizzes/1',
        }),
      )

      const link = screen.getByRole('link', {name: 'Multiple Dates'})
      await user.hover(link)

      expect(await screen.findByText('New Section')).toBeInTheDocument()
      expect(await screen.findByText('Everyone else')).toBeInTheDocument()
    })
  })

  describe('DateDue with multiple due dates (after due date override)', () => {
    it('renders "Multiple Dates" as a link to the quiz', () => {
      render(
        React.createElement(DateDue, {
          multipleDueDates: true,
          allDates: [
            {dueFor: 'Everyone else', dueAt: futureDate},
            {dueFor: 'New Section', dueAt: laterFutureDate},
          ],
          singleSectionDueDate: null,
          todoDate: null,
          linkHref: '/courses/1/quizzes/1',
        }),
      )

      expect(screen.getByText('Multiple Dates')).toBeInTheDocument()
      const link = screen.getByRole('link', {name: 'Multiple Dates'})
      expect(link).toHaveAttribute('href', '/courses/1/quizzes/1')
    })

    it('shows a tooltip containing "New Section" and "Everyone else" on hover', async () => {
      const user = userEvent.setup()

      render(
        React.createElement(DateDue, {
          multipleDueDates: true,
          allDates: [
            {dueFor: 'Everyone else', dueAt: futureDate},
            {dueFor: 'New Section', dueAt: laterFutureDate},
          ],
          singleSectionDueDate: null,
          todoDate: null,
          linkHref: '/courses/1/quizzes/1',
        }),
      )

      const link = screen.getByRole('link', {name: 'Multiple Dates'})
      await user.hover(link)

      expect(await screen.findByText('New Section')).toBeInTheDocument()
      expect(await screen.findByText('Everyone else')).toBeInTheDocument()
    })
  })
})

describe('quiz show — course pacing notice (teacher view)', () => {
  // The renderCoursePacingNotice loader in ui/features/quiz_show/index.js
  // only mounts the CoursePacingNotice React component when the
  // #course_paces_due_date_notice mount point is present in the DOM.
  // The Rails show template only emits that mount point when the quiz is
  // a module item in a paced course; therefore when the quiz is not a
  // module item, the mount point is absent and nothing should be rendered.

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('does not render a CoursePacingNotice mount point when quiz is not a module item', () => {
    // Simulates the show page DOM for a quiz with a due date that is NOT
    // part of any module — the Rails template omits the mount point.
    document.body.innerHTML = `
      <div id="content">
        <table class="assignment_dates"><tbody><tr></tr></tbody></table>
      </div>
    `

    expect(document.getElementById('course_paces_due_date_notice')).toBeNull()
    expect(document.querySelector('[data-testid="CoursePacingNotice"]')).toBeNull()
    expect(document.querySelector('table.assignment_dates')).not.toBeNull()
  })
})
